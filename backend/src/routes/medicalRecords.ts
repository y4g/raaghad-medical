import express, { Router } from "express";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { z } from "zod";
import type {
  AllergyInput,
  ChronicConditionInput,
  FollowupInput,
  ImagingOrderInput,
  LabOrderInput,
  LabResultInput,
  MedicalVisitInput,
  PrescriptionInput,
  VitalSignsInput,
} from "shared";
import { requirePermission } from "../middleware/auth";
import { db } from "../db/client";
import {
  createAllergy,
  createCondition,
  createFollowup,
  createImagingOrder,
  createLabOrder,
  createLabResult,
  createPrescription,
  createVisit,
  createVitals,
  getPatientRecord,
  updateAllergy,
  updateCondition,
} from "../repositories/medicalRecordRepository";
import { logActivity } from "../services/activityService";
import {
  allergySchema,
  chronicConditionSchema,
  followupSchema,
  imagingOrderSchema,
  labOrderSchema,
  labResultSchema,
  medicalVisitSchema,
  prescriptionSchema,
  vitalSignsSchema,
} from "../validation/medicalRecord";

const router = Router();
const idSchema = z.uuid();

function validIds(patientId: string, itemId?: string): boolean {
  return (
    idSchema.safeParse(patientId).success &&
    (!itemId || idSchema.safeParse(itemId).success)
  );
}

router.get(
  "/patients/:patientId/record",
  requirePermission("patients.view"),
  async (request, response, next) => {
    try {
      if (!validIds(request.params.patientId)) {
        response.status(400).json({ message: "معرّف المريض غير صحيح." });
        return;
      }
      const record = await getPatientRecord(request.params.patientId);
      if (!record) {
        response.status(404).json({ message: "سجل المريض غير موجود." });
        return;
      }
      response.json({ record });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/patients/:patientId/allergies",
  requirePermission("visits.manage"),
  async (request, response, next) => {
    try {
      if (!validIds(request.params.patientId)) {
        response.status(400).json({ message: "معرّف المريض غير صحيح." });
        return;
      }
      const parsed = allergySchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({
          message: "تحقق من بيانات الحساسية.",
          errors: z.flattenError(parsed.error).fieldErrors,
        });
        return;
      }
      const id = await createAllergy(
        request.params.patientId,
        parsed.data as AllergyInput,
        request.currentUser!.id,
      );
      await logActivity(request, {
        action: "ALLERGY_CREATED",
        entityType: "patient_allergy",
        entityId: id,
        patientId: request.params.patientId,
      });
      response.status(201).json({
        message: "تمت إضافة الحساسية.",
        record: await getPatientRecord(request.params.patientId),
      });
    } catch (error) {
      next(error);
    }
  },
);

router.put(
  "/patients/:patientId/allergies/:itemId",
  requirePermission("visits.manage"),
  async (request, response, next) => {
    try {
      if (!validIds(request.params.patientId, request.params.itemId)) {
        response.status(400).json({ message: "المعرّف غير صحيح." });
        return;
      }
      const parsed = allergySchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({
          message: "تحقق من بيانات الحساسية.",
          errors: z.flattenError(parsed.error).fieldErrors,
        });
        return;
      }
      if (
        !(await updateAllergy(
          request.params.patientId,
          request.params.itemId,
          parsed.data as AllergyInput,
        ))
      ) {
        response.status(404).json({ message: "سجل الحساسية غير موجود." });
        return;
      }
      await logActivity(request, {
        action: "ALLERGY_UPDATED",
        entityType: "patient_allergy",
        entityId: request.params.itemId,
        patientId: request.params.patientId,
      });
      response.json({
        message: "تم تحديث الحساسية.",
        record: await getPatientRecord(request.params.patientId),
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/patients/:patientId/chronic-conditions",
  requirePermission("visits.manage"),
  async (request, response, next) => {
    try {
      if (!validIds(request.params.patientId)) {
        response.status(400).json({ message: "معرّف المريض غير صحيح." });
        return;
      }
      const parsed = chronicConditionSchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({
          message: "تحقق من بيانات المرض المزمن.",
          errors: z.flattenError(parsed.error).fieldErrors,
        });
        return;
      }
      const id = await createCondition(
        request.params.patientId,
        parsed.data as ChronicConditionInput,
        request.currentUser!.id,
      );
      await logActivity(request, {
        action: "CHRONIC_CONDITION_CREATED",
        entityType: "chronic_condition",
        entityId: id,
        patientId: request.params.patientId,
      });
      response.status(201).json({
        message: "تمت إضافة المرض المزمن.",
        record: await getPatientRecord(request.params.patientId),
      });
    } catch (error) {
      next(error);
    }
  },
);

router.put(
  "/patients/:patientId/chronic-conditions/:itemId",
  requirePermission("visits.manage"),
  async (request, response, next) => {
    try {
      if (!validIds(request.params.patientId, request.params.itemId)) {
        response.status(400).json({ message: "المعرّف غير صحيح." });
        return;
      }
      const parsed = chronicConditionSchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({
          message: "تحقق من بيانات المرض المزمن.",
          errors: z.flattenError(parsed.error).fieldErrors,
        });
        return;
      }
      if (
        !(await updateCondition(
          request.params.patientId,
          request.params.itemId,
          parsed.data as ChronicConditionInput,
        ))
      ) {
        response.status(404).json({ message: "سجل المرض المزمن غير موجود." });
        return;
      }
      await logActivity(request, {
        action: "CHRONIC_CONDITION_UPDATED",
        entityType: "chronic_condition",
        entityId: request.params.itemId,
        patientId: request.params.patientId,
      });
      response.json({
        message: "تم تحديث المرض المزمن.",
        record: await getPatientRecord(request.params.patientId),
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/patients/:patientId/vitals",
  requirePermission("vitals.manage"),
  async (request, response, next) => {
    try {
      if (!validIds(request.params.patientId)) {
        response.status(400).json({ message: "معرّف المريض غير صحيح." });
        return;
      }
      const parsed = vitalSignsSchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({
          message: parsed.error.issues[0]?.message || "تحقق من القياسات.",
          errors: z.flattenError(parsed.error).fieldErrors,
        });
        return;
      }
      const id = await createVitals(
        request.params.patientId,
        parsed.data as VitalSignsInput,
        request.currentUser!.id,
      );
      await logActivity(request, {
        action: "VITALS_CREATED",
        entityType: "vital_signs",
        entityId: id,
        patientId: request.params.patientId,
      });
      response.status(201).json({
        message: "تم حفظ القياسات الحيوية.",
        record: await getPatientRecord(request.params.patientId),
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/patients/:patientId/visits",
  requirePermission("visits.manage"),
  async (request, response, next) => {
    try {
      if (!validIds(request.params.patientId)) {
        response.status(400).json({ message: "معرّف المريض غير صحيح." });
        return;
      }
      const parsed = medicalVisitSchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({
          message: "تحقق من بيانات الزيارة.",
          errors: z.flattenError(parsed.error).fieldErrors,
        });
        return;
      }
      const id = await createVisit(
        request.params.patientId,
        parsed.data as MedicalVisitInput,
        request.currentUser!.id,
      );
      await logActivity(request, {
        action: "VISIT_CREATED",
        entityType: "visit",
        entityId: id,
        patientId: request.params.patientId,
      });
      response.status(201).json({
        message: "تم حفظ الزيارة الطبية.",
        record: await getPatientRecord(request.params.patientId),
      });
    } catch (error) {
      if ((error as Error).message === "NO_ACTIVE_DOCTOR") {
        response
          .status(409)
          .json({ message: "لا يوجد طبيب فعال لتسجيل الزيارة." });
        return;
      }
      next(error);
    }
  },
);

router.post(
  "/patients/:patientId/prescriptions",
  requirePermission("prescriptions.manage"),
  async (request, response, next) => {
    try {
      if (!validIds(request.params.patientId)) {
        response.status(400).json({ message: "معرّف المريض غير صحيح." });
        return;
      }
      const parsed = prescriptionSchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({
          message: "تحقق من بيانات الوصفة.",
          errors: z.flattenError(parsed.error).fieldErrors,
        });
        return;
      }
      const entityId = await createPrescription(
        request.params.patientId,
        parsed.data as PrescriptionInput,
        request.currentUser!.id,
      );
      await logActivity(request, {
        action: "PRESCRIPTION_CREATED",
        entityType: "prescription",
        entityId,
        patientId: request.params.patientId,
      });
      response.status(201).json({
        message: "تم حفظ الوصفة الطبية.",
        record: await getPatientRecord(request.params.patientId),
      });
    } catch (error) {
      next(error);
    }
  },
);
router.post(
  "/patients/:patientId/labs",
  requirePermission("visits.manage"),
  async (request, response, next) => {
    try {
      const parsed = labOrderSchema.safeParse(request.body);
      if (!validIds(request.params.patientId) || !parsed.success) {
        response.status(400).json({ message: "تحقق من بيانات طلب التحليل." });
        return;
      }
      const entityId = await createLabOrder(
        request.params.patientId,
        parsed.data as LabOrderInput,
        request.currentUser!.id,
      );
      await logActivity(request, {
        action: "LAB_ORDER_CREATED",
        entityType: "lab_order",
        entityId,
        patientId: request.params.patientId,
      });
      response.status(201).json({
        message: "تم إنشاء طلب التحليل.",
        record: await getPatientRecord(request.params.patientId),
      });
    } catch (error) {
      next(error);
    }
  },
);
router.post(
  "/patients/:patientId/labs/:itemId/results",
  requirePermission("visits.manage"),
  async (request, response, next) => {
    try {
      const parsed = labResultSchema.safeParse(request.body);
      if (
        !validIds(request.params.patientId, request.params.itemId) ||
        !parsed.success
      ) {
        response.status(400).json({ message: "تحقق من نتيجة التحليل." });
        return;
      }
      const entityId = await createLabResult(
        request.params.patientId,
        request.params.itemId,
        parsed.data as LabResultInput,
        request.currentUser!.id,
      );
      if (!entityId) {
        response.status(404).json({ message: "طلب التحليل غير موجود." });
        return;
      }
      await logActivity(request, {
        action: "LAB_RESULT_CREATED",
        entityType: "lab_result",
        entityId,
        patientId: request.params.patientId,
      });
      response.status(201).json({
        message: "تم حفظ نتيجة التحليل.",
        record: await getPatientRecord(request.params.patientId),
      });
    } catch (error) {
      next(error);
    }
  },
);
router.post(
  "/patients/:patientId/imaging",
  requirePermission("visits.manage"),
  async (request, response, next) => {
    try {
      const parsed = imagingOrderSchema.safeParse(request.body);
      if (!validIds(request.params.patientId) || !parsed.success) {
        response.status(400).json({ message: "تحقق من بيانات طلب الأشعة." });
        return;
      }
      const entityId = await createImagingOrder(
        request.params.patientId,
        parsed.data as ImagingOrderInput,
        request.currentUser!.id,
      );
      await logActivity(request, {
        action: "IMAGING_ORDER_CREATED",
        entityType: "imaging_order",
        entityId,
        patientId: request.params.patientId,
      });
      response.status(201).json({
        message: "تم حفظ طلب الأشعة.",
        record: await getPatientRecord(request.params.patientId),
      });
    } catch (error) {
      next(error);
    }
  },
);
router.post(
  "/patients/:patientId/followups",
  requirePermission("followups.manage"),
  async (request, response, next) => {
    try {
      const parsed = followupSchema.safeParse(request.body);
      if (!validIds(request.params.patientId) || !parsed.success) {
        response.status(400).json({ message: "تحقق من بيانات المتابعة." });
        return;
      }
      const entityId = await createFollowup(
        request.params.patientId,
        parsed.data as FollowupInput,
        request.currentUser!.id,
      );
      await logActivity(request, {
        action: "FOLLOWUP_CREATED",
        entityType: "followup",
        entityId,
        patientId: request.params.patientId,
      });
      response.status(201).json({
        message: "تم حجز المتابعة.",
        record: await getPatientRecord(request.params.patientId),
      });
    } catch (error) {
      next(error);
    }
  },
);

const attachmentBody = express.raw({
  type: ["application/pdf", "image/jpeg", "image/png"],
  limit: "8mb",
});
router.post(
  "/patients/:patientId/attachments",
  requirePermission("attachments.manage"),
  attachmentBody,
  async (request, response, next) => {
    try {
      if (
        !validIds(request.params.patientId) ||
        !Buffer.isBuffer(request.body) ||
        request.body.length === 0
      ) {
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
        originalName = path.basename(decodeURIComponent(encoded)).slice(0, 255);
      } catch {
        originalName = path.basename(encoded).slice(0, 255);
      }
      const visitId = request.query.visitId
        ? String(request.query.visitId)
        : null;
      if (visitId && !idSchema.safeParse(visitId).success) {
        response.status(400).json({ message: "معرّف الزيارة غير صحيح." });
        return;
      }
      const entityId = randomUUID();
      await db.query(
        `INSERT INTO attachments (id,patient_id,visit_id,storage_key,original_name,mime_type,size_bytes,category,uploaded_by,content_bytes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          entityId,
          request.params.patientId,
          visitId,
          `db:${entityId}`,
          originalName,
          mime,
          request.body.length,
          String(request.query.category || "تقرير طبي").slice(0, 80),
          request.currentUser!.id,
          request.body,
        ],
      );
      await logActivity(request, {
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
          record: await getPatientRecord(request.params.patientId),
        });
    } catch (error) {
      next(error);
    }
  },
);
router.get(
  "/patients/:patientId/attachments/:itemId/download",
  requirePermission("patients.view"),
  async (request, response, next) => {
    try {
      if (!validIds(request.params.patientId, request.params.itemId)) {
        response.status(400).json({ message: "المعرّف غير صحيح." });
        return;
      }
      const result = await db.query<any>(
        "SELECT original_name,mime_type,content_bytes FROM attachments WHERE id=$1 AND patient_id=$2 AND is_archived=FALSE",
        [request.params.itemId, request.params.patientId],
      );
      const file = result.rows[0];
      if (!file?.content_bytes) {
        response.status(404).json({ message: "المرفق غير موجود." });
        return;
      }
      response.setHeader("Content-Type", file.mime_type);
      response.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(file.original_name)}`,
      );
      response.setHeader("Cache-Control", "private, no-store");
      response.send(Buffer.from(file.content_bytes));
    } catch (error) {
      next(error);
    }
  },
);
router.patch(
  "/patients/:patientId/attachments/:itemId/archive",
  requirePermission("attachments.manage"),
  async (request, response, next) => {
    try {
      if (
        !validIds(request.params.patientId, request.params.itemId) ||
        typeof request.body.archived !== "boolean"
      ) {
        response.status(400).json({ message: "بيانات الأرشفة غير صحيحة." });
        return;
      }
      await db.query(
        "UPDATE attachments SET is_archived=$3 WHERE id=$1 AND patient_id=$2",
        [
          request.params.itemId,
          request.params.patientId,
          request.body.archived,
        ],
      );
      await logActivity(request, {
        action: "ATTACHMENT_ARCHIVED",
        entityType: "attachment",
        entityId: request.params.itemId,
        patientId: request.params.patientId,
      });
      response.json({
        message: "تم تحديث حالة المرفق.",
        record: await getPatientRecord(request.params.patientId),
      });
    } catch (error) {
      next(error);
    }
  },
);
export default router;
