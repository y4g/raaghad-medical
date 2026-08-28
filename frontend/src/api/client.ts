import type {
  AllergyInput,
  ApiError,
  Appointment,
  AppointmentInput,
  AppointmentStatus,
  AuthUser,
  ChronicConditionInput,
  DoctorOption,
  FollowupInput,
  ImagingOrderInput,
  LabOrderInput,
  LabResultInput,
  MedicalVisitInput,
  Patient,
  PatientInput,
  PatientRecord,
  PrescriptionInput,
  VisitReasonOption,
  VitalSignsInput,
  Followup,
  ReportSummary,
  WaitlistEntry,
  WaitlistInput,
} from "shared";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });

  const body = (await response.json().catch(() => ({}))) as T & ApiError;
  if (!response.ok) {
    const error = new Error(body.message || "حدث خطأ غير متوقع.") as Error & {
      details?: ApiError["errors"];
    };
    error.details = body.errors;
    throw error;
  }
  return body;
}

export const patientApi = {
  list: (
    options: {
      query?: string;
      page?: number;
      pageSize?: number;
      archived?: boolean;
    } = {},
  ) => {
    const params = new URLSearchParams({
      page: String(options.page ?? 1),
      pageSize: String(options.pageSize ?? 25),
    });
    if (options.query) params.set("q", options.query);
    if (options.archived) params.set("archived", "true");
    return request<{
      items: Patient[];
      total: number;
      page: number;
      pageSize: number;
    }>(`/api/patients?${params}`);
  },
  get: (id: string) =>
    request<{ patient: Patient }>(`/api/patients/${encodeURIComponent(id)}`),
  create: (input: PatientInput) =>
    request<{ message: string; patient: Patient }>("/api/patients", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: string, input: PatientInput) =>
    request<{ message: string; patient: Patient }>(
      `/api/patients/${encodeURIComponent(id)}`,
      { method: "PUT", body: JSON.stringify(input) },
    ),
  archive: (id: string, archived: boolean) =>
    request<{ message: string; patient: Patient }>(
      `/api/patients/${encodeURIComponent(id)}/archive`,
      { method: "PATCH", body: JSON.stringify({ archived }) },
    ),
};

export const operationsApi = {
  followups: () => request<{ items: Followup[] }>("/api/operations/followups"),
  followupStatus: (
    id: string,
    status: "UPCOMING" | "COMPLETED" | "CANCELLED",
  ) =>
    request<{ message: string }>(`/api/operations/followups/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  waitlist: () =>
    request<{ items: WaitlistEntry[] }>("/api/operations/waitlist"),
  addWaitlist: (input: WaitlistInput) =>
    request<{ message: string }>("/api/operations/waitlist", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  waitlistStatus: (id: string, status: WaitlistEntry["status"]) =>
    request<{ message: string }>(`/api/operations/waitlist/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  reports: (from: string, to: string) =>
    request<{ summary: ReportSummary }>(
      `/api/operations/reports?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),
  activity: () =>
    request<{
      items: Array<{
        id: string;
        action: string;
        entityType: string;
        createdAt: string;
        userName: string | null;
        patientName: string | null;
      }>;
    }>("/api/operations/activity"),
  settings: () =>
    request<{ settings: Record<string, any> }>("/api/operations/settings"),
  saveSetting: (key: string, value: Record<string, unknown>) =>
    request<{ message: string }>(`/api/operations/settings/${key}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    }),
  notifications: () =>
    request<{
      items: Array<{
        id: string;
        type: string;
        title: string;
        message: string;
        entityType: string | null;
        entityId: string | null;
        isRead: boolean;
        createdAt: string;
      }>;
      unread: number;
    }>("/api/operations/notifications"),
  readNotification: (id: string) =>
    request<{ message: string }>(`/api/operations/notifications/${id}/read`, {
      method: "PATCH",
    }),
  search: (query: string) =>
    request<{
      patients: Array<{
        id: string;
        fullName: string;
        medicalNumber: string;
        phone: string;
      }>;
      appointments: Array<any>;
      visits: Array<any>;
    }>(`/api/operations/search?q=${encodeURIComponent(query)}`),
};

export const adminApi = {
  get: () => request<any>("/api/admin"),
  addDoctor: (input: any) =>
    request<{ message: string }>("/api/admin/doctors", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateDoctor: (id: string, input: any) =>
    request<{ message: string }>(`/api/admin/doctors/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  addUser: (input: any) =>
    request<{ message: string }>("/api/admin/users", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateUser: (id: string, input: any) =>
    request<{ message: string }>(`/api/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  saveRole: (id: string, permissions: string[]) =>
    request<{ message: string }>(`/api/admin/roles/${id}/permissions`, {
      method: "PUT",
      body: JSON.stringify({ permissions }),
    }),
  addReason: (input: any) =>
    request<{ message: string }>("/api/admin/reasons", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateReason: (id: string, input: any) =>
    request<{ message: string }>(`/api/admin/reasons/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  saveHours: (doctorId: string, hours: any[]) =>
    request<{ message: string }>(`/api/admin/working-hours/${doctorId}`, {
      method: "PUT",
      body: JSON.stringify({ hours }),
    }),
};

export const authApi = {
  setupStatus: () =>
    request<{ setupRequired: boolean }>("/api/auth/setup-status"),
  setup: (input: { fullName: string; email: string; password: string }) =>
    request<{ user: AuthUser }>("/api/auth/setup", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  registerDoctor: (input: {
    fullName: string;
    email: string;
    password: string;
    specialty: string;
    phone?: string;
    licenseNumber?: string;
  }) =>
    request<{ message: string; user: AuthUser }>("/api/auth/register-doctor", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  login: (input: { email: string; password: string }) =>
    request<{ user: AuthUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  me: () => request<{ user: AuthUser }>("/api/auth/me"),
  logout: () =>
    request<{ message: string }>("/api/auth/logout", { method: "POST" }),
};

export const appointmentApi = {
  list: (from: string, to: string) =>
    request<{ items: Appointment[] }>(
      `/api/appointments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),
  options: () =>
    request<{ doctors: DoctorOption[]; reasons: VisitReasonOption[] }>(
      "/api/appointments/options",
    ),
  create: (input: AppointmentInput) =>
    request<{ message: string; appointment: Appointment }>(
      "/api/appointments",
      { method: "POST", body: JSON.stringify(input) },
    ),
  status: (id: string, status: AppointmentStatus, note?: string) =>
    request<{
      message: string;
      appointment: Appointment;
      undoAvailable: boolean;
    }>(`/api/appointments/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, note }),
    }),
  undoStatus: (id: string) =>
    request<{ message: string; appointment: Appointment }>(
      `/api/appointments/${id}/status/undo`,
      { method: "POST" },
    ),
  reschedule: (id: string, startAt: string) =>
    request<{ message: string; appointment: Appointment }>(
      `/api/appointments/${id}/reschedule`,
      { method: "PATCH", body: JSON.stringify({ startAt }) },
    ),
};

export const medicalRecordApi = {
  get: (patientId: string) =>
    request<{ record: PatientRecord }>(
      `/api/medical/patients/${patientId}/record`,
    ),
  addAllergy: (patientId: string, input: AllergyInput) =>
    request<{ message: string; record: PatientRecord }>(
      `/api/medical/patients/${patientId}/allergies`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  updateAllergy: (patientId: string, id: string, input: AllergyInput) =>
    request<{ message: string; record: PatientRecord }>(
      `/api/medical/patients/${patientId}/allergies/${id}`,
      { method: "PUT", body: JSON.stringify(input) },
    ),
  addCondition: (patientId: string, input: ChronicConditionInput) =>
    request<{ message: string; record: PatientRecord }>(
      `/api/medical/patients/${patientId}/chronic-conditions`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  updateCondition: (
    patientId: string,
    id: string,
    input: ChronicConditionInput,
  ) =>
    request<{ message: string; record: PatientRecord }>(
      `/api/medical/patients/${patientId}/chronic-conditions/${id}`,
      { method: "PUT", body: JSON.stringify(input) },
    ),
  addVitals: (patientId: string, input: VitalSignsInput) =>
    request<{ message: string; record: PatientRecord }>(
      `/api/medical/patients/${patientId}/vitals`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  addVisit: (patientId: string, input: MedicalVisitInput) =>
    request<{ message: string; record: PatientRecord }>(
      `/api/medical/patients/${patientId}/visits`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  addPrescription: (patientId: string, input: PrescriptionInput) =>
    request<{ message: string; record: PatientRecord }>(
      `/api/medical/patients/${patientId}/prescriptions`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  addLab: (patientId: string, input: LabOrderInput) =>
    request<{ message: string; record: PatientRecord }>(
      `/api/medical/patients/${patientId}/labs`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  addLabResult: (patientId: string, id: string, input: LabResultInput) =>
    request<{ message: string; record: PatientRecord }>(
      `/api/medical/patients/${patientId}/labs/${id}/results`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  addImaging: (patientId: string, input: ImagingOrderInput) =>
    request<{ message: string; record: PatientRecord }>(
      `/api/medical/patients/${patientId}/imaging`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  addFollowup: (patientId: string, input: FollowupInput) =>
    request<{ message: string; record: PatientRecord }>(
      `/api/medical/patients/${patientId}/followups`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  uploadAttachment: async (patientId: string, file: File) => {
    const response = await fetch(
      `/api/medical/patients/${patientId}/attachments`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": file.type,
          "X-File-Name": encodeURIComponent(file.name),
        },
        body: file,
      },
    );
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || "تعذر رفع الملف.");
    return body as { message: string; record: PatientRecord };
  },
  archiveAttachment: (patientId: string, id: string, archived: boolean) =>
    request<{ message: string; record: PatientRecord }>(
      `/api/medical/patients/${patientId}/attachments/${id}/archive`,
      { method: "PATCH", body: JSON.stringify({ archived }) },
    ),
};
