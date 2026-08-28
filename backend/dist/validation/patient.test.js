"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const patient_1 = require("./patient");
(0, node_test_1.default)('accepts valid patient data', () => {
    const result = patient_1.patientSchema.safeParse({
        fullName: 'أحمد علي',
        phone: '+962 79 123 4567',
        dateOfBirth: '1990-06-15',
        gender: 'ذكر',
        address: ' عمّان - الجبيهة ',
    });
    strict_1.default.equal(result.success, true);
    if (result.success)
        strict_1.default.equal(result.data.address, 'عمّان - الجبيهة');
});
(0, node_test_1.default)('rejects missing and invalid patient data', () => {
    const result = patient_1.patientSchema.safeParse({ fullName: '', phone: '12', dateOfBirth: '2099-01-01', gender: 'غير محدد' });
    strict_1.default.equal(result.success, false);
    if (!result.success)
        strict_1.default.deepEqual(Object.keys(result.error.flatten().fieldErrors).sort(), ['dateOfBirth', 'fullName', 'gender', 'phone']);
});
