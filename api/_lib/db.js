import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL no configurada')
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
})

let initialized = false

export async function ensureTables() {
  if (initialized) return

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_verified BOOLEAN NOT NULL DEFAULT FALSE,
      verification_code_hash TEXT,
      verification_expires_at TIMESTAMPTZ,
      name TEXT,
      birth_year INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
  `)

  initialized = true
}

export { pool }
