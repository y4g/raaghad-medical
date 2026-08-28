"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importStar(require("express"));
const node_crypto_1 = require("node:crypto");
const node_path_1 = __importDefault(require("node:path"));
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const client_1 = require("../db/client");
const medicalRecordRepository_1 = require("../repositories/medicalRecordRepository");
const activityService_1 = require("../services/activityService");
const medicalRecord_1 = require("../validation/medicalRecord");
const router = (0, express_1.Router)();
const idSchema = zod_1.z.uuid();
function validIds(patientId, itemId) {
    return (idSchema.safeParse(patientId).success &&
        (!itemId || idSchema.safeParse(itemId).success));
}
router.get("/patients/:patientId/record", (0, auth_1.requirePermission)("patients.view"), async (request, response, next) => {
    try {
        if (!validIds(request.params.patientId)) {
            response.status(400).json({ message: "معرّف المريض غير صحيح." });
            return;
        }
        const record = await (0, medicalRecordRepository_1.getPatientRecord)(request.params.patientId);
        if (!record) {
            response.status(404).json({ message: "سجل المريض غير موجود." });
            return;
        }
        response.json({ record });
    }
    catch (error) {
        next(error);
    }
});
router.post("/patients/:patientId/allergies", (0, auth_1.requirePermission)("visits.manage"), async (request, response, next) => {
    try {
        if (!validIds(request.params.patientId)) {
            response.status(400).json({ message: "معرّف المريض غير صحيح." });
            return;
        }
        const parsed = medicalRecord_1.allergySchema.safeParse(request.body);
        if (!parsed.success) {
            response.status(400).json({
                message: "تحقق من بيانات الحساسية.",
                errors: zod_1.z.flattenError(parsed.error).fieldErrors,
            });
            return;
        }
        const id = await (0, medicalRecordRepository_1.createAllergy)(request.params.patientId, parsed.data, request.currentUser.id);
        await (0, activityService_1.logActivity)(request, {
            action: "ALLERGY_CREATED",
            entityType: "patient_allergy",
            entityId: id,
            patientId: request.params.patientId,
        });
        response.status(201).json({
            message: "تمت إضافة الحساسية.",
            record: await (0, medicalRecordRepository_1.getPatientRecord)(request.params.patientId),
        });
    }
    catch (error) {
        next(error);
    }
});
router.put("/patients/:patientId/allergies/:itemId", (0, auth_1.requirePermission)("visits.manage"), async (request, response, next) => {
    try {
        if (!validIds(request.params.patientId, request.params.itemId)) {
            response.status(400).json({ message: "المعرّف غير صحيح." });
            return;
        }
        const parsed = medicalRecord_1.allergySchema.safeParse(request.body);
        if (!parsed.success) {
            response.status(400).json({
                message: "تحقق من بيانات الحساسية.",
                errors: zod_1.z.flattenError(parsed.error).fieldErrors,
            });
            return;
        }
        if (!(await (0, medicalRecordRepository_1.updateAllergy)(request.params.patientId, request.params.itemId, parsed.data))) {
            response.status(404).json({ message: "سجل الحساسية غير موجود." });
            return;
        }
        await (0, activityService_1.logActivity)(request, {
            action: "ALLERGY_UPDATED",
            entityType: "patient_allergy",
            entityId: request.params.itemId,
            patientId: request.params.patientId,
        });
        response.json({
            message: "تم تحديث الحساسية.",
            record: await (0, medicalRecordRepository_1.getPatientRecord)(request.params.patientId),
        });
    }
    catch (error) {
        next(error);
    }
});
router.post("/patients/:patientId/chronic-conditions", (0, auth_1.requirePermission)("visits.manage"), async (request, response, next) => {
    try {
        if (!validIds(request.params.patientId)) {
            response.status(400).json({ message: "معرّف المريض غير صحيح." });
            return;
        }
        const parsed = medicalRecord_1.chronicConditionSchema.safeParse(request.body);
        if (!parsed.success) {
            response.status(400).json({
                message: "تحقق من بيانات المرض المزمن.",
                errors: zod_1.z.flattenError(parsed.error).fieldErrors,
            });
            return;
        }
        const id = await (0, medicalRecordRepository_1.createCondition)(request.params.patientId, parsed.data, request.currentUser.id);
        await (0, activityService_1.logActivity)(request, {
            action: "CHRONIC_CONDITION_CREATED",
            entityType: "chronic_condition",
            entityId: id,
            patientId: request.params.patientId,
        });
        response.status(201).json({
            message: "تمت إضافة المرض المزمن.",
            record: await (0, medicalRecordRepository_1.getPatientRecord)(request.params.patientId),
        });
    }
    catch (error) {
        next(error);
    }
});
router.put("/patients/:patientId/chronic-conditions/:itemId", (0, auth_1.requirePermission)("visits.manage"), async (request, response, next) => {
    try {
        if (!validIds(request.params.patientId, request.params.itemId)) {
            response.status(400).json({ message: "المعرّف غير صحيح." });
            return;
        }
        const parsed = medicalRecord_1.chronicConditionSchema.safeParse(request.body);
        if (!parsed.success) {
            response.status(400).json({
                message: "تحقق من بيانات المرض المزمن.",
                errors: zod_1.z.flattenError(parsed.error).fieldErrors,
            });
            return;
        }
        if (!(await (0, medicalRecordRepository_1.updateCondition)(request.params.patientId, request.params.itemId, parsed.data))) {
            response.status(404).json({ message: "سجل المرض المزمن غير موجود." });
            return;
        }
        await (0, activityService_1.logActivity)(request, {
            action: "CHRONIC_CONDITION_UPDATED",
            entityType: "chronic_condition",
            entityId: request.params.itemId,
            patientId: request.params.patientId,
        });
        response.json({
            message: "تم تحديث المرض المزمن.",
            record: await (0, medicalRecordRepository_1.getPatientRecord)(request.params.patientId),
        });
    }
    catch (error) {
        next(error);
    }
});
router.post("/patients/:patientId/vitals", (0, auth_1.requirePermission)("vitals.manage"), async (request, response, next) => {
    try {
        if (!validIds(request.params.patientId)) {
            response.status(400).json({ message: "معرّف المريض غير صحيح." });
            return;
        }
        const parsed = medicalRecord_1.vitalSignsSchema.safeParse(request.body);
        if (!parsed.success) {
            response.status(400).json({
                message: parsed.error.issues[0]?.message || "تحقق من القياسات.",
                errors: zod_1.z.flattenError(parsed.error).fieldErrors,
            });
            return;
        }
        const id = await (0, medicalRecordRepository_1.createVitals)(request.params.patientId, parsed.data, request.currentUser.id);
        await (0, activityService_1.logActivity)(request, {
            action: "VITALS_CREATED",
            entityType: "vital_signs",
            entityId: id,
            patientId: request.params.patientId,
        });
        response.status(201).json({
            message: "تم حفظ القياسات الحيوية.",
            record: await (0, medicalRecordRepository_1.getPatientRecord)(request.params.patientId),
        });
    }
    catch (error) {
        next(error);
    }
});
router.post("/patients/:patientId/visits", (0, auth_1.requirePermission)("visits.manage"), async (request, response, next) => {
    try {
        if (!validIds(request.params.patientId)) {
            response.status(400).json({ message: "معرّف المريض غير صحيح." });
            return;
        }
        const parsed = medicalRecord_1.medicalVisitSchema.safeParse(request.body);
        if (!parsed.success) {
            response.status(400).json({
                message: "تحقق من بيانات الزيارة.",
                errors: zod_1.z.flattenError(parsed.error).fieldErrors,
            });
            return;
        }
        const id = await (0, medicalRecordRepository_1.createVisit)(request.params.patientId, parsed.data, request.currentUser.id);
        await (0, activityService_1.logActivity)(request, {
            action: "VISIT_CREATED",
            entityType: "visit",
            entityId: id,
            patientId: request.params.patientId,
        });
        response.status(201).json({
            message: "تم حفظ الزيارة الطبية.",
            record: await (0, medicalRecordRepository_1.getPatientRecord)(request.params.patientId),
        });
    }
    catch (error) {
        if (error.message === "NO_ACTIVE_DOCTOR") {
            response
                .status(409)
                .json({ message: "لا يوجد طبيب فعال لتسجيل الزيارة." });
            return;
        }
        next(error);
    }
});
router.post("/patients/:patientId/prescriptions", (0, auth_1.requirePermission)("prescriptions.manage"), async (request, response, next) => {
    try {
        if (!validIds(request.params.patientId)) {
            response.status(400).json({ message: "معرّف المريض غير صحيح." });
            return;
        }
        const parsed = medicalRecord_1.prescriptionSchema.safeParse(request.body);
        if (!parsed.success) {
            response.status(400).json({
                message: "تحقق من بيانات الوصفة.",
                errors: zod_1.z.flattenError(parsed.error).fieldErrors,
            });
            return;
        }
        const entityId = await (0, medicalRecordRepository_1.createPrescription)(request.params.patientId, parsed.data, request.currentUser.id);
        await (0, activityService_1.logActivity)(request, {
            action: "PRESCRIPTION_CREATED",
            entityType: "prescription",
            entityId,
            patientId: request.params.patientId,
        });
        response.status(201).json({
            message: "تم حفظ الوصفة الطبية.",
            record: await (0, medicalRecordRepository_1.getPatientRecord)(request.params.patientId),
        });
    }
    catch (error) {
        next(error);
    }
});
router.post("/patients/:patientId/labs", (0, auth_1.requirePermission)("visits.manage"), async (request, response, next) => {
    try {
        const parsed = medicalRecord_1.labOrderSchema.safeParse(request.body);
        if (!validIds(request.params.patientId) || !parsed.success) {
            response.status(400).json({ message: "تحقق من بيانات طلب التحليل." });
            return;
        }
        const entityId = await (0, medicalRecordRepository_1.createLabOrder)(request.params.patientId, parsed.data, request.currentUser.id);
        await (0, activityService_1.logActivity)(request, {
            action: "LAB_ORDER_CREATED",
            entityType: "lab_order",
            entityId,
            patientId: request.params.patientId,
        });
        response.status(201).json({
            message: "تم إنشاء طلب التحليل.",
            record: await (0, medicalRecordRepository_1.getPatientRecord)(request.params.patientId),
        });
    }
    catch (error) {
        next(error);
    }
});
router.post("/patients/:patientId/labs/:itemId/results", (0, auth_1.requirePermission)("visits.manage"), async (request, response, next) => {
    try {
        const parsed = medicalRecord_1.labResultSchema.safeParse(request.body);
        if (!validIds(request.params.patientId, request.params.itemId) ||
            !parsed.success) {
            response.status(400).json({ message: "تحقق من نتيجة التحليل." });
            return;
        }
        const entityId = await (0, medicalRecordRepository_1.createLabResult)(request.params.patientId, request.params.itemId, parsed.data, request.currentUser.id);
        if (!entityId) {
            response.status(404).json({ message: "طلب التحليل غير موجود." });
            return;
        }
        await (0, activityService_1.logActivity)(request, {
            action: "LAB_RESULT_CREATED",
            entityType: "lab_result",
            entityId,
            patientId: request.params.patientId,
        });
        response.status(201).json({
            message: "تم حفظ نتيجة التحليل.",
            record: await (0, medicalRecordRepository_1.getPatientRecord)(request.params.patientId),
        });
    }
    catch (error) {
        next(error);
    }
});
router.post("/patients/:patientId/imaging", (0, auth_1.requirePermission)("visits.manage"), async (request, response, next) => {
    try {
        const parsed = medicalRecord_1.imagingOrderSchema.safeParse(request.body);
        if (!validIds(request.params.patientId) || !parsed.success) {
            response.status(400).json({ message: "تحقق من بيانات طلب الأشعة." });
            return;
        }
        const entityId = await (0, medicalRecordRepository_1.createImagingOrder)(request.params.patientId, parsed.data, request.currentUser.id);
        await (0, activityService_1.logActivity)(request, {
            action: "IMAGING_ORDER_CREATED",
            entityType: "imaging_order",
            entityId,
            patientId: request.params.patientId,
        });
        response.status(201).json({
            message: "تم حفظ طلب الأشعة.",
            record: await (0, medicalRecordRepository_1.getPatientRecord)(request.params.patientId),
        });
    }
    catch (error) {
        next(error);
    }
});
router.post("/patients/:patientId/followups", (0, auth_1.requirePermission)("followups.manage"), async (request, response, next) => {
    try {
        const parsed = medicalRecord_1.followupSchema.safeParse(request.body);
        if (!validIds(request.params.patientId) || !parsed.success) {
            response.status(400).json({ message: "تحقق من بيانات المتابعة." });
            return;
        }
        const entityId = await (0, medicalRecordRepository_1.createFollowup)(request.params.patientId, parsed.data, request.currentUser.id);
        await (0, activityService_1.logActivity)(request, {
            action: "FOLLOWUP_CREATED",
            entityType: "followup",
            entityId,
            patientId: request.params.patientId,
        });
        response.status(201).json({
            message: "تم حجز المتابعة.",
            record: await (0, medicalRecordRepository_1.getPatientRecord)(request.params.patientId),
        });
    }
    catch (error) {
        next(error);
    }
});
const attachmentBody = express_1.default.raw({
    type: ["application/pdf", "image/jpeg", "image/png"],
    limit: "8mb",
});
router.post("/patients/:patientId/attachments", (0, auth_1.requirePermission)("attachments.manage"), attachmentBody, async (request, response, next) => {
    try {
        if (!validIds(request.params.patientId) ||
            !Buffer.isBuffer(request.body) ||
            request.body.length === 0) {
            response.status(400).json({ message: "ملف المرفق غير صحيح." });
            return;
        }
        const mime = request.get("content-type")?.split(";")[0] || "";
        if (!["application/pdf", "image/jpeg", "image/png"].includes(mime)) {
            response
                .status(415)
                .json({ message: "الملفات المسموحة هي PDF وJPG وPNG فقط." });
            return;
        }
        const encoded = request.get("x-file-name") || "medical-file";
        let originalName = "medical-file";
        try {
            originalName = node_path_1.default.basename(decodeURIComponent(encoded)).slice(0, 255);
        }
        catch {
            originalName = node_path_1.default.basename(encoded).slice(0, 255);
        }
        const visitId = request.query.visitId
            ? String(request.query.visitId)
            : null;
        if (visitId && !idSchema.safeParse(visitId).success) {
            response.status(400).json({ message: "معرّف الزيارة غير صحيح." });
            return;
        }
        const entityId = (0, node_crypto_1.randomUUID)();
        await client_1.db.query(`INSERT INTO attachments (id,patient_id,visit_id,storage_key,original_name,mime_type,size_bytes,category,uploaded_by,content_bytes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [
            entityId,
            request.params.patientId,
            visitId,
            `db:${entityId}`,
            originalName,
            mime,
            request.body.length,
            String(request.query.category || "تقرير طبي").slice(0, 80),
            request.currentUser.id,
            request.body,
        ]);
        await (0, activityService_1.logActivity)(request, {
            action: "ATTACHMENT_UPLOADED",
            entityType: "attachment",
            entityId,
            patientId: request.params.patientId,
            details: { mime, size: request.body.length },
        });
        response
            .status(201)
            .json({
            message: "تم رفع المرفق الطبي بأمان.",
            record: await (0, medicalRecordRepository_1.getPatientRecord)(request.params.patientId),
        });
    }
    catch (error) {
        next(error);
    }
});
router.get("/patients/:patientId/attachments/:itemId/download", (0, auth_1.requirePermission)("patients.view"), async (request, response, next) => {
    try {
        if (!validIds(request.params.patientId, request.params.itemId)) {
            response.status(400).json({ message: "المعرّف غير صحيح." });
            return;
        }
        const result = await client_1.db.query("SELECT original_name,mime_type,content_bytes FROM attachments WHERE id=$1 AND patient_id=$2 AND is_archived=FALSE", [request.params.itemId, request.params.patientId]);
        const file = result.rows[0];
        if (!file?.content_bytes) {
            response.status(404).json({ message: "المرفق غير موجود." });
            return;
        }
        response.setHeader("Content-Type", file.mime_type);
        response.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.original_name)}`);
        response.setHeader("Cache-Control", "private, no-store");
        response.send(Buffer.from(file.content_bytes));
    }
    catch (error) {
        next(error);
    }
});
router.patch("/patients/:patientId/attachments/:itemId/archive", (0, auth_1.requirePermission)("attachments.manage"), async (request, response, next) => {
    try {
        if (!validIds(request.params.patientId, request.params.itemId) ||
            typeof request.body.archived !== "boolean") {
            response.status(400).json({ message: "بيانات الأرشفة غير صحيحة." });
            return;
        }
        await client_1.db.query("UPDATE attachments SET is_archived=$3 WHERE id=$1 AND patient_id=$2", [
            request.params.itemId,
            request.params.patientId,
            request.body.archived,
        ]);
        await (0, activityService_1.logActivity)(request, {
            action: "ATTACHMENT_ARCHIVED",
            entityType: "attachment",
            entityId: request.params.itemId,
            patientId: request.params.patientId,
        });
        response.json({
            message: "تم تحديث حالة المرفق.",
            record: await (0, medicalRecordRepository_1.getPatientRecord)(request.params.patientId),
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
