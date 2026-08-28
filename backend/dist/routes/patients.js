"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const patientRepository_1 = require("../repositories/patientRepository");
const activityService_1 = require("../services/activityService");
const patient_1 = require("../validation/patient");
const router = (0, express_1.Router)();
const idSchema = zod_1.z.uuid();
router.get('/', (0, auth_1.requirePermission)('patients.view'), async (request, response, next) => {
    try {
        const page = Math.max(1, Number(request.query.page) || 1);
        const pageSize = Math.min(100, Math.max(10, Number(request.query.pageSize) || 25));
        response.json(await (0, patientRepository_1.searchPatients)({ query: String(request.query.q ?? ''), includeArchived: request.query.archived === 'true', page, pageSize }));
    }
    catch (error) {
        next(error);
    }
});
router.get('/:id', (0, auth_1.requirePermission)('patients.view'), async (request, response, next) => {
    try {
        if (!idSchema.safeParse(request.params.id).success) {
            response.status(400).json({ message: 'معرّف المريض غير صحيح.' });
            return;
        }
        const patient = await (0, patientRepository_1.findPatient)(request.params.id);
        if (!patient) {
            response.status(404).json({ message: 'سجل المريض غير موجود.' });
            return;
        }
        response.json({ patient });
    }
    catch (error) {
        next(error);
    }
});
router.post('/', (0, auth_1.requirePermission)('patients.manage'), async (request, response, next) => {
    try {
        const parsed = patient_1.patientSchema.safeParse(request.body);
        if (!parsed.success) {
            response.status(400).json({ message: 'تحقق من بيانات المريض.', errors: zod_1.z.flattenError(parsed.error).fieldErrors });
            return;
        }
        const patient = await (0, patientRepository_1.insertPatient)(parsed.data, request.currentUser.id);
        await (0, activityService_1.logActivity)(request, { action: 'PATIENT_CREATED', entityType: 'patient', entityId: patient.id, patientId: patient.id, details: { medicalNumber: patient.medicalNumber } });
        response.status(201).json({ message: 'تمت إضافة المريض بنجاح.', patient });
    }
    catch (error) {
        if (error.code === '23505') {
            response.status(409).json({ message: 'الرقم الوطني مستخدم في سجل مريض آخر.' });
            return;
        }
        next(error);
    }
});
router.put('/:id', (0, auth_1.requirePermission)('patients.manage'), async (request, response, next) => {
    try {
        if (!idSchema.safeParse(request.params.id).success) {
            response.status(400).json({ message: 'معرّف المريض غير صحيح.' });
            return;
        }
        const parsed = patient_1.patientSchema.safeParse(request.body);
        if (!parsed.success) {
            response.status(400).json({ message: 'تحقق من بيانات المريض.', errors: zod_1.z.flattenError(parsed.error).fieldErrors });
            return;
        }
        const patient = await (0, patientRepository_1.updatePatientRecord)(request.params.id, parsed.data, request.currentUser.id);
        if (!patient) {
            response.status(404).json({ message: 'سجل المريض غير موجود.' });
            return;
        }
        await (0, activityService_1.logActivity)(request, { action: 'PATIENT_UPDATED', entityType: 'patient', entityId: patient.id, patientId: patient.id });
        response.json({ message: 'تم تحديث بيانات المريض.', patient });
    }
    catch (error) {
        next(error);
    }
});
router.patch('/:id/archive', (0, auth_1.requirePermission)('patients.manage'), async (request, response, next) => {
    try {
        if (!idSchema.safeParse(request.params.id).success || typeof request.body.archived !== 'boolean') {
            response.status(400).json({ message: 'بيانات الأرشفة غير صحيحة.' });
            return;
        }
        const patient = await (0, patientRepository_1.setPatientArchived)(request.params.id, request.body.archived, request.currentUser.id);
        if (!patient) {
            response.status(404).json({ message: 'سجل المريض غير موجود.' });
            return;
        }
        await (0, activityService_1.logActivity)(request, { action: request.body.archived ? 'PATIENT_ARCHIVED' : 'PATIENT_RESTORED', entityType: 'patient', entityId: patient.id, patientId: patient.id });
        response.json({ message: request.body.archived ? 'تمت أرشفة المريض.' : 'تمت استعادة المريض.', patient });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
