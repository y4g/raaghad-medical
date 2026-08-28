"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const node_path_1 = __importDefault(require("node:path"));
const pglite_1 = require("@electric-sql/pglite");
const pg_1 = require("pg");
class PostgresClient {
    pool;
    constructor(connectionString) {
        this.pool = new pg_1.Pool({
            connectionString,
            max: Number(process.env.DB_POOL_SIZE || 10),
            idleTimeoutMillis: 30_000,
            connectionTimeoutMillis: 10_000,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
        });
    }
    async query(sql, params = []) {
        const result = await this.pool.query(sql, params);
        return { rows: result.rows, rowCount: result.rowCount ?? 0 };
    }
    async exec(sql) { await this.pool.query(sql); }
    async close() { await this.pool.end(); }
}
class LocalPostgresClient {
    database;
    constructor(dataDirectory) { this.database = new pglite_1.PGlite(dataDirectory); }
    async query(sql, params = []) {
        const result = await this.database.query(sql, params);
        return { rows: result.rows, rowCount: result.rows.length || result.affectedRows || 0 };
    }
    async exec(sql) { await this.database.exec(sql); }
    async close() { await this.database.close(); }
}
function createDatabase() {
    if (process.env.DATABASE_URL)
        return new PostgresClient(process.env.DATABASE_URL);
    if (process.env.NODE_ENV === 'production')
        throw new Error('DATABASE_URL is required in production.');
    const directory = node_path_1.default.resolve(process.env.LOCAL_DATABASE_DIR || node_path_1.default.join(process.cwd(), 'data', 'clinic-db'));
    return new LocalPostgresClient(directory);
}
exports.db = createDatabase();
