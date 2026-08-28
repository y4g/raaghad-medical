"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = runMigrations;
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const client_1 = require("./client");
async function runMigrations() {
    await client_1.db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
    const directory = node_path_1.default.resolve(process.cwd(), 'migrations');
    const files = (await (0, promises_1.readdir)(directory)).filter((file) => file.endsWith('.sql')).sort();
    const applied = await client_1.db.query('SELECT name FROM schema_migrations');
    const appliedNames = new Set(applied.rows.map((migration) => migration.name));
    for (const file of files) {
        if (appliedNames.has(file))
            continue;
        const sql = await (0, promises_1.readFile)(node_path_1.default.join(directory, file), 'utf8');
        await client_1.db.query('BEGIN');
        try {
            await client_1.db.exec(sql);
            await client_1.db.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
            await client_1.db.query('COMMIT');
        }
        catch (error) {
            await client_1.db.query('ROLLBACK');
            throw error;
        }
    }
}
