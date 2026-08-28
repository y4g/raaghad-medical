import { z } from 'zod';

const nullableText = (max: number) => z.union([z.string().trim().max(max), z.null()]).optional().transform((value) => value || null);

export const patientSchema = z.object({
  fullName: z.string().trim().min(2, 'الاسم يجب أن يكون حرفين على الأقل.').max(140),
  phone: z.string().trim().regex(/^[+\d][\d\s()-]{6,19}$/, 'أدخل رقم هاتف صحيحاً.'),
  dateOfBirth: z.iso.date('أدخل تاريخ ميلاد صحيحاً.').refine((value) => new Date(value) <= new Date(), 'تاريخ الميلاد لا يمكن أن يكون في المستقبل.'),
  gender: z.enum(['ذكر','أنثى'], 'اختر الجنس.'),
  nationalId: nullableText(50), bloodType: nullableText(5), address: nullableText(500),
  heightCm: z.union([z.number().min(30).max(250), z.null()]).optional().transform((value) => value ?? null),
  weightKg: z.union([z.number().min(1).max(500), z.null()]).optional().transform((value) => value ?? null),
  emergencyContactName: nullableText(140), emergencyContactPhone: nullableText(30), notes: nullableText(2000),
});
