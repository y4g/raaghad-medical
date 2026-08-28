import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import {
  authenticate,
  createInitialAdmin,
  endSession,
  isSetupRequired,
  registerDoctor,
  startSession,
} from "../services/authService";
import { requireAuth } from "../middleware/auth";
import { logActivity } from "../services/activityService";

const router = Router();
const credentialsSchema = z.object({
  email: z.email("أدخل بريداً إلكترونياً صحيحاً."),
  password: z
    .string()
    .min(10, "كلمة المرور يجب أن تكون 10 أحرف على الأقل.")
    .max(200),
});
const setupSchema = credentialsSchema.extend({
  fullName: z.string().trim().min(2).max(140),
});
const doctorRegistrationSchema = setupSchema.extend({
  specialty: z.string().trim().min(2).max(140),
  phone: z.string().trim().max(30).optional(),
  licenseNumber: z.string().trim().max(100).optional(),
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "محاولات كثيرة. يرجى الانتظار قبل المحاولة مجدداً." },
});

router.get("/setup-status", async (_request, response, next) => {
  try {
    response.json({ setupRequired: await isSetupRequired() });
  } catch (error) {
    next(error);
  }
});

router.post("/setup", loginLimiter, async (request, response, next) => {
  try {
    const parsed = setupSchema.safeParse(request.body);
    if (!parsed.success) {
      response
        .status(400)
        .json({
          message: "تحقق من بيانات إنشاء الحساب.",
          errors: z.flattenError(parsed.error).fieldErrors,
        });
      return;
    }
    const user = await createInitialAdmin(parsed.data);
    await startSession(user.id, request, response);
    await logActivity(request, {
      action: "SYSTEM_SETUP",
      entityType: "user",
      entityId: user.id,
    });
    response.status(201).json({ user });
  } catch (error) {
    if ((error as Error).message === "SETUP_ALREADY_COMPLETED") {
      response.status(409).json({ message: "تم إعداد النظام مسبقاً." });
      return;
    }
    next(error);
  }
});

router.post("/login", loginLimiter, async (request, response, next) => {
  try {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) {
      response
        .status(400)
        .json({ message: "تحقق من البريد الإلكتروني وكلمة المرور." });
      return;
    }
    const user = await authenticate(parsed.data.email, parsed.data.password);
    if (!user) {
      response
        .status(401)
        .json({ message: "البريد الإلكتروني أو كلمة المرور غير صحيحة." });
      return;
    }
    await startSession(user.id, request, response);
    request.currentUser = user;
    await logActivity(request, {
      action: "USER_LOGIN",
      entityType: "user",
      entityId: user.id,
    });
    response.json({ user });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/register-doctor",
  loginLimiter,
  async (request, response, next) => {
    try {
      const parsed = doctorRegistrationSchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({
          message: "تحقق من بيانات الطبيب وكلمة المرور.",
          errors: z.flattenError(parsed.error).fieldErrors,
        });
        return;
      }
      const user = await registerDoctor(parsed.data);
      await startSession(user.id, request, response);
      request.currentUser = user;
      await logActivity(request, {
        action: "DOCTOR_REGISTERED",
        entityType: "user",
        entityId: user.id,
      });
      response.status(201).json({
        message: "تم إنشاء حساب الطبيب وحفظ بياناته بنجاح.",
        user,
      });
    } catch (error) {
      if ((error as Error).message === "SETUP_REQUIRED") {
        response
          .status(409)
          .json({ message: "يجب إعداد حساب مدير العيادة أولاً." });
        return;
      }
      if ((error as { code?: string }).code === "23505") {
        response
          .status(409)
          .json({ message: "هذا البريد الإلكتروني مسجل مسبقاً." });
        return;
      }
      next(error);
    }
  },
);

router.get("/me", requireAuth, (request, response) => {
  response.json({ user: request.currentUser });
});

router.post("/logout", requireAuth, async (request, response, next) => {
  try {
    await logActivity(request, {
      action: "USER_LOGOUT",
      entityType: "user",
      entityId: request.currentUser?.id,
    });
    await endSession(request, response);
    response.json({ message: "تم تسجيل الخروج بنجاح." });
  } catch (error) {
    next(error);
  }
});

export default router;
