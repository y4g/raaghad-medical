import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../middleware/auth';
import { findPatient, insertPatient, searchPatients, setPatientArchived, updatePatientRecord } from '../repositories/patientRepository';
import { logActivity } from '../services/activityService';
import { patientSchema } from '../validation/patient';

const router = Router();
const idSchema = z.uuid();

router.get('/', requirePermission('patients.view'), async (request, response, next) => {
  try {
    const page = Math.max(1, Number(request.query.page) || 1);
    const pageSize = Math.min(100, Math.max(10, Number(request.query.pageSize) || 25));
    response.json(await searchPatients({ query: String(request.query.q ?? ''), includeArchived: request.query.archived === 'true', page, pageSize }));
  } catch (error) { next(error); }
});

router.get('/:id', requirePermission('patients.view'), async (request, response, next) => {
  try {
    if (!idSchema.safeParse(request.params.id).success) { response.status(400).json({ message: 'معرّف المريض غير صحيح.' }); return; }
    const patient = await findPatient(request.params.id);
    if (!patient) { response.status(404).json({ message: 'سجل المريض غير موجود.' }); return; }
    response.json({ patient });
  } catch (error) { next(error); }
});

router.post('/', requirePermission('patients.manage'), async (request, response, next) => {
  try {
    const parsed = patientSchema.safeParse(request.body);
    if (!parsed.success) { response.status(400).json({ message: 'تحقق من بيانات المريض.', errors: z.flattenError(parsed.error).fieldErrors }); return; }
    const patient = await insertPatient(parsed.data, request.currentUser!.id);
    await logActivity(request, { action: 'PATIENT_CREATED', entityType: 'patient', entityId: patient.id, patientId: patient.id, details: { medicalNumber: patient.medicalNumber } });
    response.status(201).json({ message: 'تمت إضافة المريض بنجاح.', patient });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') { response.status(409).json({ message: 'الرقم الوطني مستخدم في سجل مريض آخر.' }); return; }
    next(error);
  }
});

router.put('/:id', requirePermission('patients.manage'), async (request, response, next) => {
  try {
    if (!idSchema.safeParse(request.params.id).success) { response.status(400).json({ message: 'معرّف المريض غير صحيح.' }); return; }
    const parsed = patientSchema.safeParse(request.body);
    if (!parsed.success) { response.status(400).json({ message: 'تحقق من بيانات المريض.', errors: z.flattenError(parsed.error).fieldErrors }); return; }
    const patient = await updatePatientRecord(request.params.id, parsed.data, request.currentUser!.id);
    if (!patient) { response.status(404).json({ message: 'سجل المريض غير موجود.' }); return; }
    await logActivity(request, { action: 'PATIENT_UPDATED', entityType: 'patient', entityId: patient.id, patientId: patient.id });
    response.json({ message: 'تم تحديث بيانات المريض.', patient });
  } catch (error) { next(error); }
});

router.patch('/:id/archive', requirePermission('patients.manage'), async (request, response, next) => {
  try {
    if (!idSchema.safeParse(request.params.id).success || typeof request.body.archived !== 'boolean') { response.status(400).json({ message: 'بيانات الأرشفة غير صحيحة.' }); return; }
    const patient = await setPatientArchived(request.params.id, request.body.archived, request.currentUser!.id);
    if (!patient) { response.status(404).json({ message: 'سجل المريض غير موجود.' }); return; }
    await logActivity(request, { action: request.body.archived ? 'PATIENT_ARCHIVED' : 'PATIENT_RESTORED', entityType: 'patient', entityId: patient.id, patientId: patient.id });
    response.json({ message: request.body.archived ? 'تمت أرشفة المريض.' : 'تمت استعادة المريض.', patient });
  } catch (error) { next(error); }
});

export default router;
