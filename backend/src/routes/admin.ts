import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client";
import { requirePermission } from "../middleware/auth";
import { logActivity } from "../services/activityService";
const router = Router();
const uuid = z.uuid();
router.get(
  "/",
  requirePermission("settings.manage"),
  async (_req, res, next) => {
    try {
      const [doctors, users, roles, permissions, reasons, hours] =
        await Promise.all([
          db.query<any>(
            "SELECT id,full_name,specialty,phone,license_number,is_active FROM doctors ORDER BY is_active DESC,full_name",
          ),
          db.query<any>(
            `SELECT u.id,u.full_name,u.email,u.phone,u.is_active,r.id AS role_id,r.code AS role_code,r.name_ar AS role_name FROM users u JOIN roles r ON r.id=u.role_id ORDER BY u.is_active DESC,u.full_name`,
          ),
          db.query<any>(
            `SELECT r.id,r.code,r.name_ar,r.description_ar,COALESCE(array_agg(p.code) FILTER(WHERE p.code IS NOT NULL),ARRAY[]::varchar[]) AS permissions FROM roles r LEFT JOIN role_permissions rp ON rp.role_id=r.id LEFT JOIN permissions p ON p.id=rp.permission_id GROUP BY r.id ORDER BY r.name_ar`,
          ),
          db.query<any>(
            "SELECT id,code,name_ar,category FROM permissions ORDER BY category,name_ar",
          ),
          db.query<any>(
            "SELECT id,category,name_ar,usage_count,is_active,is_system FROM visit_reasons ORDER BY is_active DESC,usage_count DESC,name_ar",
          ),
          db.query<any>(
            "SELECT * FROM working_hours ORDER BY doctor_id,day_of_week",
          ),
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
    } catch (e) {
      next(e);
    }
  },
);
const doctorSchema = z.object({
  fullName: z.string().trim().min(2).max(140),
  specialty: z.string().trim().min(2).max(140),
  phone: z.string().trim().max(30).nullable().optional(),
  licenseNumber: z.string().trim().max(100).nullable().optional(),
  isActive: z.boolean().default(true),
});
router.post(
  "/doctors",
  requirePermission("settings.manage"),
  async (req, res, next) => {
    try {
      const p = doctorSchema.safeParse(req.body);
      if (!p.success) {
        res.status(400).json({ message: "تحقق من بيانات الطبيب." });
        return;
      }
      const entityId = randomUUID();
      await db.query(
        "INSERT INTO doctors (id,full_name,specialty,phone,license_number,is_active) VALUES ($1,$2,$3,$4,$5,$6)",
        [
          entityId,
          p.data.fullName,
          p.data.specialty,
          p.data.phone ?? null,
          p.data.licenseNumber ?? null,
          p.data.isActive,
        ],
      );
      await logActivity(req, {
        action: "DOCTOR_CREATED",
        entityType: "doctor",
        entityId,
      });
      res.status(201).json({ message: "تمت إضافة الطبيب." });
    } catch (e) {
      next(e);
    }
  },
);
router.put(
  "/doctors/:id",
  requirePermission("settings.manage"),
  async (req, res, next) => {
    try {
      const p = doctorSchema.safeParse(req.body);
      if (!uuid.safeParse(req.params.id).success || !p.success) {
        res.status(400).json({ message: "تحقق من بيانات الطبيب." });
        return;
      }
      await db.query(
        "UPDATE doctors SET full_name=$2,specialty=$3,phone=$4,license_number=$5,is_active=$6,updated_at=CURRENT_TIMESTAMP WHERE id=$1",
        [
          req.params.id,
          p.data.fullName,
          p.data.specialty,
          p.data.phone ?? null,
          p.data.licenseNumber ?? null,
          p.data.isActive,
        ],
      );
      await logActivity(req, {
        action: "DOCTOR_UPDATED",
        entityType: "doctor",
        entityId: req.params.id,
      });
      res.json({ message: "تم تحديث الطبيب." });
    } catch (e) {
      next(e);
    }
  },
);
const userSchema = z.object({
  fullName: z.string().trim().min(2).max(140),
  email: z.email(),
  password: z.string().min(12).max(128),
  roleId: z.uuid(),
  phone: z.string().trim().max(30).nullable().optional(),
});
router.post(
  "/users",
  requirePermission("users.manage"),
  async (req, res, next) => {
    try {
      const p = userSchema.safeParse(req.body);
      if (!p.success) {
        res
          .status(400)
          .json({ message: "تحقق من بيانات المستخدم وكلمة المرور." });
        return;
      }
      const entityId = randomUUID();
      await db.query(
        "INSERT INTO users (id,full_name,email,password_hash,role_id,phone) VALUES ($1,$2,$3,$4,$5,$6)",
        [
          entityId,
          p.data.fullName,
          p.data.email.toLowerCase(),
          await bcrypt.hash(p.data.password, 12),
          p.data.roleId,
          p.data.phone ?? null,
        ],
      );
      await logActivity(req, {
        action: "USER_CREATED",
        entityType: "user",
        entityId,
      });
      res.status(201).json({ message: "تم إنشاء المستخدم." });
    } catch (e) {
      if ((e as any).code === "23505") {
        res.status(409).json({ message: "البريد الإلكتروني مستخدم." });
        return;
      }
      next(e);
    }
  },
);
router.patch(
  "/users/:id",
  requirePermission("users.manage"),
  async (req, res, next) => {
    try {
      const p = z
        .object({ roleId: z.uuid(), isActive: z.boolean() })
        .safeParse(req.body);
      if (!uuid.safeParse(req.params.id).success || !p.success) {
        res.status(400).json({ message: "بيانات المستخدم غير صحيحة." });
        return;
      }
      if (req.params.id === req.currentUser!.id && !p.data.isActive) {
        res.status(409).json({ message: "لا يمكنك تعطيل حسابك الحالي." });
        return;
      }
      await db.query(
        "UPDATE users SET role_id=$2,is_active=$3,updated_at=CURRENT_TIMESTAMP WHERE id=$1",
        [req.params.id, p.data.roleId, p.data.isActive],
      );
      await logActivity(req, {
        action: "USER_UPDATED",
        entityType: "user",
        entityId: req.params.id,
      });
      res.json({ message: "تم تحديث المستخدم." });
    } catch (e) {
      next(e);
    }
  },
);
router.put(
  "/roles/:id/permissions",
  requirePermission("users.manage"),
  async (req, res, next) => {
    try {
      const p = z
        .object({ permissions: z.array(z.string().max(100)).max(100) })
        .safeParse(req.body);
      if (!uuid.safeParse(req.params.id).success || !p.success) {
        res.status(400).json({ message: "بيانات الصلاحيات غير صحيحة." });
        return;
      }
      await db.query("BEGIN");
      try {
        await db.query("DELETE FROM role_permissions WHERE role_id=$1", [
          req.params.id,
        ]);
        await db.query(
          `INSERT INTO role_permissions (role_id,permission_id) SELECT $1,id FROM permissions WHERE code=ANY($2::varchar[])`,
          [req.params.id, p.data.permissions],
        );
        await db.query("COMMIT");
      } catch (e) {
        await db.query("ROLLBACK");
        throw e;
      }
      await logActivity(req, {
        action: "ROLE_PERMISSIONS_UPDATED",
        entityType: "role",
        entityId: req.params.id,
      });
      res.json({ message: "تم حفظ الصلاحيات." });
    } catch (e) {
      next(e);
    }
  },
);
const reasonSchema = z.object({
  category: z.string().trim().min(2).max(100),
  nameAr: z.string().trim().min(2).max(180),
  isActive: z.boolean().default(true),
});
router.post(
  "/reasons",
  requirePermission("settings.manage"),
  async (req, res, next) => {
    try {
      const p = reasonSchema.safeParse(req.body);
      if (!p.success) {
        res.status(400).json({ message: "تحقق من سبب الزيارة." });
        return;
      }
      const entityId = randomUUID();
      await db.query(
        "INSERT INTO visit_reasons (id,category,name_ar,is_active,is_system) VALUES ($1,$2,$3,$4,FALSE)",
        [entityId, p.data.category, p.data.nameAr, p.data.isActive],
      );
      await logActivity(req, {
        action: "VISIT_REASON_CREATED",
        entityType: "visit_reason",
        entityId,
      });
      res.status(201).json({ message: "تمت إضافة سبب الزيارة." });
    } catch (e) {
      if ((e as any).code === "23505") {
        res.status(409).json({ message: "سبب الزيارة موجود بالفعل." });
        return;
      }
      next(e);
    }
  },
);
router.put(
  "/reasons/:id",
  requirePermission("settings.manage"),
  async (req, res, next) => {
    try {
      const p = reasonSchema.safeParse(req.body);
      if (!uuid.safeParse(req.params.id).success || !p.success) {
        res.status(400).json({ message: "تحقق من سبب الزيارة." });
        return;
      }
      await db.query(
        "UPDATE visit_reasons SET category=$2,name_ar=$3,is_active=$4 WHERE id=$1",
        [req.params.id, p.data.category, p.data.nameAr, p.data.isActive],
      );
      await logActivity(req, {
        action: "VISIT_REASON_UPDATED",
        entityType: "visit_reason",
        entityId: req.params.id,
      });
      res.json({ message: "تم تحديث سبب الزيارة." });
    } catch (e) {
      next(e);
    }
  },
);
router.put(
  "/working-hours/:doctorId",
  requirePermission("settings.manage"),
  async (req, res, next) => {
    try {
      const p = z
        .object({
          hours: z
            .array(
              z.object({
                dayOfWeek: z.number().int().min(0).max(6),
                startTime: z.string().regex(/^\d{2}:\d{2}$/),
                endTime: z.string().regex(/^\d{2}:\d{2}$/),
                isWorking: z.boolean(),
              }),
            )
            .length(7),
        })
        .safeParse(req.body);
      if (!uuid.safeParse(req.params.doctorId).success || !p.success) {
        res.status(400).json({ message: "ساعات العمل غير صحيحة." });
        return;
      }
      await db.query("BEGIN");
      try {
        await db.query("DELETE FROM working_hours WHERE doctor_id=$1", [
          req.params.doctorId,
        ]);
        for (const h of p.data.hours)
          await db.query(
            "INSERT INTO working_hours (id,doctor_id,day_of_week,start_time,end_time,is_working) VALUES ($1,$2,$3,$4,$5,$6)",
            [
              randomUUID(),
              req.params.doctorId,
              h.dayOfWeek,
              h.startTime,
              h.endTime,
              h.isWorking,
            ],
          );
        await db.query("COMMIT");
      } catch (e) {
        await db.query("ROLLBACK");
        throw e;
      }
      res.json({ message: "تم حفظ ساعات العمل." });
    } catch (e) {
      next(e);
    }
  },
);
export default router;
