import { createHash, randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import { db } from "../db/client";

const SESSION_COOKIE = "clinic_session";
const SESSION_DAYS = 7;

export interface AuthenticatedUser {
  id: string;
  fullName: string;
  email: string;
  roleCode: string;
  roleName: string;
  permissions: string[];
}

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  password_hash: string;
  is_active: boolean;
  role_code: string;
  role_name: string;
  permissions: string[];
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function readCookie(request: Request, name: string): string | undefined {
  const cookies = request.headers.cookie?.split(";") ?? [];
  const cookie = cookies.find((entry) => entry.trim().startsWith(`${name}=`));
  return cookie
    ? decodeURIComponent(cookie.trim().slice(name.length + 1))
    : undefined;
}

function publicUser(row: UserRow): AuthenticatedUser {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    roleCode: row.role_code,
    roleName: row.role_name,
    permissions: row.permissions ?? [],
  };
}

async function getUserById(id: string): Promise<UserRow | null> {
  const result = await db.query<UserRow>(
    `SELECT u.id, u.full_name, u.email, u.password_hash, u.is_active,
      r.code AS role_code, r.name_ar AS role_name,
      COALESCE(array_agg(p.code) FILTER (WHERE p.code IS NOT NULL), ARRAY[]::varchar[]) AS permissions
    FROM users u
    JOIN roles r ON r.id = u.role_id
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    LEFT JOIN permissions p ON p.id = rp.permission_id
    WHERE u.id = $1
    GROUP BY u.id, r.code, r.name_ar`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function isSetupRequired(): Promise<boolean> {
  const result = await db.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM users",
  );
  return Number(result.rows[0]?.count ?? 0) === 0;
}

export async function createInitialAdmin(input: {
  fullName: string;
  email: string;
  password: string;
}): Promise<AuthenticatedUser> {
  if (!(await isSetupRequired())) throw new Error("SETUP_ALREADY_COMPLETED");
  const id = randomUUID();
  const passwordHash = await bcrypt.hash(input.password, 12);
  await db.query("BEGIN");
  try {
    await db.query(
      `INSERT INTO users (id, full_name, email, password_hash, role_id)
      VALUES ($1,$2,$3,$4,'10000000-0000-0000-0000-000000000001')`,
      [id, input.fullName, input.email.toLowerCase(), passwordHash],
    );
    await db.query(
      `UPDATE doctors SET user_id=$1, full_name='د. رغد حسين', specialty='طب الأسرة', updated_at=CURRENT_TIMESTAMP
      WHERE id='30000000-0000-0000-0000-000000000001'`,
      [id],
    );
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
  const user = await getUserById(id);
  if (!user) throw new Error("USER_CREATION_FAILED");
  return publicUser(user);
}

export interface DoctorRegistrationInput {
  fullName: string;
  email: string;
  password: string;
  specialty: string;
  phone?: string;
  licenseNumber?: string;
}

export async function registerDoctor(
  input: DoctorRegistrationInput,
): Promise<AuthenticatedUser> {
  if (await isSetupRequired()) throw new Error("SETUP_REQUIRED");

  const userId = randomUUID();
  const doctorId = randomUUID();
  const passwordHash = await bcrypt.hash(input.password, 12);
  await db.query("BEGIN");
  try {
    await db.query(
      `INSERT INTO users (id,full_name,email,password_hash,role_id,phone)
       VALUES ($1,$2,$3,$4,'10000000-0000-0000-0000-000000000004',$5)`,
      [
        userId,
        input.fullName,
        input.email.toLowerCase(),
        passwordHash,
        input.phone || null,
      ],
    );
    await db.query(
      `INSERT INTO doctors (id,user_id,full_name,specialty,phone,license_number,is_active)
       VALUES ($1,$2,$3,$4,$5,$6,TRUE)`,
      [
        doctorId,
        userId,
        input.fullName,
        input.specialty,
        input.phone || null,
        input.licenseNumber || null,
      ],
    );
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }

  const user = await getUserById(userId);
  if (!user) throw new Error("USER_CREATION_FAILED");
  return publicUser(user);
}

export async function authenticate(
  email: string,
  password: string,
): Promise<AuthenticatedUser | null> {
  const result = await db.query<UserRow>(
    `SELECT u.id, u.full_name, u.email, u.password_hash, u.is_active,
      r.code AS role_code, r.name_ar AS role_name,
      COALESCE(array_agg(p.code) FILTER (WHERE p.code IS NOT NULL), ARRAY[]::varchar[]) AS permissions
    FROM users u JOIN roles r ON r.id=u.role_id
    LEFT JOIN role_permissions rp ON rp.role_id=r.id LEFT JOIN permissions p ON p.id=rp.permission_id
    WHERE lower(u.email)=lower($1)
    GROUP BY u.id,r.code,r.name_ar`,
    [email],
  );
  const user = result.rows[0];
  if (
    !user ||
    !user.is_active ||
    !(await bcrypt.compare(password, user.password_hash))
  )
    return null;
  await db.query(
    "UPDATE users SET last_login_at=CURRENT_TIMESTAMP WHERE id=$1",
    [user.id],
  );
  return publicUser(user);
}

export async function startSession(
  userId: string,
  request: Request,
  response: Response,
): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.query(
    `INSERT INTO user_sessions (token_hash,user_id,expires_at,ip_address,user_agent)
    VALUES ($1,$2,$3,$4,$5)`,
    [
      hashToken(token),
      userId,
      expiresAt.toISOString(),
      request.ip,
      request.get("user-agent")?.slice(0, 500),
    ],
  );
  response.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_DAYS * 86400000,
    path: "/",
  });
}

export async function getSessionUser(
  request: Request,
): Promise<AuthenticatedUser | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const session = await db.query<{ user_id: string }>(
    `SELECT user_id FROM user_sessions
    WHERE token_hash=$1 AND expires_at>CURRENT_TIMESTAMP`,
    [hashToken(token)],
  );
  if (!session.rows[0]) return null;
  const user = await getUserById(session.rows[0].user_id);
  return user?.is_active ? publicUser(user) : null;
}

export async function endSession(
  request: Request,
  response: Response,
): Promise<void> {
  const token = readCookie(request, SESSION_COOKIE);
  if (token)
    await db.query("DELETE FROM user_sessions WHERE token_hash=$1", [
      hashToken(token),
    ]);
  response.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });
}
