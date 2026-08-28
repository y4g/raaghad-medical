"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateLegacyPatients = migrateLegacyPatients;
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const client_1 = require("../db/client");
const patientRepository_1 = require("../repositories/patientRepository");
async function migrateLegacyPatients() {
    const marker = await client_1.db.query('SELECT key FROM clinic_settings WHERE key=$1', ['legacy_patients_migrated']);
    if (marker.rowCount)
        return;
    try {
        const source = node_path_1.default.resolve(process.cwd(), 'data', 'patients.json');
        const legacy = JSON.parse(await (0, promises_1.readFile)(source, 'utf8'));
        for (const patient of legacy) {
            if (!patient.name || !patient.phone)
                continue;
            const year = new Date().getFullYear() - Math.max(0, Math.min(130, Number(patient.age) || 0));
            const existing = await client_1.db.query('SELECT id FROM patients WHERE phone=$1 AND full_name=$2', [patient.phone, patient.name]);
            const id = patient.id?.match(/^[0-9a-f-]{36}$/i) ? patient.id : (0, node_crypto_1.randomUUID)();
            if (!existing.rowCount)
                await (0, patientRepository_1.insertPatient)({ fullName: patient.name, phone: patient.phone, dateOfBirth: `${year}-01-01`, gender: patient.gender === 'أنثى' ? 'أنثى' : 'ذكر', address: patient.address ?? null, notes: 'تم ترحيل السجل من النسخة السابقة؛ يرجى مراجعة تاريخ الميلاد.' }, null, id);
        }
    }
    catch (error) {
        if (error.code !== 'ENOENT')
            console.warn('Legacy patient migration skipped:', error);
    }
    await client_1.db.query(`INSERT INTO clinic_settings (key,value) VALUES ('legacy_patients_migrated','true'::jsonb) ON CONFLICT (key) DO NOTHING`);
}
