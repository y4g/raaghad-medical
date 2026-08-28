"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSetupRequired = isSetupRequired;
exports.createInitialAdmin = createInitialAdmin;
exports.registerDoctor = registerDoctor;
exports.authenticate = authenticate;
exports.startSession = startSession;
exports.getSessionUser = getSessionUser;
exports.endSession = endSession;
const node_crypto_1 = require("node:crypto");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const client_1 = require("../db/client");
const SESSION_COOKIE = "clinic_session";
const SESSION_DAYS = 7;
function hashToken(token) {
    return (0, node_crypto_1.createHash)("sha256").update(token).digest("hex");
}
function readCookie(request, name) {
    const cookies = request.headers.cookie?.split(";") ?? [];
    const cookie = cookies.find((entry) => entry.trim().startsWith(`${name}=`));
    return cookie
        ? decodeURIComponent(cookie.trim().slice(name.length + 1))
        : undefined;
}
function publicUser(row) {
    return {
        id: row.id,
        fullName: row.full_name,
        email: row.email,
        roleCode: row.role_code,
        roleName: row.role_name,
        permissions: row.permissions ?? [],
    };
}
async function getUserById(id) {
    const result = await client_1.db.query(`SELECT u.id, u.full_name, u.email, u.password_hash, u.is_active,
      r.code AS role_code, r.name_ar AS role_name,
      COALESCE(array_agg(p.code) FILTER (WHERE p.code IS NOT NULL), ARRAY[]::varchar[]) AS permissions
    FROM users u
    JOIN roles r ON r.id = u.role_id
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    LEFT JOIN permissions p ON p.id = rp.permission_id
    WHERE u.id = $1
    GROUP BY u.id, r.code, r.name_ar`, [id]);
    return result.rows[0] ?? null;
}
async function isSetupRequired() {
    const result = await client_1.db.query("SELECT COUNT(*)::text AS count FROM users");
    return Number(result.rows[0]?.count ?? 0) === 0;
}
async function createInitialAdmin(input) {
    if (!(await isSetupRequired()))
        throw new Error("SETUP_ALREADY_COMPLETED");
    const id = (0, node_crypto_1.randomUUID)();
    const passwordHash = await bcryptjs_1.default.hash(input.password, 12);
    await client_1.db.query("BEGIN");
    try {
        await client_1.db.query(`INSERT INTO users (id, full_name, email, password_hash, role_id)
      VALUES ($1,$2,$3,$4,'10000000-0000-0000-0000-000000000001')`, [id, input.fullName, input.email.toLowerCase(), passwordHash]);
        await client_1.db.query(`UPDATE doctors SET user_id=$1, full_name='د. رغد حسين', specialty='طب الأسرة', updated_at=CURRENT_TIMESTAMP
      WHERE id='30000000-0000-0000-0000-000000000001'`, [id]);
        await client_1.db.query("COMMIT");
    }
    catch (error) {
        await client_1.db.query("ROLLBACK");
        throw error;
    }
    const user = await getUserById(id);
    if (!user)
        throw new Error("USER_CREATION_FAILED");
    return publicUser(user);
}
async function registerDoctor(input) {
    if (await isSetupRequired())
        throw new Error("SETUP_REQUIRED");
    const userId = (0, node_crypto_1.randomUUID)();
    const doctorId = (0, node_crypto_1.randomUUID)();
    const passwordHash = await bcryptjs_1.default.hash(input.password, 12);
    await client_1.db.query("BEGIN");
    try {
        await client_1.db.query(`INSERT INTO users (id,full_name,email,password_hash,role_id,phone)
       VALUES ($1,$2,$3,$4,'10000000-0000-0000-0000-000000000004',$5)`, [
            userId,
            input.fullName,
            input.email.toLowerCase(),
            passwordHash,
            input.phone || null,
        ]);
        await client_1.db.query(`INSERT INTO doctors (id,user_id,full_name,specialty,phone,license_number,is_active)
       VALUES ($1,$2,$3,$4,$5,$6,TRUE)`, [
            doctorId,
            userId,
            input.fullName,
            input.specialty,
            input.phone || null,
            input.licenseNumber || null,
        ]);
        await client_1.db.query("COMMIT");
    }
    catch (error) {
        await client_1.db.query("ROLLBACK");
        throw error;
    }
    const user = await getUserById(userId);
    if (!user)
        throw new Error("USER_CREATION_FAILED");
    return publicUser(user);
}
async function authenticate(email, password) {
    const result = await client_1.db.query(`SELECT u.id, u.full_name, u.email, u.password_hash, u.is_active,
      r.code AS role_code, r.name_ar AS role_name,
      COALESCE(array_agg(p.code) FILTER (WHERE p.code IS NOT NULL), ARRAY[]::varchar[]) AS permissions
    FROM users u JOIN roles r ON r.id=u.role_id
    LEFT JOIN role_permissions rp ON rp.role_id=r.id LEFT JOIN permissions p ON p.id=rp.permission_id
    WHERE lower(u.email)=lower($1)
    GROUP BY u.id,r.code,r.name_ar`, [email]);
    const user = result.rows[0];
    if (!user ||
        !user.is_active ||
        !(await bcryptjs_1.default.compare(password, user.password_hash)))
        return null;
    await client_1.db.query("UPDATE users SET last_login_at=CURRENT_TIMESTAMP WHERE id=$1", [user.id]);
    return publicUser(user);
}
async function startSession(userId, request, response) {
    const token = (0, node_crypto_1.randomBytes)(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await client_1.db.query(`INSERT INTO user_sessions (token_hash,user_id,expires_at,ip_address,user_agent)
    VALUES ($1,$2,$3,$4,$5)`, [
        hashToken(token),
        userId,
        expiresAt.toISOString(),
        request.ip,
        request.get("user-agent")?.slice(0, 500),
    ]);
    response.cookie(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: SESSION_DAYS * 86400000,
        path: "/",
    });
}
async function getSessionUser(request) {
    const token = readCookie(request, SESSION_COOKIE);
    if (!token)
        return null;
    const session = await client_1.db.query(`SELECT user_id FROM user_sessions
    WHERE token_hash=$1 AND expires_at>CURRENT_TIMESTAMP`, [hashToken(token)]);
    if (!session.rows[0])
        return null;
    const user = await getUserById(session.rows[0].user_id);
    return user?.is_active ? publicUser(user) : null;
}
async function endSession(request, response) {
    const token = readCookie(request, SESSION_COOKIE);
    if (token)
        await client_1.db.query("DELETE FROM user_sessions WHERE token_hash=$1", [
            hashToken(token),
        ]);
    response.clearCookie(SESSION_COOKIE, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
    });
}
