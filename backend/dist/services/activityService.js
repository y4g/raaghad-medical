"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logActivity = logActivity;
const node_crypto_1 = require("node:crypto");
const client_1 = require("../db/client");
async function logActivity(request, input) {
    await client_1.db.query(`INSERT INTO activity_logs (id,user_id,action,entity_type,entity_id,patient_id,details,ip_address)
    VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`, [(0, node_crypto_1.randomUUID)(), request.currentUser?.id ?? null, input.action, input.entityType, input.entityId ?? null, input.patientId ?? null, JSON.stringify(input.details ?? {}), request.ip]);
}
