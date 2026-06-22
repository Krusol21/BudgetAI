require('dotenv').config();
const path = require('path');
const os = require('os');
const fs = require('fs');

const DEFAULT_DB_DIR = path.join(os.homedir(), '.budgetai');
if (!fs.existsSync(DEFAULT_DB_DIR)) fs.mkdirSync(DEFAULT_DB_DIR, { recursive: true });
const DB_PATH = process.env.DB_PATH || path.join(DEFAULT_DB_DIR, 'budget.db');

let sqlDb = null;

function saveToDisk() {
  try {
    fs.writeFileSync(DB_PATH, Buffer.from(sqlDb.export()));
  } catch (err) {
    console.error('[db] Save failed:', err.message);
  }
}

// Wrapper that mimics the better-sqlite3 API used throughout the routes
const dbWrapper = {
  prepare(sql) {
    return {
      all(params = []) {
        const stmt = sqlDb.prepare(sql);
        if (params.length) stmt.bind(params);
        const rows = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();
        return rows;
      },
      get(params = []) {
        const stmt = sqlDb.prepare(sql);
        if (params.length) stmt.bind(params);
        let row;
        if (stmt.step()) row = stmt.getAsObject();
        stmt.free();
        return row;
      },
      run(params = []) {
        const stmt = sqlDb.prepare(sql);
        stmt.run(params);
        const changes = sqlDb.getRowsModified();
        stmt.free();
        saveToDisk();
        return { changes };
      },
    };
  },
  exec(sql) {
    sqlDb.exec(sql);
  },
};

function getDb() {
  if (!sqlDb) throw new Error('Database not initialized — call initDb() first');
  return dbWrapper;
}

async function initDb() {
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    sqlDb = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    sqlDb = new SQL.Database();
  }

  sqlDb.run('PRAGMA foreign_keys = ON');
  migrate();
  saveToDisk();
  console.log(`[db] Ready at ${DB_PATH}`);
}

function migrate() {
  sqlDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      category TEXT NOT NULL,
      budget_limit REAL NOT NULL,
      period TEXT NOT NULL DEFAULT 'monthly',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, category)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      category TEXT,
      is_expense INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS forecasts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      period_end TEXT NOT NULL,
      predicted_balance REAL NOT NULL,
      summary TEXT,
      generated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS parental_budgets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      annual_limit REAL NOT NULL,
      year INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, year)
    );

    CREATE TABLE IF NOT EXISTS parental_manual_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      month TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_budgets_user ON budgets(user_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, created_at);
  `);

  try { sqlDb.run("ALTER TABLE transactions ADD COLUMN funding_source TEXT NOT NULL DEFAULT 'personal'"); } catch (e) {}
}

module.exports = { getDb, initDb };
