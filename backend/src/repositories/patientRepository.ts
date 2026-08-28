import { randomUUID } from 'node:crypto';
import type { Patient, PatientInput } from 'shared';
import { db } from '../db/client';

interface PatientRow {
  id: string; medical_number: string; full_name: string; phone: string; date_of_birth: string; age: number;
  gender: 'MALE' | 'FEMALE'; national_id: string | null; blood_type: string | null; address: string | null;
  height_cm: string | null; weight_kg: string | null; emergency_contact_name: string | null;
  emergency_contact_phone: string | null; notes: string | null; is_archived: boolean;
  has_allergies: boolean; has_chronic_conditions: boolean; created_at: string; updated_at: string;
}

const patientSelect = `SELECT p.id,p.medical_number,p.full_name,p.phone,p.date_of_birth::text,
  EXTRACT(YEAR FROM age(CURRENT_DATE,p.date_of_birth))::int AS age,p.gender,p.national_id,p.blood_type,p.address,
  p.height_cm::text,p.weight_kg::text,p.emergency_contact_name,p.emergency_contact_phone,p.notes,p.is_archived,
  EXISTS(SELECT 1 FROM patient_allergies a WHERE a.patient_id=p.id AND a.is_active) AS has_allergies,
  EXISTS(SELECT 1 FROM chronic_conditions c WHERE c.patient_id=p.id AND c.is_active) AS has_chronic_conditions,
  p.created_at::text,p.updated_at::text FROM patients p`;

function mapPatient(row: PatientRow): Patient {
  const heightCm = row.height_cm === null ? null : Number(row.height_cm);
  const weightKg = row.weight_kg === null ? null : Number(row.weight_kg);
  return {
    id: row.id, medicalNumber: row.medical_number, fullName: row.full_name, phone: row.phone,
    dateOfBirth: row.date_of_birth, age: row.age, gender: row.gender === 'MALE' ? 'ذكر' : 'أنثى',
    nationalId: row.national_id, bloodType: row.blood_type, address: row.address, heightCm, weightKg,
    bmi: heightCm && weightKg ? Number((weightKg / ((heightCm / 100) ** 2)).toFixed(1)) : null,
    emergencyContactName: row.emergency_contact_name, emergencyContactPhone: row.emergency_contact_phone,
    notes: row.notes, isArchived: row.is_archived, hasAllergies: row.has_allergies,
    hasChronicConditions: row.has_chronic_conditions, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

async function nextMedicalNumber(): Promise<string> {
  const sequence = await db.query<{ value: string }>("SELECT nextval('patient_medical_number_seq')::text AS value");
  return `RH-${new Date().getFullYear()}-${String(sequence.rows[0].value).padStart(5, '0')}`;
}

export async function searchPatients(options: { query?: string; includeArchived?: boolean; page: number; pageSize: number }) {
  const search = options.query?.trim() ?? '';
  const where = `WHERE ($1='' OR p.full_name ILIKE '%'||$1||'%' OR p.phone ILIKE '%'||$1||'%' OR p.medical_number ILIKE '%'||$1||'%' OR COALESCE(p.national_id,'') ILIKE '%'||$1||'%') AND ($2::boolean OR NOT p.is_archived)`;
  const rows = await db.query<PatientRow>(`${patientSelect} ${where} ORDER BY p.created_at DESC LIMIT $3 OFFSET $4`, [search, options.includeArchived ?? false, options.pageSize, (options.page - 1) * options.pageSize]);
  const count = await db.query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM patients p ${where}`, [search, options.includeArchived ?? false]);
  return { items: rows.rows.map(mapPatient), total: count.rows[0]?.total ?? 0, page: options.page, pageSize: options.pageSize };
}

export async function findPatient(id: string): Promise<Patient | null> {
  const result = await db.query<PatientRow>(`${patientSelect} WHERE p.id=$1`, [id]);
  return result.rows[0] ? mapPatient(result.rows[0]) : null;
}

export async function insertPatient(input: PatientInput, userId: string | null, id: string = randomUUID()): Promise<Patient> {
  const medicalNumber = await nextMedicalNumber();
  await db.query(`INSERT INTO patients (id,medical_number,full_name,phone,date_of_birth,gender,national_id,blood_type,address,height_cm,weight_kg,emergency_contact_name,emergency_contact_phone,notes,created_by,updated_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15)`, [id, medicalNumber, input.fullName, input.phone, input.dateOfBirth, input.gender === 'ذكر' ? 'MALE' : 'FEMALE', input.nationalId || null, input.bloodType || null, input.address || null, input.heightCm ?? null, input.weightKg ?? null, input.emergencyContactName || null, input.emergencyContactPhone || null, input.notes || null, userId]);
  return (await findPatient(id))!;
}

export async function updatePatientRecord(id: string, input: PatientInput, userId: string): Promise<Patient | null> {
  const result = await db.query(`UPDATE patients SET full_name=$2,phone=$3,date_of_birth=$4,gender=$5,national_id=$6,blood_type=$7,address=$8,height_cm=$9,weight_kg=$10,emergency_contact_name=$11,emergency_contact_phone=$12,notes=$13,updated_by=$14,updated_at=CURRENT_TIMESTAMP WHERE id=$1`, [id, input.fullName, input.phone, input.dateOfBirth, input.gender === 'ذكر' ? 'MALE' : 'FEMALE', input.nationalId || null, input.bloodType || null, input.address || null, input.heightCm ?? null, input.weightKg ?? null, input.emergencyContactName || null, input.emergencyContactPhone || null, input.notes || null, userId]);
  return result.rowCount ? findPatient(id) : null;
}

export async function setPatientArchived(id: string, archived: boolean, userId: string): Promise<Patient | null> {
  const result = await db.query(`UPDATE patients SET is_archived=$2,archived_at=CASE WHEN $2 THEN CURRENT_TIMESTAMP ELSE NULL END,updated_by=$3,updated_at=CURRENT_TIMESTAMP WHERE id=$1`, [id, archived, userId]);
  return result.rowCount ? findPatient(id) : null;
}
