"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_crypto_1 = require("node:crypto");
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = require("../db/client");
const auth_1 = require("../middleware/auth");
const activityService_1 = require("../services/activityService");
const router = (0, express_1.Router)();
const id = zod_1.z.uuid();
router.get("/followups", (0, auth_1.requirePermission)("followups.manage"), async (_req, res, next) => {
    try {
        const result = await client_1.db.query(`SELECT f.*,p.full_name AS patient_name,p.medical_number FROM followups f JOIN patients p ON p.id=f.patient_id ORDER BY CASE WHEN f.status IN ('COMPLETED','CANCELLED') THEN 1 ELSE 0 END,f.due_at`);
        res.json({
            items: result.rows.map((r) => ({
                id: r.id,
                visitId: r.visit_id,
                patientId: r.patient_id,
                patientName: r.patient_name,
                patientMedicalNumber: r.medical_number,
                reason: r.reason,
                dueAt: r.due_at,
                status: ["COMPLETED", "CANCELLED"].includes(r.status)
                    ? r.status
                    : new Date(r.due_at) < new Date()
                        ? "OVERDUE"
                        : r.status,
                notes: r.notes,
                createdAt: r.created_at,
            })),
        });
    }
    catch (e) {
        next(e);
    }
});
router.patch("/followups/:id", (0, auth_1.requirePermission)("followups.manage"), async (req, res, next) => {
    try {
        if (!id.safeParse(req.params.id).success ||
            !zod_1.z
                .enum(["UPCOMING", "COMPLETED", "CANCELLED"])
                .safeParse(req.body.status).success) {
            res.status(400).json({ message: "بيانات المتابعة غير صحيحة." });
            return;
        }
        const result = await client_1.db.query(`UPDATE followups SET status=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1`, [req.params.id, req.body.status]);
        if (!result.rowCount) {
            res.status(404).json({ message: "المتابعة غير موجودة." });
            return;
        }
        await (0, activityService_1.logActivity)(req, {
            action: "FOLLOWUP_STATUS_CHANGED",
            entityType: "followup",
            entityId: req.params.id,
        });
        res.json({ message: "تم تحديث حالة المتابعة." });
    }
    catch (e) {
        next(e);
    }
});
router.get("/waitlist", (0, auth_1.requirePermission)("waitlist.manage"), async (_req, res, next) => {
    try {
        const result = await client_1.db.query(`SELECT w.*,p.full_name AS patient_name,p.medical_number FROM waitlist_entries w JOIN patients p ON p.id=w.patient_id WHERE w.arrived_at>=CURRENT_DATE ORDER BY CASE w.priority WHEN 'EMERGENCY' THEN 1 WHEN 'URGENT' THEN 2 ELSE 3 END,w.arrived_at`);
        res.json({
            items: result.rows.map((r) => ({
                id: r.id,
                patientId: r.patient_id,
                patientName: r.patient_name,
                patientMedicalNumber: r.medical_number,
                reason: r.reason,
                priority: r.priority,
                notes: r.notes,
                status: r.status,
                arrivedAt: r.arrived_at,
                appointmentId: r.appointment_id,
            })),
        });
    }
    catch (e) {
        next(e);
    }
});
router.post("/waitlist", (0, auth_1.requirePermission)("waitlist.manage"), async (req, res, next) => {
    try {
        const parsed = zod_1.z
            .object({
            patientId: zod_1.z.uuid(),
            reason: zod_1.z.string().trim().min(2).max(1000),
            priority: zod_1.z.enum(["NORMAL", "URGENT", "EMERGENCY"]),
            notes: zod_1.z.string().trim().max(2000).nullable().optional(),
        })
            .safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ message: "تحقق من بيانات قائمة الانتظار." });
            return;
        }
        const entityId = (0, node_crypto_1.randomUUID)();
        await client_1.db.query(`INSERT INTO waitlist_entries (id,patient_id,reason,priority,notes,created_by) VALUES ($1,$2,$3,$4,$5,$6)`, [
            entityId,
            parsed.data.patientId,
            parsed.data.reason,
            parsed.data.priority,
            parsed.data.notes ?? null,
            req.currentUser.id,
        ]);
        await (0, activityService_1.logActivity)(req, {
            action: "WAITLIST_CREATED",
            entityType: "waitlist_entry",
            entityId,
            patientId: parsed.data.patientId,
        });
        res.status(201).json({ message: "تمت إضافة المريض إلى قائمة الانتظار." });
    }
    catch (e) {
        next(e);
    }
});
router.patch("/waitlist/:id", (0, auth_1.requirePermission)("waitlist.manage"), async (req, res, next) => {
    try {
        const status = zod_1.z
            .enum(["WAITING", "CALLED", "CONVERTED", "CANCELLED"])
            .safeParse(req.body.status);
        if (!id.safeParse(req.params.id).success || !status.success) {
            res.status(400).json({ message: "الحالة غير صحيحة." });
            return;
        }
        await client_1.db.query("UPDATE waitlist_entries SET status=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1", [req.params.id, status.data]);
        await (0, activityService_1.logActivity)(req, {
            action: "WAITLIST_STATUS_CHANGED",
            entityType: "waitlist_entry",
            entityId: req.params.id,
        });
        res.json({ message: "تم تحديث قائمة الانتظار." });
    }
    catch (e) {
        next(e);
    }
});
router.get("/reports", (0, auth_1.requirePermission)("reports.view"), async (req, res, next) => {
    try {
        const from = String(req.query.from || new Date(Date.now() - 30 * 86400000).toISOString());
        const to = String(req.query.to || new Date().toISOString());
        const [patients, newPatients, appointments, completed, cancelled, noShow, followups, reasons, days,] = await Promise.all([
            client_1.db.query("SELECT COUNT(*)::int AS count FROM patients WHERE is_archived=FALSE"),
            client_1.db.query("SELECT COUNT(*)::int AS count FROM patients WHERE created_at BETWEEN $1 AND $2", [from, to]),
            client_1.db.query("SELECT COUNT(*)::int AS count FROM appointments WHERE start_at BETWEEN $1 AND $2", [from, to]),
            client_1.db.query(`SELECT COUNT(*)::int AS count FROM visits WHERE started_at BETWEEN $1 AND $2`, [from, to]),
            client_1.db.query(`SELECT COUNT(*)::int AS count FROM appointments WHERE status='CANCELLED' AND start_at BETWEEN $1 AND $2`, [from, to]),
            client_1.db.query(`SELECT COUNT(*)::int AS count FROM appointments WHERE status='NO_SHOW' AND start_at BETWEEN $1 AND $2`, [from, to]),
            client_1.db.query("SELECT COUNT(*)::int AS count FROM followups WHERE due_at BETWEEN $1 AND $2", [from, to]),
            client_1.db.query(`SELECT COALESCE(vr.name_ar,a.custom_reason,'استشارة عامة') AS name,COUNT(*)::int AS count FROM appointments a LEFT JOIN visit_reasons vr ON vr.id=a.visit_reason_id WHERE a.start_at BETWEEN $1 AND $2 GROUP BY 1 ORDER BY 2 DESC LIMIT 8`, [from, to]),
            client_1.db.query(`SELECT TO_CHAR(started_at,'YYYY-MM-DD') AS day,COUNT(*)::int AS count FROM visits WHERE started_at BETWEEN $1 AND $2 GROUP BY 1 ORDER BY 1`, [from, to]),
        ]);
        res.json({
            summary: {
                totalPatients: patients.rows[0].count,
                newPatients: newPatients.rows[0].count,
                totalAppointments: appointments.rows[0].count,
                completedVisits: completed.rows[0].count,
                cancelled: cancelled.rows[0].count,
                noShow: noShow.rows[0].count,
                followups: followups.rows[0].count,
                topReasons: reasons.rows,
                visitsByDay: days.rows,
            },
        });
    }
    catch (e) {
        next(e);
    }
});
router.get("/activity", (0, auth_1.requirePermission)("activity.view"), async (_req, res, next) => {
    try {
        const result = await client_1.db.query(`SELECT a.id,a.action,a.entity_type,a.created_at,u.full_name,p.full_name AS patient_name FROM activity_logs a LEFT JOIN users u ON u.id=a.user_id LEFT JOIN patients p ON p.id=a.patient_id ORDER BY a.created_at DESC LIMIT 100`);
        res.json({
            items: result.rows.map((r) => ({
                id: r.id,
                action: r.action,
                entityType: r.entity_type,
                createdAt: r.created_at,
                userName: r.full_name,
                patientName: r.patient_name,
            })),
        });
    }
    catch (e) {
        next(e);
    }
});
router.get("/settings", async (_req, res, next) => {
    try {
        const result = await client_1.db.query("SELECT key,value FROM clinic_settings ORDER BY key");
        res.json({
            settings: Object.fromEntries(result.rows.map((r) => [r.key, r.value])),
        });
    }
    catch (e) {
        next(e);
    }
});
router.put("/settings/:key", (0, auth_1.requirePermission)("settings.manage"), async (req, res, next) => {
    try {
        if (!/^[a-z_]{3,100}$/.test(req.params.key) ||
            typeof req.body.value !== "object") {
            res.status(400).json({ message: "بيانات الإعداد غير صحيحة." });
            return;
        }
        await client_1.db.query(`INSERT INTO clinic_settings (key,value,updated_by) VALUES ($1,$2::jsonb,$3) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_by=EXCLUDED.updated_by,updated_at=CURRENT_TIMESTAMP`, [req.params.key, JSON.stringify(req.body.value), req.currentUser.id]);
        await (0, activityService_1.logActivity)(req, {
            action: "SETTINGS_UPDATED",
            entityType: "clinic_settings",
            details: { key: req.params.key },
        });
        res.json({ message: "تم حفظ الإعدادات." });
    }
    catch (e) {
        next(e);
    }
});
router.get("/notifications", async (req, res, next) => {
    try {
        const [stored, soon, late, overdue, noShow] = await Promise.all([
            client_1.db.query(`SELECT id,type,title_ar,message_ar,entity_type,entity_id,is_read,created_at FROM notifications WHERE user_id IS NULL OR user_id=$1 ORDER BY created_at DESC LIMIT 30`, [req.currentUser.id]),
            client_1.db.query(`SELECT a.id,p.full_name,a.start_at FROM appointments a JOIN patients p ON p.id=a.patient_id WHERE a.status='BOOKED' AND a.start_at BETWEEN CURRENT_TIMESTAMP AND CURRENT_TIMESTAMP+INTERVAL '2 hours' ORDER BY a.start_at`),
            client_1.db.query(`SELECT a.id,p.full_name,a.start_at FROM appointments a JOIN patients p ON p.id=a.patient_id WHERE a.status='BOOKED' AND a.start_at<CURRENT_TIMESTAMP AND a.start_at>=CURRENT_DATE ORDER BY a.start_at`),
            client_1.db.query(`SELECT f.id,p.full_name,f.due_at,f.reason FROM followups f JOIN patients p ON p.id=f.patient_id WHERE f.status NOT IN ('COMPLETED','CANCELLED') AND f.due_at<CURRENT_TIMESTAMP ORDER BY f.due_at LIMIT 20`),
            client_1.db.query(`SELECT a.id,p.full_name,a.start_at FROM appointments a JOIN patients p ON p.id=a.patient_id WHERE a.status='NO_SHOW' AND a.start_at>=CURRENT_DATE ORDER BY a.start_at`),
        ]);
        const dynamic = [
            ...soon.rows.map((r) => ({
                id: `soon-${r.id}`,
                type: "APPOINTMENT_SOON",
                title: "موعد قريب",
                message: `موعد ${r.full_name} خلال أقل من ساعتين`,
                entityType: "appointment",
                entityId: r.id,
                isRead: false,
                createdAt: r.start_at,
            })),
            ...late.rows.map((r) => ({
                id: `late-${r.id}`,
                type: "PATIENT_LATE",
                title: "مريض متأخر",
                message: `تأخر ${r.full_name} عن موعده`,
                entityType: "appointment",
                entityId: r.id,
                isRead: false,
                createdAt: r.start_at,
            })),
            ...overdue.rows.map((r) => ({
                id: `followup-${r.id}`,
                type: "FOLLOWUP_OVERDUE",
                title: "متابعة متأخرة",
                message: `متابعة ${r.full_name}: ${r.reason}`,
                entityType: "followup",
                entityId: r.id,
                isRead: false,
                createdAt: r.due_at,
            })),
            ...noShow.rows.map((r) => ({
                id: `noshow-${r.id}`,
                type: "NO_SHOW",
                title: "لم يحضر",
                message: `لم يحضر ${r.full_name} إلى موعده`,
                entityType: "appointment",
                entityId: r.id,
                isRead: false,
                createdAt: r.start_at,
            })),
        ];
        const saved = stored.rows.map((r) => ({
            id: r.id,
            type: r.type,
            title: r.title_ar,
            message: r.message_ar,
            entityType: r.entity_type,
            entityId: r.entity_id,
            isRead: r.is_read,
            createdAt: r.created_at,
        }));
        res.json({
            items: [...dynamic, ...saved].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
            unread: dynamic.length + saved.filter((x) => !x.isRead).length,
        });
    }
    catch (e) {
        next(e);
    }
});
router.patch("/notifications/:id/read", async (req, res, next) => {
    try {
        if (!id.safeParse(req.params.id).success) {
            res.json({ message: "تمت القراءة." });
            return;
        }
        await client_1.db.query("UPDATE notifications SET is_read=TRUE WHERE id=$1 AND (user_id IS NULL OR user_id=$2)", [req.params.id, req.currentUser.id]);
        res.json({ message: "تمت القراءة." });
    }
    catch (e) {
        next(e);
    }
});
router.get("/search", (0, auth_1.requirePermission)("patients.view"), async (req, res, next) => {
    try {
        const q = String(req.query.q || "").trim();
        if (q.length < 2) {
            res.json({ patients: [], appointments: [], visits: [] });
            return;
        }
        const term = `%${q.replace(/[%_]/g, "\\$&")}%`;
        const [patients, appointments, visits] = await Promise.all([
            client_1.db.query(`SELECT id,full_name,medical_number,phone FROM patients WHERE is_archived=FALSE AND (full_name ILIKE $1 ESCAPE '\\' OR phone ILIKE $1 ESCAPE '\\' OR medical_number ILIKE $1 ESCAPE '\\' OR national_id ILIKE $1 ESCAPE '\\') ORDER BY full_name LIMIT 8`, [term]),
            client_1.db.query(`SELECT a.id,a.patient_id,p.full_name,a.start_at,a.status FROM appointments a JOIN patients p ON p.id=a.patient_id WHERE p.full_name ILIKE $1 ESCAPE '\\' ORDER BY a.start_at DESC LIMIT 6`, [term]),
            client_1.db.query(`SELECT v.id,v.patient_id,p.full_name,v.visit_reason,v.started_at FROM visits v JOIN patients p ON p.id=v.patient_id WHERE p.full_name ILIKE $1 ESCAPE '\\' OR v.visit_reason ILIKE $1 ESCAPE '\\' ORDER BY v.started_at DESC LIMIT 6`, [term]),
        ]);
        res.json({
            patients: patients.rows.map((r) => ({
                id: r.id,
                fullName: r.full_name,
                medicalNumber: r.medical_number,
                phone: r.phone,
            })),
            appointments: appointments.rows.map((r) => ({
                id: r.id,
                patientId: r.patient_id,
                patientName: r.full_name,
                startAt: r.start_at,
                status: r.status,
            })),
            visits: visits.rows.map((r) => ({
                id: r.id,
                patientId: r.patient_id,
                patientName: r.full_name,
                reason: r.visit_reason,
                startedAt: r.started_at,
            })),
        });
    }
    catch (e) {
        next(e);
    }
});
exports.default = router;
