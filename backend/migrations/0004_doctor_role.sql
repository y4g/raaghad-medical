INSERT INTO roles (id, code, name_ar, description_ar)
VALUES (
  '10000000-0000-0000-0000-000000000004',
  'DOCTOR',
  'طبيب',
  'صلاحيات طبية لإدارة السجل السريري دون إدارة المستخدمين أو إعدادات النظام'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000004', id
FROM permissions
WHERE code IN (
  'patients.view',
  'patients.manage',
  'appointments.view',
  'visits.view',
  'visits.manage',
  'vitals.manage',
  'prescriptions.manage',
  'attachments.manage',
  'reports.view',
  'followups.manage'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;
