import { randomUUID } from "node:crypto";
import type {
  AllergyInput,
  ChronicConditionInput,
  FollowupInput,
  ImagingOrderInput,
  LabOrderInput,
  LabResultInput,
  MedicalVisitInput,
  PatientRecord,
  PrescriptionInput,
  VitalSignsInput,
} from "shared";
import { db } from "../db/client";
import { findPatient } from "./patientRepository";
import { findAppointments } from "./appointmentRepository";

const numberOrNull = (value: unknown) =>
  value === null || value === undefined ? null : Number(value);

export async function getPatientRecord(
  patientId: string,
): Promise<PatientRecord | null> {
  const patient = await findPatient(patientId);
  if (!patient) return null;
  const [
    allergies,
    conditions,
    vitals,
    visits,
    diagnoses,
    appointments,
    prescriptions,
    prescriptionItems,
    labOrders,
    labResults,
    imagingOrders,
    followups,
    attachments,
  ] = await Promise.all([
    db.query<any>(
      "SELECT * FROM patient_allergies WHERE patient_id=$1 ORDER BY is_active DESC, created_at DESC",
      [patientId],
    ),
    db.query<any>(
      "SELECT * FROM chronic_conditions WHERE patient_id=$1 ORDER BY is_active DESC, created_at DESC",
      [patientId],
    ),
    db.query<any>(
      `SELECT v.*, u.full_name AS measured_by_name FROM vital_signs v JOIN users u ON u.id=v.measured_by WHERE v.patient_id=$1 ORDER BY v.measured_at DESC LIMIT 100`,
      [patientId],
    ),
    db.query<any>(
      `SELECT v.*, d.full_name AS doctor_name FROM visits v JOIN doctors d ON d.id=v.doctor_id WHERE v.patient_id=$1 ORDER BY v.started_at DESC LIMIT 100`,
      [patientId],
    ),
    db.query<any>(
      "SELECT * FROM diagnoses WHERE patient_id=$1 ORDER BY created_at DESC",
      [patientId],
    ),
    findAppointments({ patientId, limit: 100 }),
    db.query<any>(
      `SELECT p.*,d.full_name AS doctor_name FROM prescriptions p JOIN doctors d ON d.id=p.doctor_id WHERE p.patient_id=$1 ORDER BY p.issued_at DESC`,
      [patientId],
    ),
    db.query<any>(
      `SELECT pi.* FROM prescription_items pi JOIN prescriptions p ON p.id=pi.prescription_id WHERE p.patient_id=$1 ORDER BY p.issued_at DESC`,
      [patientId],
    ),
    db.query<any>(
      `SELECT * FROM lab_orders WHERE patient_id=$1 ORDER BY ordered_at DESC`,
      [patientId],
    ),
    db.query<any>(
      `SELECT lr.* FROM lab_results lr JOIN lab_orders lo ON lo.id=lr.lab_order_id WHERE lo.patient_id=$1 ORDER BY lr.result_at DESC`,
      [patientId],
    ),
    db.query<any>(
      `SELECT * FROM imaging_orders WHERE patient_id=$1 ORDER BY ordered_at DESC`,
      [patientId],
    ),
    db.query<any>(
      `SELECT * FROM followups WHERE patient_id=$1 ORDER BY due_at DESC`,
      [patientId],
    ),
    db.query<any>(
      `SELECT a.id,a.visit_id,a.original_name,a.mime_type,a.size_bytes,a.category,a.is_archived,a.uploaded_at,u.full_name AS uploaded_by_name FROM attachments a JOIN users u ON u.id=a.uploaded_by WHERE a.patient_id=$1 ORDER BY a.uploaded_at DESC`,
      [patientId],
    ),
  ]);
  const diagnosisMap = new Map<string, any[]>();
  diagnoses.rows.forEach((row) =>
    diagnosisMap.set(row.visit_id, [
      ...(diagnosisMap.get(row.visit_id) ?? []),
      {
        id: row.id,
        name: row.name,
        code: row.code,
        diagnosisType: row.diagnosis_type,
        notes: row.notes,
        createdAt: row.created_at,
      },
    ]),
  );
  const prescriptionItemMap = new Map<string, any[]>();
  prescriptionItems.rows.forEach((row) =>
    prescriptionItemMap.set(row.prescription_id, [
      ...(prescriptionItemMap.get(row.prescription_id) ?? []),
      {
        id: row.id,
        medicationName: row.medication_name,
        dosage: row.dosage,
        dosageForm: row.dosage_form,
        frequency: row.frequency,
        duration: row.duration,
        instructions: row.instructions,
        notes: row.notes,
      },
    ]),
  );
  const labResultMap = new Map<string, any[]>();
  labResults.rows.forEach((row) =>
    labResultMap.set(row.lab_order_id, [
      ...(labResultMap.get(row.lab_order_id) ?? []),
      {
        id: row.id,
        resultValue: row.result_value,
        unit: row.unit,
        referenceRange: row.reference_range,
        notes: row.notes,
        resultAt: row.result_at,
      },
    ]),
  );
  return {
    patient,
    allergies: allergies.rows.map((row) => ({
      id: row.id,
      substance: row.substance,
      allergyType: row.allergy_type,
      severity: row.severity,
      symptoms: row.symptoms,
      notes: row.notes,
      isActive: row.is_active,
      createdAt: row.created_at,
    })),
    chronicConditions: conditions.rows.map((row) => ({
      id: row.id,
      name: row.name,
      diagnosedAt: row.diagnosed_at,
      status: row.status,
      notes: row.notes,
      followupPlan: row.followup_plan,
      isActive: row.is_active,
      createdAt: row.created_at,
    })),
    vitals: vitals.rows.map((row) => ({
      id: row.id,
      visitId: row.visit_id,
      heightCm: numberOrNull(row.height_cm),
      weightKg: numberOrNull(row.weight_kg),
      bmi: numberOrNull(row.bmi),
      systolic: row.systolic,
      diastolic: row.diastolic,
      pulse: row.pulse,
      temperatureC: numberOrNull(row.temperature_c),
      spo2: row.spo2,
      notes: row.notes,
      measuredByName: row.measured_by_name,
      measuredAt: row.measured_at,
    })),
    visits: visits.rows.map((row) => ({
      id: row.id,
      appointmentId: row.appointment_id,
      doctorName: row.doctor_name,
      visitReason: row.visit_reason,
      symptoms: row.symptoms,
      clinicalNotes: row.clinical_notes,
      treatmentPlan: row.treatment_plan,
      educationInstructions: row.education_instructions,
      followupPlan: row.followup_plan,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      diagnoses: diagnosisMap.get(row.id) ?? [],
    })),
    appointments,
    prescriptions: prescriptions.rows.map((row) => ({
      id: row.id,
      visitId: row.visit_id,
      doctorName: row.doctor_name,
      notes: row.notes,
      issuedAt: row.issued_at,
      items: prescriptionItemMap.get(row.id) ?? [],
    })),
    labOrders: labOrders.rows.map((row) => ({
      id: row.id,
      visitId: row.visit_id,
      testName: row.test_name,
      status: row.status,
      orderNotes: row.order_notes,
      orderedAt: row.ordered_at,
      results: labResultMap.get(row.id) ?? [],
    })),
    imagingOrders: imagingOrders.rows.map((row) => ({
      id: row.id,
      visitId: row.visit_id,
      imagingType: row.imaging_type,
      reason: row.reason,
      report: row.report,
      status: row.status,
      orderedAt: row.ordered_at,
      reportedAt: row.reported_at,
    })),
    followups: followups.rows.map((row) => ({
      id: row.id,
      visitId: row.visit_id,
      patientId: row.patient_id,
      reason: row.reason,
      dueAt: row.due_at,
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at,
    })),
    attachments: attachments.rows.map((row) => ({
      id: row.id,
      visitId: row.visit_id,
      originalName: row.original_name,
      mimeType: row.mime_type,
      sizeBytes: Number(row.size_bytes),
      category: row.category,
      isArchived: row.is_archived,
      uploadedByName: row.uploaded_by_name,
      uploadedAt: row.uploaded_at,
    })),
  };
}

async function activeDoctorId(userId: string): Promise<string> {
  return doctorIdForUser(userId);
}

export async function createPrescription(
  patientId: string,
  input: PrescriptionInput,
  userId: string,
) {
  const id = randomUUID();
  const doctorId = await activeDoctorId(userId);
  await db.query("BEGIN");
  try {
    await db.query(
      `INSERT INTO prescriptions (id,patient_id,visit_id,doctor_id,notes,created_by) VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        id,
        patientId,
        input.visitId ?? null,
        doctorId,
        input.notes ?? null,
        userId,
      ],
    );
    for (const item of input.items)
      await db.query(
        `INSERT INTO prescription_items (id,prescription_id,medication_name,dosage,dosage_form,frequency,duration,instructions,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          randomUUID(),
          id,
          item.medicationName,
          item.dosage,
          item.dosageForm,
          item.frequency,
          item.duration,
          item.instructions,
          item.notes,
        ],
      );
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
  return id;
}

export async function createLabOrder(
  patientId: string,
  input: LabOrderInput,
  userId: string,
) {
  const id = randomUUID();
  await db.query(
    `INSERT INTO lab_orders (id,patient_id,visit_id,test_name,order_notes,ordered_by) VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      id,
      patientId,
      input.visitId ?? null,
      input.testName,
      input.orderNotes ?? null,
      userId,
    ],
  );
  return id;
}
export async function createLabResult(
  patientId: string,
  orderId: string,
  input: LabResultInput,
  userId: string,
) {
  const owned = await db.query(
    `SELECT id FROM lab_orders WHERE id=$1 AND patient_id=$2`,
    [orderId, patientId],
  );
  if (!owned.rowCount) return null;
  const id = randomUUID();
  await db.query("BEGIN");
  try {
    await db.query(
      `INSERT INTO lab_results (id,lab_order_id,result_value,unit,reference_range,notes,result_at,entered_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        id,
        orderId,
        input.resultValue,
        input.unit ?? null,
        input.referenceRange ?? null,
        input.notes ?? null,
        input.resultAt,
        userId,
      ],
    );
    await db.query(`UPDATE lab_orders SET status='COMPLETED' WHERE id=$1`, [
      orderId,
    ]);
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
  return id;
}
export async function createImagingOrder(
  patientId: string,
  input: ImagingOrderInput,
  userId: string,
) {
  const id = randomUUID();
  await db.query(
    `INSERT INTO imaging_orders (id,patient_id,visit_id,imaging_type,reason,report,status,ordered_by,reported_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      id,
      patientId,
      input.visitId ?? null,
      input.imagingType,
      input.reason,
      input.report ?? null,
      input.report ? "REPORTED" : "ORDERED",
      userId,
      input.report ? new Date().toISOString() : null,
    ],
  );
  return id;
}
export async function createFollowup(
  patientId: string,
  input: FollowupInput,
  userId: string,
) {
  const id = randomUUID();
  await db.query(
    `INSERT INTO followups (id,patient_id,visit_id,reason,due_at,status,notes,created_by) VALUES ($1,$2,$3,$4,$5,'UPCOMING',$6,$7)`,
    [
      id,
      patientId,
      input.visitId ?? null,
      input.reason,
      input.dueAt,
      input.notes ?? null,
      userId,
    ],
  );
  return id;
}

export async function createAllergy(
  patientId: string,
  input: AllergyInput,
  userId: string,
) {
  const id = randomUUID();
  await db.query(
    `INSERT INTO patient_allergies (id,patient_id,substance,allergy_type,severity,symptoms,notes,is_active,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      id,
      patientId,
      input.substance,
      input.allergyType,
      input.severity,
      input.symptoms,
      input.notes,
      input.isActive,
      userId,
    ],
  );
  return id;
}

export async function updateAllergy(
  patientId: string,
  id: string,
  input: AllergyInput,
) {
  return (
    (
      await db.query(
        `UPDATE patient_allergies SET substance=$3,allergy_type=$4,severity=$5,symptoms=$6,notes=$7,is_active=$8,updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND patient_id=$2`,
        [
          id,
          patientId,
          input.substance,
          input.allergyType,
          input.severity,
          input.symptoms,
          input.notes,
          input.isActive,
        ],
      )
    ).rowCount > 0
  );
}

export async function createCondition(
  patientId: string,
  input: ChronicConditionInput,
  userId: string,
) {
  const id = randomUUID();
  await db.query(
    `INSERT INTO chronic_conditions (id,patient_id,name,diagnosed_at,status,notes,followup_plan,is_active,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      id,
      patientId,
      input.name,
      input.diagnosedAt,
      input.status,
      input.notes,
      input.followupPlan,
      input.isActive,
      userId,
    ],
  );
  return id;
}

export async function updateCondition(
  patientId: string,
  id: string,
  input: ChronicConditionInput,
) {
  return (
    (
      await db.query(
        `UPDATE chronic_conditions SET name=$3,diagnosed_at=$4,status=$5,notes=$6,followup_plan=$7,is_active=$8,updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND patient_id=$2`,
        [
          id,
          patientId,
          input.name,
          input.diagnosedAt,
          input.status,
          input.notes,
          input.followupPlan,
          input.isActive,
        ],
      )
    ).rowCount > 0
  );
}

export async function createVitals(
  patientId: string,
  input: VitalSignsInput,
  userId: string,
) {
  const id = randomUUID();
  const bmi =
    input.heightCm && input.weightKg
      ? Number((input.weightKg / (input.heightCm / 100) ** 2).toFixed(2))
      : null;
  await db.query(
    `INSERT INTO vital_signs (id,patient_id,visit_id,height_cm,weight_kg,bmi,systolic,diastolic,pulse,temperature_c,spo2,notes,measured_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      id,
      patientId,
      input.visitId,
      input.heightCm,
      input.weightKg,
      bmi,
      input.systolic,
      input.diastolic,
      input.pulse,
      input.temperatureC,
      input.spo2,
      input.notes,
      userId,
    ],
  );
  if (input.heightCm || input.weightKg)
    await db.query(
      "UPDATE patients SET height_cm=COALESCE($2,height_cm),weight_kg=COALESCE($3,weight_kg),updated_at=CURRENT_TIMESTAMP,updated_by=$4 WHERE id=$1",
      [patientId, input.heightCm, input.weightKg, userId],
    );
  return id;
}

async function doctorIdForUser(userId: string): Promise<string> {
  const linked = await db.query<{ id: string }>(
    "SELECT id FROM doctors WHERE user_id=$1 AND is_active=TRUE",
    [userId],
  );
  if (linked.rows[0]) return linked.rows[0].id;
  const fallback = await db.query<{ id: string }>(
    "SELECT id FROM doctors WHERE is_active=TRUE ORDER BY created_at LIMIT 1",
  );
  if (!fallback.rows[0]) throw new Error("NO_ACTIVE_DOCTOR");
  return fallback.rows[0].id;
}

export async function createVisit(
  patientId: string,
  input: MedicalVisitInput,
  userId: string,
) {
  const id = randomUUID();
  const doctorId = await doctorIdForUser(userId);
  await db.query("BEGIN");
  try {
    await db.query(
      `INSERT INTO visits (id,patient_id,doctor_id,appointment_id,visit_reason,symptoms,clinical_notes,treatment_plan,education_instructions,followup_plan,completed_at,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        id,
        patientId,
        doctorId,
        input.appointmentId,
        input.visitReason,
        input.symptoms,
        input.clinicalNotes,
        input.treatmentPlan,
        input.educationInstructions,
        input.followupPlan,
        input.completedAt,
        userId,
      ],
    );
    for (const diagnosis of input.diagnoses)
      await db.query(
        `INSERT INTO diagnoses (id,visit_id,patient_id,name,code,diagnosis_type,notes,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          randomUUID(),
          id,
          patientId,
          diagnosis.name,
          diagnosis.code,
          diagnosis.diagnosisType,
          diagnosis.notes,
          userId,
        ],
      );
    if (input.appointmentId && input.completedAt)
      await db.query(
        `UPDATE appointments SET status='COMPLETED',completed_at=$2,updated_at=CURRENT_TIMESTAMP,updated_by=$3 WHERE id=$1 AND patient_id=$4`,
        [input.appointmentId, input.completedAt, userId, patientId],
      );
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
  return id;
}
