export const PATIENT_GENDERS = ["ذكر", "أنثى"] as const;

export type PatientGender = (typeof PATIENT_GENDERS)[number];

export interface Patient {
  id: string;
  medicalNumber: string;
  fullName: string;
  phone: string;
  dateOfBirth: string;
  age: number;
  gender: PatientGender;
  nationalId: string | null;
  bloodType: string | null;
  address: string | null;
  heightCm: number | null;
  weightKg: number | null;
  bmi: number | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  notes: string | null;
  isArchived: boolean;
  hasAllergies: boolean;
  hasChronicConditions: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PatientInput = Pick<
  Patient,
  "fullName" | "phone" | "dateOfBirth" | "gender"
> &
  Partial<
    Pick<
      Patient,
      | "nationalId"
      | "bloodType"
      | "address"
      | "heightCm"
      | "weightKg"
      | "emergencyContactName"
      | "emergencyContactPhone"
      | "notes"
    >
  >;

export interface ApiError {
  message: string;
  errors?: Partial<Record<keyof PatientInput, string | string[]>>;
}

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  roleCode: "ADMIN_DOCTOR" | "DOCTOR" | "RECEPTION" | "NURSE";
  roleName: string;
  permissions: string[];
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  phone: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  patientName: string;
  patientMedicalNumber: string;
  doctorName: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  status: AppointmentStatus;
  statusLabel: string;
  priority: AppointmentPriority;
  reason: string;
  receptionNotes: string | null;
  hasAllergies: boolean;
  hasChronicConditions: boolean;
  createdAt: string;
}

export type AppointmentStatus =
  | "BOOKED"
  | "ARRIVED"
  | "WAITING"
  | "WITH_DOCTOR"
  | "COMPLETED"
  | "NO_SHOW"
  | "CANCELLED"
  | "POSTPONED";
export type AppointmentPriority = "NORMAL" | "URGENT" | "EMERGENCY";

export interface AppointmentInput {
  patientId: string;
  doctorId?: string;
  visitReasonId?: string;
  customReason?: string;
  startAt: string;
  durationMinutes: number;
  priority: AppointmentPriority;
  receptionNotes?: string;
  additionalNotes?: string;
}

export interface DoctorOption {
  id: string;
  fullName: string;
  specialty: string;
}
export interface VisitReasonOption {
  id: string;
  category: string;
  nameAr: string;
  usageCount: number;
}

export interface PatientAllergy {
  id: string;
  substance: string;
  allergyType: "DRUG" | "FOOD" | "MATERIAL" | "OTHER";
  severity: "MILD" | "MODERATE" | "SEVERE";
  symptoms: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ChronicCondition {
  id: string;
  name: string;
  diagnosedAt: string | null;
  status: "ACTIVE" | "CONTROLLED" | "IN_REMISSION";
  notes: string | null;
  followupPlan: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface VitalSigns {
  id: string;
  visitId: string | null;
  heightCm: number | null;
  weightKg: number | null;
  bmi: number | null;
  systolic: number | null;
  diastolic: number | null;
  pulse: number | null;
  temperatureC: number | null;
  spo2: number | null;
  notes: string | null;
  measuredByName: string;
  measuredAt: string;
}

export interface Diagnosis {
  id: string;
  name: string;
  code: string | null;
  diagnosisType: "PRIMARY" | "SECONDARY";
  notes: string | null;
  createdAt: string;
}

export interface MedicalVisit {
  id: string;
  appointmentId: string | null;
  doctorName: string;
  visitReason: string;
  symptoms: string | null;
  clinicalNotes: string | null;
  treatmentPlan: string | null;
  educationInstructions: string | null;
  followupPlan: string | null;
  startedAt: string;
  completedAt: string | null;
  diagnoses: Diagnosis[];
}

export interface PatientRecord {
  patient: Patient;
  allergies: PatientAllergy[];
  chronicConditions: ChronicCondition[];
  vitals: VitalSigns[];
  visits: MedicalVisit[];
  appointments: Appointment[];
  prescriptions: Prescription[];
  labOrders: LabOrder[];
  imagingOrders: ImagingOrder[];
  followups: Followup[];
  attachments: MedicalAttachment[];
}

export type AllergyInput = Omit<PatientAllergy, "id" | "createdAt">;
export type ChronicConditionInput = Omit<ChronicCondition, "id" | "createdAt">;
export type VitalSignsInput = Omit<
  VitalSigns,
  "id" | "bmi" | "measuredByName" | "measuredAt"
>;
export type MedicalVisitInput = Pick<
  MedicalVisit,
  | "appointmentId"
  | "visitReason"
  | "symptoms"
  | "clinicalNotes"
  | "treatmentPlan"
  | "educationInstructions"
  | "followupPlan"
  | "completedAt"
> & {
  diagnoses: Array<
    Pick<Diagnosis, "name" | "code" | "diagnosisType" | "notes">
  >;
};

export interface PrescriptionItem {
  id: string;
  medicationName: string;
  dosage: string;
  dosageForm: string | null;
  frequency: string;
  duration: string;
  instructions: string | null;
  notes: string | null;
}
export interface Prescription {
  id: string;
  visitId: string | null;
  doctorName: string;
  notes: string | null;
  issuedAt: string;
  items: PrescriptionItem[];
}
export interface PrescriptionInput {
  visitId?: string | null;
  notes?: string | null;
  items: Array<Omit<PrescriptionItem, "id">>;
}
export interface LabResult {
  id: string;
  resultValue: string;
  unit: string | null;
  referenceRange: string | null;
  notes: string | null;
  resultAt: string;
}
export interface LabOrder {
  id: string;
  visitId: string | null;
  testName: string;
  status: string;
  orderNotes: string | null;
  orderedAt: string;
  results: LabResult[];
}
export interface LabOrderInput {
  visitId?: string | null;
  testName: string;
  orderNotes?: string | null;
}
export interface LabResultInput {
  resultValue: string;
  unit?: string | null;
  referenceRange?: string | null;
  notes?: string | null;
  resultAt: string;
}
export interface ImagingOrder {
  id: string;
  visitId: string | null;
  imagingType: string;
  reason: string;
  report: string | null;
  status: string;
  orderedAt: string;
  reportedAt: string | null;
}
export interface ImagingOrderInput {
  visitId?: string | null;
  imagingType: string;
  reason: string;
  report?: string | null;
}
export interface Followup {
  id: string;
  visitId: string | null;
  patientId: string;
  patientName?: string;
  patientMedicalNumber?: string;
  reason: string;
  dueAt: string;
  status: "UPCOMING" | "DUE" | "OVERDUE" | "COMPLETED" | "CANCELLED";
  notes: string | null;
  createdAt: string;
}
export interface FollowupInput {
  visitId?: string | null;
  reason: string;
  dueAt: string;
  notes?: string | null;
}
export interface WaitlistEntry {
  id: string;
  patientId: string;
  patientName: string;
  patientMedicalNumber: string;
  reason: string;
  priority: AppointmentPriority;
  notes: string | null;
  status: "WAITING" | "CALLED" | "CONVERTED" | "CANCELLED";
  arrivedAt: string;
  appointmentId: string | null;
}
export interface WaitlistInput {
  patientId: string;
  reason: string;
  priority: AppointmentPriority;
  notes?: string | null;
}
export interface ReportSummary {
  totalPatients: number;
  newPatients: number;
  totalAppointments: number;
  completedVisits: number;
  cancelled: number;
  noShow: number;
  followups: number;
  topReasons: Array<{ name: string; count: number }>;
  visitsByDay: Array<{ day: string; count: number }>;
}
export interface MedicalAttachment {
  id: string;
  visitId: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  category: string;
  isArchived: boolean;
  uploadedByName: string;
  uploadedAt: string;
}
