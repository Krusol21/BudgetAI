require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

const dbWrapper = {
  prepare(sql) {
    let i = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++i}`);
    return {
      async all(params = []) {
        const { rows } = await pool.query(pgSql, params);
        return rows;
      },
      async get(params = []) {
        const { rows } = await pool.query(pgSql, params);
        return rows[0] || undefined;
      },
      async run(params = []) {
        const result = await pool.query(pgSql, params);
        return { changes: result.rowCount };
      },
    };
  },
};

function getDb() {
  return dbWrapper;
}

async function initDb() {
  await migrate();
  console.log('[db] PostgreSQL ready');
}

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      budget_limit REAL NOT NULL,
      period TEXT NOT NULL DEFAULT 'monthly',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, category)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      category TEXT,
      is_expense INTEGER NOT NULL DEFAULT 1,
      funding_source TEXT NOT NULL DEFAULT 'personal',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS forecasts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      period_end TEXT NOT NULL,
      predicted_balance REAL NOT NULL,
      summary TEXT,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS parental_budgets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      annual_limit REAL NOT NULL,
      year INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, year)
    );

    CREATE TABLE IF NOT EXISTS parental_manual_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      month TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_budgets_user ON budgets(user_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, created_at);
  `);
}

module.exports = { getDb, initDb, pool };
