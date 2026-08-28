import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { db } from '../db/client';
import { insertPatient } from '../repositories/patientRepository';

interface LegacyPatient { id?: string; name?: string; phone?: string; age?: number; gender?: string; address?: string; }

export async function migrateLegacyPatients(): Promise<void> {
  const marker = await db.query('SELECT key FROM clinic_settings WHERE key=$1', ['legacy_patients_migrated']);
  if (marker.rowCount) return;
  try {
    const source = path.resolve(process.cwd(), 'data', 'patients.json');
    const legacy = JSON.parse(await readFile(source, 'utf8')) as LegacyPatient[];
    for (const patient of legacy) {
      if (!patient.name || !patient.phone) continue;
      const year = new Date().getFullYear() - Math.max(0, Math.min(130, Number(patient.age) || 0));
      const existing = await db.query('SELECT id FROM patients WHERE phone=$1 AND full_name=$2', [patient.phone, patient.name]);
      const id = patient.id?.match(/^[0-9a-f-]{36}$/i) ? patient.id : randomUUID();
      if (!existing.rowCount) await insertPatient({ fullName: patient.name, phone: patient.phone, dateOfBirth: `${year}-01-01`, gender: patient.gender === 'أنثى' ? 'أنثى' : 'ذكر', address: patient.address ?? null, notes: 'تم ترحيل السجل من النسخة السابقة؛ يرجى مراجعة تاريخ الميلاد.' }, null, id);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') console.warn('Legacy patient migration skipped:', error);
  }
  await db.query(`INSERT INTO clinic_settings (key,value) VALUES ('legacy_patients_migrated','true'::jsonb) ON CONFLICT (key) DO NOTHING`);
}
