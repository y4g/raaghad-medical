import { z } from "zod";

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => value || null);

export const allergySchema = z.object({
  substance: z.string().trim().min(2, "اكتب المادة المسببة للحساسية.").max(180),
  allergyType: z.enum(["DRUG", "FOOD", "MATERIAL", "OTHER"]),
  severity: z.enum(["MILD", "MODERATE", "SEVERE"]),
  symptoms: nullableText(1000),
  notes: nullableText(2000),
  isActive: z.boolean().default(true),
});

export const chronicConditionSchema = z.object({
  name: z.string().trim().min(2, "اكتب اسم المرض المزمن.").max(180),
  diagnosedAt: z.iso
    .date()
    .nullable()
    .optional()
    .transform((value) => value || null),
  status: z.enum(["ACTIVE", "CONTROLLED", "IN_REMISSION"]),
  notes: nullableText(2000),
  followupPlan: nullableText(2000),
  isActive: z.boolean().default(true),
});

export const vitalSignsSchema = z
  .object({
    visitId: z
      .uuid()
      .nullable()
      .optional()
      .transform((value) => value || null),
    heightCm: z
      .number()
      .min(30)
      .max(250)
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    weightKg: z
      .number()
      .min(1)
      .max(500)
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    systolic: z
      .number()
      .int()
      .min(40)
      .max(300)
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    diastolic: z
      .number()
      .int()
      .min(20)
      .max(200)
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    pulse: z
      .number()
      .int()
      .min(20)
      .max(260)
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    temperatureC: z
      .number()
      .min(30)
      .max(45)
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    spo2: z
      .number()
      .int()
      .min(50)
      .max(100)
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    notes: nullableText(1000),
  })
  .refine(
    (value) =>
      Object.entries(value).some(
        ([key, item]) => key !== "visitId" && key !== "notes" && item !== null,
      ),
    { message: "أدخل قياساً واحداً على الأقل." },
  );

const diagnosisSchema = z.object({
  name: z.string().trim().min(2).max(240),
  code: nullableText(30),
  diagnosisType: z.enum(["PRIMARY", "SECONDARY"]),
  notes: nullableText(1000),
});

export const medicalVisitSchema = z.object({
  appointmentId: z
    .uuid()
    .nullable()
    .optional()
    .transform((value) => value || null),
  visitReason: z.string().trim().min(2, "اكتب سبب الزيارة.").max(500),
  symptoms: nullableText(4000),
  clinicalNotes: nullableText(8000),
  treatmentPlan: nullableText(8000),
  educationInstructions: nullableText(4000),
  followupPlan: nullableText(4000),
  completedAt: z.iso
    .datetime()
    .nullable()
    .optional()
    .transform((value) => value || null),
  diagnoses: z.array(diagnosisSchema).max(20).default([]),
});

export const prescriptionSchema = z.object({
  visitId: z.uuid().nullable().optional(),
  notes: nullableText(2000),
  items: z
    .array(
      z.object({
        medicationName: z.string().trim().min(2).max(220),
        dosage: z.string().trim().min(1).max(100),
        dosageForm: nullableText(100),
        frequency: z.string().trim().min(1).max(120),
        duration: z.string().trim().min(1).max(100),
        instructions: nullableText(2000),
        notes: nullableText(1000),
      }),
    )
    .min(1)
    .max(30),
});
export const labOrderSchema = z.object({
  visitId: z.uuid().nullable().optional(),
  testName: z.string().trim().min(2).max(220),
  orderNotes: nullableText(2000),
});
export const labResultSchema = z.object({
  resultValue: z.string().trim().min(1).max(220),
  unit: nullableText(80),
  referenceRange: nullableText(120),
  notes: nullableText(2000),
  resultAt: z.iso.datetime(),
});
export const imagingOrderSchema = z.object({
  visitId: z.uuid().nullable().optional(),
  imagingType: z.string().trim().min(2).max(180),
  reason: z.string().trim().min(2).max(2000),
  report: nullableText(8000),
});
export const followupSchema = z.object({
  visitId: z.uuid().nullable().optional(),
  reason: z.string().trim().min(2).max(1000),
  dueAt: z.iso.datetime(),
  notes: nullableText(2000),
});
