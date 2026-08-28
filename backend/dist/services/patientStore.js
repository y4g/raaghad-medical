"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPatients = listPatients;
exports.createPatient = createPatient;
exports.updatePatient = updatePatient;
exports.removePatient = removePatient;
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const dataDirectory = node_path_1.default.resolve(process.env.DATA_DIR || node_path_1.default.join(process.cwd(), 'data'));
const dataFile = node_path_1.default.join(dataDirectory, 'patients.json');
let writeQueue = Promise.resolve();
async function readPatients() {
    try {
        const contents = await (0, promises_1.readFile)(dataFile, 'utf8');
        const parsed = JSON.parse(contents);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch (error) {
        if (error.code === 'ENOENT')
            return [];
        throw error;
    }
}
function persistPatients(patients) {
    const operation = writeQueue.then(async () => {
        await (0, promises_1.mkdir)(dataDirectory, { recursive: true });
        const temporaryFile = `${dataFile}.tmp`;
        await (0, promises_1.writeFile)(temporaryFile, JSON.stringify(patients, null, 2), 'utf8');
        await (0, promises_1.rename)(temporaryFile, dataFile);
    });
    writeQueue = operation.catch(() => undefined);
    return operation;
}
async function listPatients() {
    const patients = await readPatients();
    return patients.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
async function createPatient(input) {
    const patients = await readPatients();
    const now = new Date().toISOString();
    const patient = { id: (0, node_crypto_1.randomUUID)(), ...input, createdAt: now, updatedAt: now };
    patients.push(patient);
    await persistPatients(patients);
    return patient;
}
async function updatePatient(id, input) {
    const patients = await readPatients();
    const index = patients.findIndex((patient) => patient.id === id);
    if (index === -1)
        return null;
    const updated = { ...patients[index], ...input, updatedAt: new Date().toISOString() };
    patients[index] = updated;
    await persistPatients(patients);
    return updated;
}
async function removePatient(id) {
    const patients = await readPatients();
    const remaining = patients.filter((patient) => patient.id !== id);
    if (remaining.length === patients.length)
        return false;
    await persistPatients(remaining);
    return true;
}
