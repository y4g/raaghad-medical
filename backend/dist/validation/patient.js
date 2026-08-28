"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.patientSchema = void 0;
const zod_1 = require("zod");
const nullableText = (max) => zod_1.z.union([zod_1.z.string().trim().max(max), zod_1.z.null()]).optional().transform((value) => value || null);
exports.patientSchema = zod_1.z.object({
    fullName: zod_1.z.string().trim().min(2, 'الاسم يجب أن يكون حرفين على الأقل.').max(140),
    phone: zod_1.z.string().trim().regex(/^[+\d][\d\s()-]{6,19}$/, 'أدخل رقم هاتف صحيحاً.'),
    dateOfBirth: zod_1.z.iso.date('أدخل تاريخ ميلاد صحيحاً.').refine((value) => new Date(value) <= new Date(), 'تاريخ الميلاد لا يمكن أن يكون في المستقبل.'),
    gender: zod_1.z.enum(['ذكر', 'أنثى'], 'اختر الجنس.'),
    nationalId: nullableText(50), bloodType: nullableText(5), address: nullableText(500),
    heightCm: zod_1.z.union([zod_1.z.number().min(30).max(250), zod_1.z.null()]).optional().transform((value) => value ?? null),
    weightKg: zod_1.z.union([zod_1.z.number().min(1).max(500), zod_1.z.null()]).optional().transform((value) => value ?? null),
    emergencyContactName: nullableText(140), emergencyContactPhone: nullableText(30), notes: nullableText(2000),
});
