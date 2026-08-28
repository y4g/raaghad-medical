CREATE TABLE roles (
  id UUID PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  name_ar VARCHAR(100) NOT NULL,
  description_ar TEXT,
  is_system BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE permissions (
  id UUID PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  name_ar VARCHAR(140) NOT NULL,
  category VARCHAR(60) NOT NULL
);

CREATE TABLE role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
  id UUID PRIMARY KEY,
  full_name VARCHAR(140) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role_id UUID NOT NULL REFERENCES roles(id),
  phone VARCHAR(30),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address VARCHAR(80),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX user_sessions_user_idx ON user_sessions(user_id);
CREATE INDEX user_sessions_expiry_idx ON user_sessions(expires_at);

CREATE TABLE doctors (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  full_name VARCHAR(140) NOT NULL,
  specialty VARCHAR(140) NOT NULL,
  phone VARCHAR(30),
  license_number VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE patients (
  id UUID PRIMARY KEY,
  medical_number VARCHAR(30) NOT NULL UNIQUE,
  full_name VARCHAR(140) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  date_of_birth DATE NOT NULL,
  gender VARCHAR(20) NOT NULL CHECK (gender IN ('MALE','FEMALE')),
  national_id VARCHAR(50) UNIQUE,
  blood_type VARCHAR(5),
  address TEXT,
  height_cm NUMERIC(5,2),
  weight_kg NUMERIC(5,2),
  emergency_contact_name VARCHAR(140),
  emergency_contact_phone VARCHAR(30),
  notes TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX patients_name_idx ON patients(full_name);
CREATE INDEX patients_phone_idx ON patients(phone);
CREATE INDEX patients_medical_number_idx ON patients(medical_number);
CREATE INDEX patients_national_id_idx ON patients(national_id);

CREATE TABLE patient_allergies (
  id UUID PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  substance VARCHAR(180) NOT NULL,
  allergy_type VARCHAR(40) NOT NULL,
  severity VARCHAR(30) NOT NULL,
  symptoms TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE chronic_conditions (
  id UUID PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  name VARCHAR(180) NOT NULL,
  diagnosed_at DATE,
  status VARCHAR(40) NOT NULL,
  notes TEXT,
  followup_plan TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE visit_reasons (
  id UUID PRIMARY KEY,
  category VARCHAR(100) NOT NULL,
  name_ar VARCHAR(180) NOT NULL UNIQUE,
  usage_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_system BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX visit_reasons_search_idx ON visit_reasons(category, name_ar);

CREATE TABLE appointments (
  id UUID PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id),
  doctor_id UUID NOT NULL REFERENCES doctors(id),
  visit_reason_id UUID REFERENCES visit_reasons(id),
  custom_reason TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 5 AND 480),
  status VARCHAR(40) NOT NULL CHECK (status IN ('BOOKED','ARRIVED','WAITING','WITH_DOCTOR','COMPLETED','NO_SHOW','CANCELLED','POSTPONED')),
  priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('NORMAL','URGENT','EMERGENCY')),
  reception_notes TEXT,
  additional_notes TEXT,
  arrived_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_at > start_at)
);
CREATE INDEX appointments_doctor_time_idx ON appointments(doctor_id, start_at, end_at);
CREATE INDEX appointments_patient_idx ON appointments(patient_id, start_at DESC);
CREATE INDEX appointments_status_idx ON appointments(status, start_at);

CREATE TABLE appointment_status_history (
  id UUID PRIMARY KEY,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  from_status VARCHAR(40),
  to_status VARCHAR(40) NOT NULL,
  note TEXT,
  changed_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE visits (
  id UUID PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id),
  doctor_id UUID NOT NULL REFERENCES doctors(id),
  appointment_id UUID UNIQUE REFERENCES appointments(id) ON DELETE SET NULL,
  visit_reason TEXT NOT NULL,
  symptoms TEXT,
  clinical_notes TEXT,
  treatment_plan TEXT,
  education_instructions TEXT,
  followup_plan TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX visits_patient_idx ON visits(patient_id, started_at DESC);

CREATE TABLE vital_signs (
  id UUID PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id),
  visit_id UUID REFERENCES visits(id) ON DELETE SET NULL,
  height_cm NUMERIC(5,2),
  weight_kg NUMERIC(5,2),
  bmi NUMERIC(5,2),
  systolic INTEGER,
  diastolic INTEGER,
  pulse INTEGER,
  temperature_c NUMERIC(4,1),
  spo2 INTEGER,
  notes TEXT,
  measured_by UUID NOT NULL REFERENCES users(id),
  measured_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX vital_signs_patient_idx ON vital_signs(patient_id, measured_at DESC);

CREATE TABLE diagnoses (
  id UUID PRIMARY KEY,
  visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id),
  name VARCHAR(240) NOT NULL,
  code VARCHAR(30),
  diagnosis_type VARCHAR(20) NOT NULL CHECK (diagnosis_type IN ('PRIMARY','SECONDARY')),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE prescriptions (
  id UUID PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id),
  visit_id UUID REFERENCES visits(id) ON DELETE SET NULL,
  doctor_id UUID NOT NULL REFERENCES doctors(id),
  notes TEXT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL REFERENCES users(id)
);

CREATE TABLE prescription_items (
  id UUID PRIMARY KEY,
  prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  medication_name VARCHAR(220) NOT NULL,
  dosage VARCHAR(100) NOT NULL,
  dosage_form VARCHAR(100),
  frequency VARCHAR(120) NOT NULL,
  duration VARCHAR(100) NOT NULL,
  instructions TEXT,
  notes TEXT
);

CREATE TABLE lab_orders (
  id UUID PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id),
  visit_id UUID REFERENCES visits(id) ON DELETE SET NULL,
  test_name VARCHAR(220) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'ORDERED',
  order_notes TEXT,
  ordered_by UUID NOT NULL REFERENCES users(id),
  ordered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE lab_results (
  id UUID PRIMARY KEY,
  lab_order_id UUID NOT NULL REFERENCES lab_orders(id) ON DELETE CASCADE,
  result_value VARCHAR(220) NOT NULL,
  unit VARCHAR(80),
  reference_range VARCHAR(120),
  notes TEXT,
  result_at TIMESTAMPTZ NOT NULL,
  entered_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE imaging_orders (
  id UUID PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id),
  visit_id UUID REFERENCES visits(id) ON DELETE SET NULL,
  imaging_type VARCHAR(180) NOT NULL,
  reason TEXT NOT NULL,
  report TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'ORDERED',
  ordered_by UUID NOT NULL REFERENCES users(id),
  ordered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reported_at TIMESTAMPTZ
);

CREATE TABLE attachments (
  id UUID PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id),
  visit_id UUID REFERENCES visits(id) ON DELETE SET NULL,
  imaging_order_id UUID REFERENCES imaging_orders(id) ON DELETE SET NULL,
  storage_key TEXT NOT NULL UNIQUE,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  size_bytes BIGINT NOT NULL,
  category VARCHAR(80) NOT NULL,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE followups (
  id UUID PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id),
  visit_id UUID REFERENCES visits(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  due_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'UPCOMING',
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX followups_due_idx ON followups(status, due_at);

CREATE TABLE waitlist_entries (
  id UUID PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id),
  reason TEXT NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
  notes TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'WAITING',
  arrived_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(60) NOT NULL,
  title_ar VARCHAR(180) NOT NULL,
  message_ar TEXT NOT NULL,
  entity_type VARCHAR(60),
  entity_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE activity_logs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(60) NOT NULL,
  entity_id UUID,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX activity_logs_time_idx ON activity_logs(created_at DESC);
CREATE INDEX activity_logs_patient_idx ON activity_logs(patient_id, created_at DESC);

CREATE TABLE clinic_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE working_hours (
  id UUID PRIMARY KEY,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_working BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(doctor_id, day_of_week)
);

INSERT INTO roles (id, code, name_ar, description_ar) VALUES
('10000000-0000-0000-0000-000000000001','ADMIN_DOCTOR','المدير / الطبيبة','صلاحيات طبية وإدارية كاملة'),
('10000000-0000-0000-0000-000000000002','RECEPTION','الاستقبال','إدارة المواعيد والمرضى والاستقبال'),
('10000000-0000-0000-0000-000000000003','NURSE','التمريض','القياسات الحيوية وحالة المريض');

INSERT INTO permissions (id, code, name_ar, category) VALUES
('20000000-0000-0000-0000-000000000001','patients.view','عرض المرضى','patients'),
('20000000-0000-0000-0000-000000000002','patients.manage','إدارة المرضى','patients'),
('20000000-0000-0000-0000-000000000003','appointments.view','عرض المواعيد','appointments'),
('20000000-0000-0000-0000-000000000004','appointments.manage','إدارة المواعيد','appointments'),
('20000000-0000-0000-0000-000000000005','visits.view','عرض الزيارات الطبية','clinical'),
('20000000-0000-0000-0000-000000000006','visits.manage','إدارة الزيارات الطبية','clinical'),
('20000000-0000-0000-0000-000000000007','vitals.manage','إدارة القياسات الحيوية','clinical'),
('20000000-0000-0000-0000-000000000008','prescriptions.manage','إدارة الوصفات','clinical'),
('20000000-0000-0000-0000-000000000009','attachments.manage','إدارة المرفقات','clinical'),
('20000000-0000-0000-0000-000000000010','reports.view','عرض التقارير','reports'),
('20000000-0000-0000-0000-000000000011','settings.manage','إدارة الإعدادات','settings'),
('20000000-0000-0000-0000-000000000012','users.manage','إدارة المستخدمين والصلاحيات','settings'),
('20000000-0000-0000-0000-000000000013','activity.view','عرض سجل النشاط','settings'),
('20000000-0000-0000-0000-000000000014','followups.manage','إدارة المتابعات','appointments'),
('20000000-0000-0000-0000-000000000015','waitlist.manage','إدارة قائمة الانتظار','appointments');

INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000001', id FROM permissions;
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000002', id FROM permissions WHERE code IN ('patients.view','patients.manage','appointments.view','appointments.manage','followups.manage','waitlist.manage');
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000003', id FROM permissions WHERE code IN ('patients.view','appointments.view','vitals.manage','waitlist.manage');

INSERT INTO doctors (id, full_name, specialty, is_active) VALUES
('30000000-0000-0000-0000-000000000001','د. رغد حسين','طب الأسرة',TRUE);

INSERT INTO clinic_settings (key, value) VALUES
('clinic_profile','{"name":"عيادة د. رغد حسين","doctorName":"د. رغد حسين","specialty":"طب الأسرة","phone":"","address":""}'),
('appointment_settings','{"defaultDurationMinutes":30,"preventOverlap":true,"completedVisibleHours":12}'),
('reminder_settings','{"smsEnabled":false,"whatsappEnabled":false,"reminderHoursBefore":24,"language":"ar","template":"نذكّركم بموعدكم في عيادة د. رغد حسين بتاريخ {{date}} الساعة {{time}}"}'),
('appearance_settings','{"theme":"light","fontSize":"medium","motionLevel":"full"}');
