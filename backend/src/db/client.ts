import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

export interface DatabaseClient {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

class PostgresClient implements DatabaseClient {
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: Number(process.env.DB_POOL_SIZE || 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    });
  }

  async query<T>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    const result = await this.pool.query(sql, params);
    return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
  }

  async exec(sql: string): Promise<void> { await this.pool.query(sql); }

  async close(): Promise<void> { await this.pool.end(); }
}

class LocalPostgresClient implements DatabaseClient {
  private readonly database: PGlite;

  constructor(dataDirectory: string) { this.database = new PGlite(dataDirectory); }

  async query<T>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    const result = await this.database.query<T>(sql, params);
    return { rows: result.rows, rowCount: result.rows.length || result.affectedRows || 0 };
  }

  async exec(sql: string): Promise<void> { await this.database.exec(sql); }

  async close(): Promise<void> { await this.database.close(); }
}

function createDatabase(): DatabaseClient {
  if (process.env.DATABASE_URL) return new PostgresClient(process.env.DATABASE_URL);
  if (process.env.NODE_ENV === 'production') throw new Error('DATABASE_URL is required in production.');
  const directory = path.resolve(process.env.LOCAL_DATABASE_DIR || path.join(process.cwd(), 'data', 'clinic-db'));
  return new LocalPostgresClient(directory);
}

export const db = createDatabase();
