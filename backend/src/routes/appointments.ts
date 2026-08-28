import { Router } from "express";
import { z } from "zod";
import type { AppointmentStatus } from "shared";
import { requirePermission } from "../middleware/auth";
import {
  changeAppointmentStatus,
  createAppointment,
  listAppointmentOptions,
  listAppointments,
  rescheduleAppointment,
  undoAppointmentStatus,
} from "../repositories/appointmentRepository";
import { logActivity } from "../services/activityService";

const router = Router();
const appointmentSchema = z
  .object({
    patientId: z.uuid(),
    doctorId: z.uuid().optional(),
    visitReasonId: z.uuid().optional(),
    customReason: z.string().trim().max(500).optional(),
    startAt: z.iso.datetime(),
    durationMinutes: z.number().int().min(5).max(480).default(30),
    priority: z.enum(["NORMAL", "URGENT", "EMERGENCY"]).default("NORMAL"),
    receptionNotes: z.string().max(2000).optional(),
    additionalNotes: z.string().max(2000).optional(),
  })
  .refine((value) => value.visitReasonId || value.customReason, {
    message: "اختر سبب الزيارة أو اكتبه.",
  });
const statusSchema = z.object({
  status: z.enum([
    "BOOKED",
    "ARRIVED",
    "WAITING",
    "WITH_DOCTOR",
    "COMPLETED",
    "NO_SHOW",
    "CANCELLED",
    "POSTPONED",
  ]),
  note: z.string().max(1000).optional(),
});

router.get(
  "/options",
  requirePermission("appointments.view"),
  async (_request, response, next) => {
    try {
      response.json(await listAppointmentOptions());
    } catch (error) {
      next(error);
    }
  },
);
router.get(
  "/",
  requirePermission("appointments.view"),
  async (request, response, next) => {
    try {
      const from = String(request.query.from || "");
      const to = String(request.query.to || "");
      if (
        !z.iso.datetime().safeParse(from).success ||
        !z.iso.datetime().safeParse(to).success
      ) {
        response.status(400).json({ message: "الفترة الزمنية غير صحيحة." });
        return;
      }
      response.json({ items: await listAppointments(from, to) });
    } catch (error) {
      next(error);
    }
  },
);
router.post(
  "/",
  requirePermission("appointments.manage"),
  async (request, response, next) => {
    try {
      const parsed = appointmentSchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({
          message: parsed.error.issues[0]?.message || "تحقق من بيانات الموعد.",
        });
        return;
      }
      if (new Date(parsed.data.startAt).getTime() < Date.now() - 60_000) {
        response.status(400).json({
          message: "لا يمكن حجز موعد في وقت مضى، يرجى اختيار وقت لاحق.",
        });
        return;
      }
      const appointment = await createAppointment(
        parsed.data,
        request.currentUser!.id,
      );
      await logActivity(request, {
        action: "APPOINTMENT_CREATED",
        entityType: "appointment",
        entityId: appointment.id,
        patientId: appointment.patientId,
      });
      response
        .status(201)
        .json({ message: "تم حجز الموعد بنجاح.", appointment });
    } catch (error) {
      if ((error as Error).message === "APPOINTMENT_CONFLICT") {
        response
          .status(409)
          .json({ message: "هذا الوقت محجوز بالفعل، يرجى اختيار وقت آخر." });
        return;
      }
      next(error);
    }
  },
);
router.patch(
  "/:id/status",
  requirePermission("appointments.manage"),
  async (request, response, next) => {
    try {
      const parsed = statusSchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({ message: "حالة الموعد غير صحيحة." });
        return;
      }
      const result = await changeAppointmentStatus(
        request.params.id,
        parsed.data.status as AppointmentStatus,
        request.currentUser!.id,
        parsed.data.note,
      );
      if (!result) {
        response.status(404).json({ message: "الموعد غير موجود." });
        return;
      }
      await logActivity(request, {
        action: "APPOINTMENT_STATUS_CHANGED",
        entityType: "appointment",
        entityId: result.appointment.id,
        patientId: result.appointment.patientId,
        details: { from: result.previousStatus, to: parsed.data.status },
      });
      response.json({
        message: `تم تغيير الحالة إلى «${result.appointment.statusLabel}».`,
        appointment: result.appointment,
        undoAvailable: true,
      });
    } catch (error) {
      next(error);
    }
  },
);
router.post(
  "/:id/status/undo",
  requirePermission("appointments.manage"),
  async (request, response, next) => {
    try {
      const appointment = await undoAppointmentStatus(
        request.params.id,
        request.currentUser!.id,
      );
      if (!appointment) {
        response.status(409).json({
          message: "انتهت مهلة التراجع أو لا توجد عملية قابلة للتراجع.",
        });
        return;
      }
      await logActivity(request, {
        action: "APPOINTMENT_STATUS_UNDONE",
        entityType: "appointment",
        entityId: appointment.id,
        patientId: appointment.patientId,
      });
      response.json({ message: "تم التراجع عن تغيير الحالة.", appointment });
    } catch (error) {
      next(error);
    }
  },
);
router.patch(
  "/:id/reschedule",
  requirePermission("appointments.manage"),
  async (request, response, next) => {
    try {
      const parsed = z
        .object({ startAt: z.iso.datetime() })
        .safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({ message: "التاريخ والوقت غير صحيحين." });
        return;
      }
      if (new Date(parsed.data.startAt).getTime() < Date.now() - 60_000) {
        response.status(400).json({
          message: "لا يمكن نقل الموعد إلى وقت مضى، يرجى اختيار وقت لاحق.",
        });
        return;
      }
      const appointment = await rescheduleAppointment(
        request.params.id,
        parsed.data.startAt,
        request.currentUser!.id,
      );
      if (!appointment) {
        response.status(404).json({ message: "الموعد غير موجود." });
        return;
      }
      await logActivity(request, {
        action: "APPOINTMENT_RESCHEDULED",
        entityType: "appointment",
        entityId: appointment.id,
        patientId: appointment.patientId,
        details: { startAt: parsed.data.startAt },
      });
      response.json({ message: "تمت إعادة جدولة الموعد.", appointment });
    } catch (error) {
      if ((error as Error).message === "APPOINTMENT_CONFLICT") {
        response
          .status(409)
          .json({ message: "هذا الوقت محجوز بالفعل، يرجى اختيار وقت آخر." });
        return;
      }
      next(error);
    }
  },
);
export default router;
