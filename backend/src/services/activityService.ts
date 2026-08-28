import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { db } from '../db/client';

export async function logActivity(request: Request, input: { action: string; entityType: string; entityId?: string; patientId?: string; details?: Record<string, unknown> }): Promise<void> {
  await db.query(`INSERT INTO activity_logs (id,user_id,action,entity_type,entity_id,patient_id,details,ip_address)
    VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`, [randomUUID(), request.currentUser?.id ?? null, input.action, input.entityType, input.entityId ?? null, input.patientId ?? null, JSON.stringify(input.details ?? {}), request.ip]);
}
