"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAppointmentOptions = listAppointmentOptions;
exports.listAppointments = listAppointments;
exports.findAppointments = findAppointments;
exports.createAppointment = createAppointment;
exports.changeAppointmentStatus = changeAppointmentStatus;
exports.undoAppointmentStatus = undoAppointmentStatus;
exports.rescheduleAppointment = rescheduleAppointment;
const node_crypto_1 = require("node:crypto");
const client_1 = require("../db/client");
const statusLabels = {
    BOOKED: "محجوز",
    ARRIVED: "وصل",
    WAITING: "بانتظار الدخول",
    WITH_DOCTOR: "عند الدكتورة",
    COMPLETED: "انتهت الزيارة",
    NO_SHOW: "لم يحضر",
    CANCELLED: "ملغي",
    POSTPONED: "مؤجل",
};
function mapAppointment(row) {
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
async function listAppointmentOptions() {
    const doctors = await client_1.db.query("SELECT id,full_name,specialty FROM doctors WHERE is_active ORDER BY full_name");
    const reasons = await client_1.db.query("SELECT id,category,name_ar,usage_count FROM visit_reasons WHERE is_active ORDER BY usage_count DESC,name_ar");
    return {
        doctors: doctors.rows.map((row) => ({
            id: row.id,
            fullName: row.full_name,
            specialty: row.specialty,
        })),
        reasons: reasons.rows.map((row) => ({
            id: row.id,
            category: row.category,
            nameAr: row.name_ar,
            usageCount: row.usage_count,
        })),
    };
}
async function listAppointments(from, to) {
    const result = await client_1.db.query(`${selectSql} WHERE a.start_at >= $1 AND a.start_at < $2 ORDER BY a.start_at`, [from, to]);
    return result.rows.map(mapAppointment);
}
async function findAppointments(options) {
    const limit = Math.min(200, Math.max(1, options.limit ?? 100));
    const result = await client_1.db.query(`${selectSql} WHERE a.patient_id=$1 ORDER BY a.start_at DESC LIMIT ${limit}`, [options.patientId]);
    return result.rows.map(mapAppointment);
}
async function createAppointment(input, userId) {
    const doctors = await client_1.db.query("SELECT id FROM doctors WHERE is_active ORDER BY created_at");
    const doctorId = input.doctorId || (doctors.rows.length === 1 ? doctors.rows[0].id : "");
    if (!doctorId)
        throw new Error("DOCTOR_REQUIRED");
    if (!doctors.rows.some((doctor) => doctor.id === doctorId))
        throw new Error("DOCTOR_NOT_FOUND");
    const start = new Date(input.startAt);
    const end = new Date(start.getTime() + input.durationMinutes * 60000);
    const id = (0, node_crypto_1.randomUUID)();
    await client_1.db.query("BEGIN");
    try {
        await client_1.db.query("SELECT id FROM doctors WHERE id=$1 FOR UPDATE", [doctorId]);
        const conflict = await client_1.db.query("SELECT id FROM appointments WHERE doctor_id=$1 AND status NOT IN ('CANCELLED','POSTPONED') AND start_at<$3 AND end_at>$2 LIMIT 1", [doctorId, start.toISOString(), end.toISOString()]);
        if (conflict.rowCount)
            throw new Error("APPOINTMENT_CONFLICT");
        await client_1.db.query(`INSERT INTO appointments (id,patient_id,doctor_id,visit_reason_id,custom_reason,start_at,end_at,duration_minutes,status,priority,reception_notes,additional_notes,created_by,updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'BOOKED',$9,$10,$11,$12,$12)`, [
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
        ]);
        await client_1.db.query(`INSERT INTO appointment_status_history (id,appointment_id,to_status,changed_by) VALUES ($1,$2,'BOOKED',$3)`, [(0, node_crypto_1.randomUUID)(), id, userId]);
        if (input.visitReasonId)
            await client_1.db.query("UPDATE visit_reasons SET usage_count=usage_count+1 WHERE id=$1", [input.visitReasonId]);
        await client_1.db.query("COMMIT");
    }
    catch (error) {
        await client_1.db.query("ROLLBACK");
        throw error;
    }
    const result = await client_1.db.query(`${selectSql} WHERE a.id=$1`, [
        id,
    ]);
    return mapAppointment(result.rows[0]);
}
async function changeAppointmentStatus(id, status, userId, note) {
    const current = await client_1.db.query("SELECT status FROM appointments WHERE id=$1", [id]);
    if (!current.rows[0])
        return null;
    const previousStatus = current.rows[0].status;
    await client_1.db.query("BEGIN");
    try {
        await client_1.db.query(`UPDATE appointments SET status=$2::varchar,arrived_at=CASE WHEN $2::varchar='ARRIVED' THEN CURRENT_TIMESTAMP ELSE arrived_at END,completed_at=CASE WHEN $2::varchar='COMPLETED' THEN CURRENT_TIMESTAMP ELSE completed_at END,cancelled_at=CASE WHEN $2::varchar='CANCELLED' THEN CURRENT_TIMESTAMP ELSE cancelled_at END,updated_by=$3,updated_at=CURRENT_TIMESTAMP WHERE id=$1`, [id, status, userId]);
        await client_1.db.query("INSERT INTO appointment_status_history (id,appointment_id,from_status,to_status,note,changed_by) VALUES ($1,$2,$3,$4,$5,$6)", [(0, node_crypto_1.randomUUID)(), id, previousStatus, status, note || null, userId]);
        await client_1.db.query("COMMIT");
    }
    catch (error) {
        await client_1.db.query("ROLLBACK");
        throw error;
    }
    const result = await client_1.db.query(`${selectSql} WHERE a.id=$1`, [
        id,
    ]);
    return { appointment: mapAppointment(result.rows[0]), previousStatus };
}
async function undoAppointmentStatus(id, userId) {
    const history = await client_1.db.query(`SELECT id,from_status FROM appointment_status_history WHERE appointment_id=$1 AND changed_by=$2 AND from_status IS NOT NULL AND created_at>CURRENT_TIMESTAMP-INTERVAL '5 minutes' ORDER BY created_at DESC LIMIT 1`, [id, userId]);
    if (!history.rows[0]?.from_status)
        return null;
    await client_1.db.query("BEGIN");
    try {
        await client_1.db.query("UPDATE appointments SET status=$2,updated_by=$3,updated_at=CURRENT_TIMESTAMP WHERE id=$1", [id, history.rows[0].from_status, userId]);
        await client_1.db.query("DELETE FROM appointment_status_history WHERE id=$1", [
            history.rows[0].id,
        ]);
        await client_1.db.query("COMMIT");
    }
    catch (error) {
        await client_1.db.query("ROLLBACK");
        throw error;
    }
    const result = await client_1.db.query(`${selectSql} WHERE a.id=$1`, [
        id,
    ]);
    return mapAppointment(result.rows[0]);
}
async function rescheduleAppointment(id, startAt, userId) {
    const current = await client_1.db.query("SELECT doctor_id,duration_minutes,start_at::text FROM appointments WHERE id=$1", [id]);
    if (!current.rows[0])
        return null;
    const start = new Date(startAt);
    const end = new Date(start.getTime() + current.rows[0].duration_minutes * 60000);
    await client_1.db.query("BEGIN");
    try {
        await client_1.db.query("SELECT id FROM doctors WHERE id=$1 FOR UPDATE", [
            current.rows[0].doctor_id,
        ]);
        const conflict = await client_1.db.query(`SELECT id FROM appointments WHERE doctor_id=$1 AND id<>$2 AND status NOT IN ('CANCELLED','POSTPONED') AND start_at<$4 AND end_at>$3 LIMIT 1`, [current.rows[0].doctor_id, id, start.toISOString(), end.toISOString()]);
        if (conflict.rowCount)
            throw new Error("APPOINTMENT_CONFLICT");
        await client_1.db.query("UPDATE appointments SET start_at=$2,end_at=$3,updated_by=$4,updated_at=CURRENT_TIMESTAMP WHERE id=$1", [id, start.toISOString(), end.toISOString(), userId]);
        await client_1.db.query(`INSERT INTO appointment_status_history (id,appointment_id,from_status,to_status,note,changed_by) SELECT $2,id,status,status,$3,$4 FROM appointments WHERE id=$1`, [id, (0, node_crypto_1.randomUUID)(), `إعادة جدولة من ${current.rows[0].start_at}`, userId]);
        await client_1.db.query("COMMIT");
    }
    catch (error) {
        await client_1.db.query("ROLLBACK");
        throw error;
    }
    const result = await client_1.db.query(`${selectSql} WHERE a.id=$1`, [
        id,
    ]);
    return mapAppointment(result.rows[0]);
}
