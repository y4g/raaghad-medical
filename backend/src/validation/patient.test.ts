import assert from 'node:assert/strict';
import test from 'node:test';
import { patientSchema } from './patient';

test('accepts valid patient data', () => {
  const result = patientSchema.safeParse({
    fullName: 'أحمد علي',
    phone: '+962 79 123 4567',
    dateOfBirth: '1990-06-15',
    gender: 'ذكر',
    address: ' عمّان - الجبيهة ',
  });

  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.address, 'عمّان - الجبيهة');
});

test('rejects missing and invalid patient data', () => {
  const result = patientSchema.safeParse({ fullName: '', phone: '12', dateOfBirth: '2099-01-01', gender: 'غير محدد' });
  assert.equal(result.success, false);
  if (!result.success) assert.deepEqual(Object.keys(result.error.flatten().fieldErrors).sort(), ['dateOfBirth', 'fullName', 'gender', 'phone']);
});
