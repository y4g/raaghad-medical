"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_crypto_1 = require("node:crypto");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = require("../db/client");
const auth_1 = require("../middleware/auth");
const activityService_1 = require("../services/activityService");
const router = (0, express_1.Router)();
const uuid = zod_1.z.uuid();
router.get("/", (0, auth_1.requirePermission)("settings.manage"), async (_req, res, next) => {
    try {
        const [doctors, users, roles, permissions, reasons, hours] = await Promise.all([
            client_1.db.query("SELECT id,full_name,specialty,phone,license_number,is_active FROM doctors ORDER BY is_active DESC,full_name"),
            client_1.db.query(`SELECT u.id,u.full_name,u.email,u.phone,u.is_active,r.id AS role_id,r.code AS role_code,r.name_ar AS role_name FROM users u JOIN roles r ON r.id=u.role_id ORDER BY u.is_active DESC,u.full_name`),
            client_1.db.query(`SELECT r.id,r.code,r.name_ar,r.description_ar,COALESCE(array_agg(p.code) FILTER(WHERE p.code IS NOT NULL),ARRAY[]::varchar[]) AS permissions FROM roles r LEFT JOIN role_permissions rp ON rp.role_id=r.id LEFT JOIN permissions p ON p.id=rp.permission_id GROUP BY r.id ORDER BY r.name_ar`),
            client_1.db.query("SELECT id,code,name_ar,category FROM permissions ORDER BY category,name_ar"),
            client_1.db.query("SELECT id,category,name_ar,usage_count,is_active,is_system FROM visit_reasons ORDER BY is_active DESC,usage_count DESC,name_ar"),
            client_1.db.query("SELECT * FROM working_hours ORDER BY doctor_id,day_of_week"),
        ]);
        res.json({
            doctors: doctors.rows.map((r) => ({
                id: r.id,
                fullName: r.full_name,
                specialty: r.specialty,
                phone: r.phone,
                licenseNumber: r.license_number,
                isActive: r.is_active,
            })),
            users: users.rows.map((r) => ({
                id: r.id,
                fullName: r.full_name,
                email: r.email,
                phone: r.phone,
                isActive: r.is_active,
                roleId: r.role_id,
                roleCode: r.role_code,
                roleName: r.role_name,
            })),
            roles: roles.rows.map((r) => ({
                id: r.id,
                code: r.code,
                nameAr: r.name_ar,
                descriptionAr: r.description_ar,
                permissions: r.permissions,
            })),
            permissions: permissions.rows.map((r) => ({
                id: r.id,
                code: r.code,
                nameAr: r.name_ar,
                category: r.category,
            })),
            reasons: reasons.rows.map((r) => ({
                id: r.id,
                category: r.category,
                nameAr: r.name_ar,
                usageCount: r.usage_count,
                isActive: r.is_active,
                isSystem: r.is_system,
            })),
            workingHours: hours.rows,
        });
    }
    catch (e) {
        next(e);
    }
});
const doctorSchema = zod_1.z.object({
    fullName: zod_1.z.string().trim().min(2).max(140),
    specialty: zod_1.z.string().trim().min(2).max(140),
    phone: zod_1.z.string().trim().max(30).nullable().optional(),
    licenseNumber: zod_1.z.string().trim().max(100).nullable().optional(),
    isActive: zod_1.z.boolean().default(true),
});
router.post("/doctors", (0, auth_1.requirePermission)("settings.manage"), async (req, res, next) => {
    try {
        const p = doctorSchema.safeParse(req.body);
        if (!p.success) {
            res.status(400).json({ message: "تحقق من بيانات الطبيب." });
            return;
        }
        const entityId = (0, node_crypto_1.randomUUID)();
        await client_1.db.query("INSERT INTO doctors (id,full_name,specialty,phone,license_number,is_active) VALUES ($1,$2,$3,$4,$5,$6)", [
            entityId,
            p.data.fullName,
            p.data.specialty,
            p.data.phone ?? null,
            p.data.licenseNumber ?? null,
            p.data.isActive,
        ]);
        await (0, activityService_1.logActivity)(req, {
            action: "DOCTOR_CREATED",
            entityType: "doctor",
            entityId,
        });
        res.status(201).json({ message: "تمت إضافة الطبيب." });
    }
    catch (e) {
        next(e);
    }
});
router.put("/doctors/:id", (0, auth_1.requirePermission)("settings.manage"), async (req, res, next) => {
    try {
        const p = doctorSchema.safeParse(req.body);
        if (!uuid.safeParse(req.params.id).success || !p.success) {
            res.status(400).json({ message: "تحقق من بيانات الطبيب." });
            return;
        }
        await client_1.db.query("UPDATE doctors SET full_name=$2,specialty=$3,phone=$4,license_number=$5,is_active=$6,updated_at=CURRENT_TIMESTAMP WHERE id=$1", [
            req.params.id,
            p.data.fullName,
            p.data.specialty,
            p.data.phone ?? null,
            p.data.licenseNumber ?? null,
            p.data.isActive,
        ]);
        await (0, activityService_1.logActivity)(req, {
            action: "DOCTOR_UPDATED",
            entityType: "doctor",
            entityId: req.params.id,
        });
        res.json({ message: "تم تحديث الطبيب." });
    }
    catch (e) {
        next(e);
    }
});
const userSchema = zod_1.z.object({
    fullName: zod_1.z.string().trim().min(2).max(140),
    email: zod_1.z.email(),
    password: zod_1.z.string().min(12).max(128),
    roleId: zod_1.z.uuid(),
    phone: zod_1.z.string().trim().max(30).nullable().optional(),
});
router.post("/users", (0, auth_1.requirePermission)("users.manage"), async (req, res, next) => {
    try {
        const p = userSchema.safeParse(req.body);
        if (!p.success) {
            res
                .status(400)
                .json({ message: "تحقق من بيانات المستخدم وكلمة المرور." });
            return;
        }
        const entityId = (0, node_crypto_1.randomUUID)();
        await client_1.db.query("INSERT INTO users (id,full_name,email,password_hash,role_id,phone) VALUES ($1,$2,$3,$4,$5,$6)", [
            entityId,
            p.data.fullName,
            p.data.email.toLowerCase(),
            await bcryptjs_1.default.hash(p.data.password, 12),
            p.data.roleId,
            p.data.phone ?? null,
        ]);
        await (0, activityService_1.logActivity)(req, {
            action: "USER_CREATED",
            entityType: "user",
            entityId,
        });
        res.status(201).json({ message: "تم إنشاء المستخدم." });
    }
    catch (e) {
        if (e.code === "23505") {
            res.status(409).json({ message: "البريد الإلكتروني مستخدم." });
            return;
        }
        next(e);
    }
});
router.patch("/users/:id", (0, auth_1.requirePermission)("users.manage"), async (req, res, next) => {
    try {
        const p = zod_1.z
            .object({ roleId: zod_1.z.uuid(), isActive: zod_1.z.boolean() })
            .safeParse(req.body);
        if (!uuid.safeParse(req.params.id).success || !p.success) {
            res.status(400).json({ message: "بيانات المستخدم غير صحيحة." });
            return;
        }
        if (req.params.id === req.currentUser.id && !p.data.isActive) {
            res.status(409).json({ message: "لا يمكنك تعطيل حسابك الحالي." });
            return;
        }
        await client_1.db.query("UPDATE users SET role_id=$2,is_active=$3,updated_at=CURRENT_TIMESTAMP WHERE id=$1", [req.params.id, p.data.roleId, p.data.isActive]);
        await (0, activityService_1.logActivity)(req, {
            action: "USER_UPDATED",
            entityType: "user",
            entityId: req.params.id,
        });
        res.json({ message: "تم تحديث المستخدم." });
    }
    catch (e) {
        next(e);
    }
});
router.put("/roles/:id/permissions", (0, auth_1.requirePermission)("users.manage"), async (req, res, next) => {
    try {
        const p = zod_1.z
            .object({ permissions: zod_1.z.array(zod_1.z.string().max(100)).max(100) })
            .safeParse(req.body);
        if (!uuid.safeParse(req.params.id).success || !p.success) {
            res.status(400).json({ message: "بيانات الصلاحيات غير صحيحة." });
            return;
        }
        await client_1.db.query("BEGIN");
        try {
            await client_1.db.query("DELETE FROM role_permissions WHERE role_id=$1", [
                req.params.id,
            ]);
            await client_1.db.query(`INSERT INTO role_permissions (role_id,permission_id) SELECT $1,id FROM permissions WHERE code=ANY($2::varchar[])`, [req.params.id, p.data.permissions]);
            await client_1.db.query("COMMIT");
        }
        catch (e) {
            await client_1.db.query("ROLLBACK");
            throw e;
        }
        await (0, activityService_1.logActivity)(req, {
            action: "ROLE_PERMISSIONS_UPDATED",
            entityType: "role",
            entityId: req.params.id,
        });
        res.json({ message: "تم حفظ الصلاحيات." });
    }
    catch (e) {
        next(e);
    }
});
const reasonSchema = zod_1.z.object({
    category: zod_1.z.string().trim().min(2).max(100),
    nameAr: zod_1.z.string().trim().min(2).max(180),
    isActive: zod_1.z.boolean().default(true),
});
router.post("/reasons", (0, auth_1.requirePermission)("settings.manage"), async (req, res, next) => {
    try {
        const p = reasonSchema.safeParse(req.body);
        if (!p.success) {
            res.status(400).json({ message: "تحقق من سبب الزيارة." });
            return;
        }
        const entityId = (0, node_crypto_1.randomUUID)();
        await client_1.db.query("INSERT INTO visit_reasons (id,category,name_ar,is_active,is_system) VALUES ($1,$2,$3,$4,FALSE)", [entityId, p.data.category, p.data.nameAr, p.data.isActive]);
        await (0, activityService_1.logActivity)(req, {
            action: "VISIT_REASON_CREATED",
            entityType: "visit_reason",
            entityId,
        });
        res.status(201).json({ message: "تمت إضافة سبب الزيارة." });
    }
    catch (e) {
        if (e.code === "23505") {
            res.status(409).json({ message: "سبب الزيارة موجود بالفعل." });
            return;
        }
        next(e);
    }
});
router.put("/reasons/:id", (0, auth_1.requirePermission)("settings.manage"), async (req, res, next) => {
    try {
        const p = reasonSchema.safeParse(req.body);
        if (!uuid.safeParse(req.params.id).success || !p.success) {
            res.status(400).json({ message: "تحقق من سبب الزيارة." });
            return;
        }
        await client_1.db.query("UPDATE visit_reasons SET category=$2,name_ar=$3,is_active=$4 WHERE id=$1", [req.params.id, p.data.category, p.data.nameAr, p.data.isActive]);
        await (0, activityService_1.logActivity)(req, {
            action: "VISIT_REASON_UPDATED",
            entityType: "visit_reason",
            entityId: req.params.id,
        });
        res.json({ message: "تم تحديث سبب الزيارة." });
    }
    catch (e) {
        next(e);
    }
});
router.put("/working-hours/:doctorId", (0, auth_1.requirePermission)("settings.manage"), async (req, res, next) => {
    try {
        const p = zod_1.z
            .object({
            hours: zod_1.z
                .array(zod_1.z.object({
                dayOfWeek: zod_1.z.number().int().min(0).max(6),
                startTime: zod_1.z.string().regex(/^\d{2}:\d{2}$/),
                endTime: zod_1.z.string().regex(/^\d{2}:\d{2}$/),
                isWorking: zod_1.z.boolean(),
            }))
                .length(7),
        })
            .safeParse(req.body);
        if (!uuid.safeParse(req.params.doctorId).success || !p.success) {
            res.status(400).json({ message: "ساعات العمل غير صحيحة." });
            return;
        }
        await client_1.db.query("BEGIN");
        try {
            await client_1.db.query("DELETE FROM working_hours WHERE doctor_id=$1", [
                req.params.doctorId,
            ]);
            for (const h of p.data.hours)
                await client_1.db.query("INSERT INTO working_hours (id,doctor_id,day_of_week,start_time,end_time,is_working) VALUES ($1,$2,$3,$4,$5,$6)", [
                    (0, node_crypto_1.randomUUID)(),
                    req.params.doctorId,
                    h.dayOfWeek,
                    h.startTime,
                    h.endTime,
                    h.isWorking,
                ]);
            await client_1.db.query("COMMIT");
        }
        catch (e) {
            await client_1.db.query("ROLLBACK");
            throw e;
        }
        res.json({ message: "تم حفظ ساعات العمل." });
    }
    catch (e) {
        next(e);
    }
});
exports.default = router;
