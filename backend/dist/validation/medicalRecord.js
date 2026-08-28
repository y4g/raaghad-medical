"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.followupSchema = exports.imagingOrderSchema = exports.labResultSchema = exports.labOrderSchema = exports.prescriptionSchema = exports.medicalVisitSchema = exports.vitalSignsSchema = exports.chronicConditionSchema = exports.allergySchema = void 0;
const zod_1 = require("zod");
const nullableText = (max) => zod_1.z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => value || null);
exports.allergySchema = zod_1.z.object({
    substance: zod_1.z.string().trim().min(2, "اكتب المادة المسببة للحساسية.").max(180),
    allergyType: zod_1.z.enum(["DRUG", "FOOD", "MATERIAL", "OTHER"]),
    severity: zod_1.z.enum(["MILD", "MODERATE", "SEVERE"]),
    symptoms: nullableText(1000),
    notes: nullableText(2000),
    isActive: zod_1.z.boolean().default(true),
});
exports.chronicConditionSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2, "اكتب اسم المرض المزمن.").max(180),
    diagnosedAt: zod_1.z.iso
        .date()
        .nullable()
        .optional()
        .transform((value) => value || null),
    status: zod_1.z.enum(["ACTIVE", "CONTROLLED", "IN_REMISSION"]),
    notes: nullableText(2000),
    followupPlan: nullableText(2000),
    isActive: zod_1.z.boolean().default(true),
});
exports.vitalSignsSchema = zod_1.z
    .object({
    visitId: zod_1.z
        .uuid()
        .nullable()
        .optional()
        .transform((value) => value || null),
    heightCm: zod_1.z
        .number()
        .min(30)
        .max(250)
        .nullable()
        .optional()
        .transform((value) => value ?? null),
    weightKg: zod_1.z
        .number()
        .min(1)
        .max(500)
        .nullable()
        .optional()
        .transform((value) => value ?? null),
    systolic: zod_1.z
        .number()
        .int()
        .min(40)
        .max(300)
        .nullable()
        .optional()
        .transform((value) => value ?? null),
    diastolic: zod_1.z
        .number()
        .int()
        .min(20)
        .max(200)
        .nullable()
        .optional()
        .transform((value) => value ?? null),
    pulse: zod_1.z
        .number()
        .int()
        .min(20)
        .max(260)
        .nullable()
        .optional()
        .transform((value) => value ?? null),
    temperatureC: zod_1.z
        .number()
        .min(30)
        .max(45)
        .nullable()
        .optional()
        .transform((value) => value ?? null),
    spo2: zod_1.z
        .number()
        .int()
        .min(50)
        .max(100)
        .nullable()
        .optional()
        .transform((value) => value ?? null),
    notes: nullableText(1000),
})
    .refine((value) => Object.entries(value).some(([key, item]) => key !== "visitId" && key !== "notes" && item !== null), { message: "أدخل قياساً واحداً على الأقل." });
const diagnosisSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2).max(240),
    code: nullableText(30),
    diagnosisType: zod_1.z.enum(["PRIMARY", "SECONDARY"]),
    notes: nullableText(1000),
});
exports.medicalVisitSchema = zod_1.z.object({
    appointmentId: zod_1.z
        .uuid()
        .nullable()
        .optional()
        .transform((value) => value || null),
    visitReason: zod_1.z.string().trim().min(2, "اكتب سبب الزيارة.").max(500),
    symptoms: nullableText(4000),
    clinicalNotes: nullableText(8000),
    treatmentPlan: nullableText(8000),
    educationInstructions: nullableText(4000),
    followupPlan: nullableText(4000),
    completedAt: zod_1.z.iso
        .datetime()
        .nullable()
        .optional()
        .transform((value) => value || null),
    diagnoses: zod_1.z.array(diagnosisSchema).max(20).default([]),
});
exports.prescriptionSchema = zod_1.z.object({
    visitId: zod_1.z.uuid().nullable().optional(),
    notes: nullableText(2000),
    items: zod_1.z
        .array(zod_1.z.object({
        medicationName: zod_1.z.string().trim().min(2).max(220),
        dosage: zod_1.z.string().trim().min(1).max(100),
        dosageForm: nullableText(100),
        frequency: zod_1.z.string().trim().min(1).max(120),
        duration: zod_1.z.string().trim().min(1).max(100),
        instructions: nullableText(2000),
        notes: nullableText(1000),
    }))
        .min(1)
        .max(30),
});
exports.labOrderSchema = zod_1.z.object({
    visitId: zod_1.z.uuid().nullable().optional(),
    testName: zod_1.z.string().trim().min(2).max(220),
    orderNotes: nullableText(2000),
});
exports.labResultSchema = zod_1.z.object({
    resultValue: zod_1.z.string().trim().min(1).max(220),
    unit: nullableText(80),
    referenceRange: nullableText(120),
    notes: nullableText(2000),
    resultAt: zod_1.z.iso.datetime(),
});
exports.imagingOrderSchema = zod_1.z.object({
    visitId: zod_1.z.uuid().nullable().optional(),
    imagingType: zod_1.z.string().trim().min(2).max(180),
    reason: zod_1.z.string().trim().min(2).max(2000),
    report: nullableText(8000),
});
exports.followupSchema = zod_1.z.object({
    visitId: zod_1.z.uuid().nullable().optional(),
    reason: zod_1.z.string().trim().min(2).max(1000),
    dueAt: zod_1.z.iso.datetime(),
    notes: nullableText(2000),
});
