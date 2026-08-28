"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const zod_1 = require("zod");
const authService_1 = require("../services/authService");
const auth_1 = require("../middleware/auth");
const activityService_1 = require("../services/activityService");
const router = (0, express_1.Router)();
const credentialsSchema = zod_1.z.object({
    email: zod_1.z.email("أدخل بريداً إلكترونياً صحيحاً."),
    password: zod_1.z
        .string()
        .min(10, "كلمة المرور يجب أن تكون 10 أحرف على الأقل.")
        .max(200),
});
const setupSchema = credentialsSchema.extend({
    fullName: zod_1.z.string().trim().min(2).max(140),
});
const doctorRegistrationSchema = setupSchema.extend({
    specialty: zod_1.z.string().trim().min(2).max(140),
    phone: zod_1.z.string().trim().max(30).optional(),
    licenseNumber: zod_1.z.string().trim().max(100).optional(),
});
const loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "محاولات كثيرة. يرجى الانتظار قبل المحاولة مجدداً." },
});
router.get("/setup-status", async (_request, response, next) => {
    try {
        response.json({ setupRequired: await (0, authService_1.isSetupRequired)() });
    }
    catch (error) {
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
                errors: zod_1.z.flattenError(parsed.error).fieldErrors,
            });
            return;
        }
        const user = await (0, authService_1.createInitialAdmin)(parsed.data);
        await (0, authService_1.startSession)(user.id, request, response);
        await (0, activityService_1.logActivity)(request, {
            action: "SYSTEM_SETUP",
            entityType: "user",
            entityId: user.id,
        });
        response.status(201).json({ user });
    }
    catch (error) {
        if (error.message === "SETUP_ALREADY_COMPLETED") {
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
        const user = await (0, authService_1.authenticate)(parsed.data.email, parsed.data.password);
        if (!user) {
            response
                .status(401)
                .json({ message: "البريد الإلكتروني أو كلمة المرور غير صحيحة." });
            return;
        }
        await (0, authService_1.startSession)(user.id, request, response);
        request.currentUser = user;
        await (0, activityService_1.logActivity)(request, {
            action: "USER_LOGIN",
            entityType: "user",
            entityId: user.id,
        });
        response.json({ user });
    }
    catch (error) {
        next(error);
    }
});
router.post("/register-doctor", loginLimiter, async (request, response, next) => {
    try {
        const parsed = doctorRegistrationSchema.safeParse(request.body);
        if (!parsed.success) {
            response.status(400).json({
                message: "تحقق من بيانات الطبيب وكلمة المرور.",
                errors: zod_1.z.flattenError(parsed.error).fieldErrors,
            });
            return;
        }
        const user = await (0, authService_1.registerDoctor)(parsed.data);
        await (0, authService_1.startSession)(user.id, request, response);
        request.currentUser = user;
        await (0, activityService_1.logActivity)(request, {
            action: "DOCTOR_REGISTERED",
            entityType: "user",
            entityId: user.id,
        });
        response.status(201).json({
            message: "تم إنشاء حساب الطبيب وحفظ بياناته بنجاح.",
            user,
        });
    }
    catch (error) {
        if (error.message === "SETUP_REQUIRED") {
            response
                .status(409)
                .json({ message: "يجب إعداد حساب مدير العيادة أولاً." });
            return;
        }
        if (error.code === "23505") {
            response
                .status(409)
                .json({ message: "هذا البريد الإلكتروني مسجل مسبقاً." });
            return;
        }
        next(error);
    }
});
router.get("/me", auth_1.requireAuth, (request, response) => {
    response.json({ user: request.currentUser });
});
router.post("/logout", auth_1.requireAuth, async (request, response, next) => {
    try {
        await (0, activityService_1.logActivity)(request, {
            action: "USER_LOGOUT",
            entityType: "user",
            entityId: request.currentUser?.id,
        });
        await (0, authService_1.endSession)(request, response);
        response.json({ message: "تم تسجيل الخروج بنجاح." });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
