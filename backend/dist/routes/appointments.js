"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const appointmentRepository_1 = require("../repositories/appointmentRepository");
const activityService_1 = require("../services/activityService");
const router = (0, express_1.Router)();
const appointmentSchema = zod_1.z
    .object({
    patientId: zod_1.z.uuid(),
    doctorId: zod_1.z.uuid().optional(),
    visitReasonId: zod_1.z.uuid().optional(),
    customReason: zod_1.z.string().trim().max(500).optional(),
    startAt: zod_1.z.iso.datetime(),
    durationMinutes: zod_1.z.number().int().min(5).max(480).default(30),
    priority: zod_1.z.enum(["NORMAL", "URGENT", "EMERGENCY"]).default("NORMAL"),
    receptionNotes: zod_1.z.string().max(2000).optional(),
    additionalNotes: zod_1.z.string().max(2000).optional(),
})
    .refine((value) => value.visitReasonId || value.customReason, {
    message: "اختر سبب الزيارة أو اكتبه.",
});
const statusSchema = zod_1.z.object({
    status: zod_1.z.enum([
        "BOOKED",
        "ARRIVED",
        "WAITING",
        "WITH_DOCTOR",
        "COMPLETED",
        "NO_SHOW",
        "CANCELLED",
        "POSTPONED",
    ]),
    note: zod_1.z.string().max(1000).optional(),
});
router.get("/options", (0, auth_1.requirePermission)("appointments.view"), async (_request, response, next) => {
    try {
        response.json(await (0, appointmentRepository_1.listAppointmentOptions)());
    }
    catch (error) {
        next(error);
    }
});
router.get("/", (0, auth_1.requirePermission)("appointments.view"), async (request, response, next) => {
    try {
        const from = String(request.query.from || "");
        const to = String(request.query.to || "");
        if (!zod_1.z.iso.datetime().safeParse(from).success ||
            !zod_1.z.iso.datetime().safeParse(to).success) {
            response.status(400).json({ message: "الفترة الزمنية غير صحيحة." });
            return;
        }
        response.json({ items: await (0, appointmentRepository_1.listAppointments)(from, to) });
    }
    catch (error) {
        next(error);
    }
});
router.post("/", (0, auth_1.requirePermission)("appointments.manage"), async (request, response, next) => {
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
        const appointment = await (0, appointmentRepository_1.createAppointment)(parsed.data, request.currentUser.id);
        await (0, activityService_1.logActivity)(request, {
            action: "APPOINTMENT_CREATED",
            entityType: "appointment",
            entityId: appointment.id,
            patientId: appointment.patientId,
        });
        response
            .status(201)
            .json({ message: "تم حجز الموعد بنجاح.", appointment });
    }
    catch (error) {
        if (error.message === "APPOINTMENT_CONFLICT") {
            response
                .status(409)
                .json({ message: "هذا الوقت محجوز بالفعل، يرجى اختيار وقت آخر." });
            return;
        }
        next(error);
    }
});
router.patch("/:id/status", (0, auth_1.requirePermission)("appointments.manage"), async (request, response, next) => {
    try {
        const parsed = statusSchema.safeParse(request.body);
        if (!parsed.success) {
            response.status(400).json({ message: "حالة الموعد غير صحيحة." });
            return;
        }
        const result = await (0, appointmentRepository_1.changeAppointmentStatus)(request.params.id, parsed.data.status, request.currentUser.id, parsed.data.note);
        if (!result) {
            response.status(404).json({ message: "الموعد غير موجود." });
            return;
        }
        await (0, activityService_1.logActivity)(request, {
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
    }
    catch (error) {
        next(error);
    }
});
router.post("/:id/status/undo", (0, auth_1.requirePermission)("appointments.manage"), async (request, response, next) => {
    try {
        const appointment = await (0, appointmentRepository_1.undoAppointmentStatus)(request.params.id, request.currentUser.id);
        if (!appointment) {
            response.status(409).json({
                message: "انتهت مهلة التراجع أو لا توجد عملية قابلة للتراجع.",
            });
            return;
        }
        await (0, activityService_1.logActivity)(request, {
            action: "APPOINTMENT_STATUS_UNDONE",
            entityType: "appointment",
            entityId: appointment.id,
            patientId: appointment.patientId,
        });
        response.json({ message: "تم التراجع عن تغيير الحالة.", appointment });
    }
    catch (error) {
        next(error);
    }
});
router.patch("/:id/reschedule", (0, auth_1.requirePermission)("appointments.manage"), async (request, response, next) => {
    try {
        const parsed = zod_1.z
            .object({ startAt: zod_1.z.iso.datetime() })
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
        const appointment = await (0, appointmentRepository_1.rescheduleAppointment)(request.params.id, parsed.data.startAt, request.currentUser.id);
        if (!appointment) {
            response.status(404).json({ message: "الموعد غير موجود." });
            return;
        }
        await (0, activityService_1.logActivity)(request, {
            action: "APPOINTMENT_RESCHEDULED",
            entityType: "appointment",
            entityId: appointment.id,
            patientId: appointment.patientId,
            details: { startAt: parsed.data.startAt },
        });
        response.json({ message: "تمت إعادة جدولة الموعد.", appointment });
    }
    catch (error) {
        if (error.message === "APPOINTMENT_CONFLICT") {
            response
                .status(409)
                .json({ message: "هذا الوقت محجوز بالفعل، يرجى اختيار وقت آخر." });
            return;
        }
        next(error);
    }
});
exports.default = router;
