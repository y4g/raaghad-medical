import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { db } from './client';

export async function runMigrations(): Promise<void> {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  const directory = path.resolve(process.cwd(), 'migrations');
  const files = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort();
  const applied = await db.query<{ name: string }>('SELECT name FROM schema_migrations');
  const appliedNames = new Set(applied.rows.map((migration) => migration.name));

  for (const file of files) {
    if (appliedNames.has(file)) continue;
    const sql = await readFile(path.join(directory, file), 'utf8');
    await db.query('BEGIN');
    try {
      await db.exec(sql);
      await db.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  }
}
