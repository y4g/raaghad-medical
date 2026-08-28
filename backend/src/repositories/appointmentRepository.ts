import { randomUUID } from "node:crypto";
import type {
  Appointment,
  AppointmentInput,
  AppointmentStatus,
  DoctorOption,
  VisitReasonOption,
} from "shared";
import { db } from "../db/client";

const statusLabels: Record<AppointmentStatus, string> = {
  BOOKED: "محجوز",
  ARRIVED: "وصل",
  WAITING: "بانتظار الدخول",
  WITH_DOCTOR: "عند الدكتورة",
  COMPLETED: "انتهت الزيارة",
  NO_SHOW: "لم يحضر",
  CANCELLED: "ملغي",
  POSTPONED: "مؤجل",
};
interface AppointmentRow {
  id: string;
  patient_id: string;
  doctor_id: string;
  patient_name: string;
  medical_number: string;
  doctor_name: string;
  start_at: string;
  end_at: string;
  duration_minutes: number;
  status: AppointmentStatus;
  priority: Appointment["priority"];
  reason: string;
  reception_notes: string | null;
  has_allergies: boolean;
  has_chronic_conditions: boolean;
  created_at: string;
}

function mapAppointment(row: AppointmentRow): Appointment {
  return {
    id: row.id,
    patientId: row.patient_id,
    doctorId: row.doctor_id,
    patientName: row.patient_name,
    patientMedicalNumber: row.medical_number,
    doctorName: row.doctor_name,
    startAt: row.start_at,
    endAt: row.end_at,
    durationMinutes: row.duration_minutes,
    status: row.status,
    statusLabel: statusLabels[row.status],
    priority: row.priority,
    reason: row.reason,
    receptionNotes: row.reception_notes,
    hasAllergies: row.has_allergies,
    hasChronicConditions: row.has_chronic_conditions,
    createdAt: row.created_at,
  };
}
const selectSql = `SELECT a.id,a.patient_id,a.doctor_id,p.full_name AS patient_name,p.medical_number,d.full_name AS doctor_name,a.start_at::text,a.end_at::text,a.duration_minutes,a.status,a.priority,COALESCE(vr.name_ar,a.custom_reason,'استشارة عامة') AS reason,a.reception_notes,a.created_at::text,EXISTS(SELECT 1 FROM patient_allergies pa WHERE pa.patient_id=p.id AND pa.is_active) AS has_allergies,EXISTS(SELECT 1 FROM chronic_conditions cc WHERE cc.patient_id=p.id AND cc.is_active) AS has_chronic_conditions FROM appointments a JOIN patients p ON p.id=a.patient_id JOIN doctors d ON d.id=a.doctor_id LEFT JOIN visit_reasons vr ON vr.id=a.visit_reason_id`;

export async function listAppointmentOptions() {
  const doctors = await db.query<{
    id: string;
    full_name: string;
    specialty: string;
  }>(
    "SELECT id,full_name,specialty FROM doctors WHERE is_active ORDER BY full_name",
  );
  const reasons = await db.query<{
    id: string;
    category: string;
    name_ar: string;
    usage_count: number;
  }>(
    "SELECT id,category,name_ar,usage_count FROM visit_reasons WHERE is_active ORDER BY usage_count DESC,name_ar",
  );
  return {
    doctors: doctors.rows.map((row): DoctorOption => ({
      id: row.id,
      fullName: row.full_name,
      specialty: row.specialty,
    })),
    reasons: reasons.rows.map((row): VisitReasonOption => ({
      id: row.id,
      category: row.category,
      nameAr: row.name_ar,
      usageCount: row.usage_count,
    })),
  };
}

export async function listAppointments(
  from: string,
  to: string,
): Promise<Appointment[]> {
  const result = await db.query<AppointmentRow>(
    `${selectSql} WHERE a.start_at >= $1 AND a.start_at < $2 ORDER BY a.start_at`,
    [from, to],
  );
  return result.rows.map(mapAppointment);
}

export async function findAppointments(options: {
  patientId: string;
  limit?: number;
}): Promise<Appointment[]> {
  const limit = Math.min(200, Math.max(1, options.limit ?? 100));
  const result = await db.query<AppointmentRow>(
    `${selectSql} WHERE a.patient_id=$1 ORDER BY a.start_at DESC LIMIT ${limit}`,
    [options.patientId],
  );
  return result.rows.map(mapAppointment);
}

export async function createAppointment(
  input: AppointmentInput,
  userId: string,
): Promise<Appointment> {
  const doctors = await db.query<{ id: string }>(
    "SELECT id FROM doctors WHERE is_active ORDER BY created_at",
  );
  const doctorId =
    input.doctorId || (doctors.rows.length === 1 ? doctors.rows[0].id : "");
  if (!doctorId) throw new Error("DOCTOR_REQUIRED");
  if (!doctors.rows.some((doctor) => doctor.id === doctorId))
    throw new Error("DOCTOR_NOT_FOUND");
  const start = new Date(input.startAt);
  const end = new Date(start.getTime() + input.durationMinutes * 60000);
  const id = randomUUID();
  await db.query("BEGIN");
  try {
    await db.query("SELECT id FROM doctors WHERE id=$1 FOR UPDATE", [doctorId]);
    const conflict = await db.query(
      "SELECT id FROM appointments WHERE doctor_id=$1 AND status NOT IN ('CANCELLED','POSTPONED') AND start_at<$3 AND end_at>$2 LIMIT 1",
      [doctorId, start.toISOString(), end.toISOString()],
    );
    if (conflict.rowCount) throw new Error("APPOINTMENT_CONFLICT");
    await db.query(
      `INSERT INTO appointments (id,patient_id,doctor_id,visit_reason_id,custom_reason,start_at,end_at,duration_minutes,status,priority,reception_notes,additional_notes,created_by,updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'BOOKED',$9,$10,$11,$12,$12)`,
      [
        id,
        input.patientId,
        doctorId,
        input.visitReasonId || null,
        input.customReason || null,
        start.toISOString(),
        end.toISOString(),
        input.durationMinutes,
        input.priority,
        input.receptionNotes || null,
        input.additionalNotes || null,
        userId,
      ],
    );
    await db.query(
      `INSERT INTO appointment_status_history (id,appointment_id,to_status,changed_by) VALUES ($1,$2,'BOOKED',$3)`,
      [randomUUID(), id, userId],
    );
    if (input.visitReasonId)
      await db.query(
        "UPDATE visit_reasons SET usage_count=usage_count+1 WHERE id=$1",
        [input.visitReasonId],
      );
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
  const result = await db.query<AppointmentRow>(`${selectSql} WHERE a.id=$1`, [
    id,
  ]);
  return mapAppointment(result.rows[0]);
}

export async function changeAppointmentStatus(
  id: string,
  status: AppointmentStatus,
  userId: string,
  note?: string,
): Promise<{
  appointment: Appointment;
  previousStatus: AppointmentStatus;
} | null> {
  const current = await db.query<{ status: AppointmentStatus }>(
    "SELECT status FROM appointments WHERE id=$1",
    [id],
  );
  if (!current.rows[0]) return null;
  const previousStatus = current.rows[0].status;
  await db.query("BEGIN");
  try {
    await db.query(
      `UPDATE appointments SET status=$2::varchar,arrived_at=CASE WHEN $2::varchar='ARRIVED' THEN CURRENT_TIMESTAMP ELSE arrived_at END,completed_at=CASE WHEN $2::varchar='COMPLETED' THEN CURRENT_TIMESTAMP ELSE completed_at END,cancelled_at=CASE WHEN $2::varchar='CANCELLED' THEN CURRENT_TIMESTAMP ELSE cancelled_at END,updated_by=$3,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
      [id, status, userId],
    );
    await db.query(
      "INSERT INTO appointment_status_history (id,appointment_id,from_status,to_status,note,changed_by) VALUES ($1,$2,$3,$4,$5,$6)",
      [randomUUID(), id, previousStatus, status, note || null, userId],
    );
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
  const result = await db.query<AppointmentRow>(`${selectSql} WHERE a.id=$1`, [
    id,
  ]);
  return { appointment: mapAppointment(result.rows[0]), previousStatus };
}

export async function undoAppointmentStatus(
  id: string,
  userId: string,
): Promise<Appointment | null> {
  const history = await db.query<{
    id: string;
    from_status: AppointmentStatus | null;
  }>(
    `SELECT id,from_status FROM appointment_status_history WHERE appointment_id=$1 AND changed_by=$2 AND from_status IS NOT NULL AND created_at>CURRENT_TIMESTAMP-INTERVAL '5 minutes' ORDER BY created_at DESC LIMIT 1`,
    [id, userId],
  );
  if (!history.rows[0]?.from_status) return null;
  await db.query("BEGIN");
  try {
    await db.query(
      "UPDATE appointments SET status=$2,updated_by=$3,updated_at=CURRENT_TIMESTAMP WHERE id=$1",
      [id, history.rows[0].from_status, userId],
    );
    await db.query("DELETE FROM appointment_status_history WHERE id=$1", [
      history.rows[0].id,
    ]);
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
  const result = await db.query<AppointmentRow>(`${selectSql} WHERE a.id=$1`, [
    id,
  ]);
  return mapAppointment(result.rows[0]);
}

export async function rescheduleAppointment(
  id: string,
  startAt: string,
  userId: string,
): Promise<Appointment | null> {
  const current = await db.query<{
    doctor_id: string;
    duration_minutes: number;
    start_at: string;
  }>(
    "SELECT doctor_id,duration_minutes,start_at::text FROM appointments WHERE id=$1",
    [id],
  );
  if (!current.rows[0]) return null;
  const start = new Date(startAt);
  const end = new Date(
    start.getTime() + current.rows[0].duration_minutes * 60000,
  );
  await db.query("BEGIN");
  try {
    await db.query("SELECT id FROM doctors WHERE id=$1 FOR UPDATE", [
      current.rows[0].doctor_id,
    ]);
    const conflict = await db.query(
      `SELECT id FROM appointments WHERE doctor_id=$1 AND id<>$2 AND status NOT IN ('CANCELLED','POSTPONED') AND start_at<$4 AND end_at>$3 LIMIT 1`,
      [current.rows[0].doctor_id, id, start.toISOString(), end.toISOString()],
    );
    if (conflict.rowCount) throw new Error("APPOINTMENT_CONFLICT");
    await db.query(
      "UPDATE appointments SET start_at=$2,end_at=$3,updated_by=$4,updated_at=CURRENT_TIMESTAMP WHERE id=$1",
      [id, start.toISOString(), end.toISOString(), userId],
    );
    await db.query(
      `INSERT INTO appointment_status_history (id,appointment_id,from_status,to_status,note,changed_by) SELECT $2,id,status,status,$3,$4 FROM appointments WHERE id=$1`,
      [id, randomUUID(), `إعادة جدولة من ${current.rows[0].start_at}`, userId],
    );
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
  const result = await db.query<AppointmentRow>(`${selectSql} WHERE a.id=$1`, [
    id,
  ]);
  return mapAppointment(result.rows[0]);
}
