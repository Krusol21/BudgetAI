const fs = require('fs');
const path = require('path');
const { getDb } = require('../database');

const SNAPSHOT_PATH = path.join(__dirname, '..', '..', 'budget-snapshot.md');

const fmt = n => `$${Math.abs(n).toFixed(2)}`;

function statusIcon(pct) {
  if (pct >= 100) return '🔴 Over budget';
  if (pct >= 90) return '🟠 Almost full';
  if (pct >= 75) return '🟡 Watch this';
  return '✅ On track';
}

function syncSnapshot(userId) {
  try {
    const db = getDb();
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const updatedAt = now.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

    const budgets = db.prepare('SELECT * FROM budgets WHERE user_id = ? ORDER BY category').all([userId]);
    const spending = db.prepare(`
      SELECT category, SUM(amount) as spent
      FROM transactions WHERE user_id = ? AND date >= ? AND is_expense = 1
      GROUP BY category
    `).all([userId, monthStart]);
    const spendMap = {};
    for (const s of spending) spendMap[s.category] = s.spent;

    const budgetRows = budgets.map(b => {
      const spent = spendMap[b.category] || 0;
      const remaining = b.budget_limit - spent;
      const pct = b.budget_limit > 0 ? Math.round((spent / b.budget_limit) * 100) : 0;
      return { ...b, spent, remaining, pct };
    });

    const totalBudget = budgetRows.reduce((s, b) => s + b.budget_limit, 0);
    const totalSpent = budgetRows.reduce((s, b) => s + b.spent, 0);
    const totalRemaining = totalBudget - totalSpent;

    const transactions = db.prepare(`
      SELECT date, description, category, amount, is_expense
      FROM transactions WHERE user_id = ?
      ORDER BY date DESC, created_at DESC
      LIMIT 30
    `).all([userId]);

    const income = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM transactions
      WHERE user_id = ? AND date >= ? AND is_expense = 0
    `).get([userId, monthStart]).total;

    const year = now.getFullYear();
    const yearPrefix = `${year}-%`;
    const parentalBudget = db.prepare(
      'SELECT annual_limit FROM parental_budgets WHERE user_id = ? AND year = ?'
    ).get([userId, year]);
    const parentalCCSpent = db.prepare(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
       WHERE user_id = ? AND funding_source = 'parental' AND is_expense = 1 AND date LIKE ?`
    ).get([userId, yearPrefix]).total;
    const parentalManualSpent = db.prepare(
      `SELECT COALESCE(SUM(amount), 0) as total FROM parental_manual_entries WHERE user_id = ? AND month LIKE ?`
    ).get([userId, yearPrefix]).total;
    const parentalRent = db.prepare(
      `SELECT COALESCE(SUM(amount), 0) as total FROM parental_manual_entries WHERE user_id = ? AND category = 'Rent' AND month LIKE ?`
    ).get([userId, yearPrefix]).total;
    const parentalUtilities = db.prepare(
      `SELECT COALESCE(SUM(amount), 0) as total FROM parental_manual_entries WHERE user_id = ? AND category = 'Utilities' AND month LIKE ?`
    ).get([userId, yearPrefix]).total;
    const parentalTotal = parentalCCSpent + parentalManualSpent;

    const lines = [];
    lines.push(`# Budget Snapshot — ${monthLabel}`);
    lines.push(`_Last updated: ${updatedAt}_`);
    lines.push('');
    if (parentalBudget) {
      const parentalRemaining = parentalBudget.annual_limit - parentalTotal;
      const parentalPct = Math.round((parentalTotal / parentalBudget.annual_limit) * 100);
      lines.push(`## Parents' Annual Budget (${year})`);
      lines.push('');
      lines.push('| | Amount |');
      lines.push('|---|---|');
      lines.push(`| Annual Limit | **${fmt(parentalBudget.annual_limit)}** |`);
      lines.push(`| Total Used | **${fmt(parentalTotal)}** (${parentalPct}%) |`);
      lines.push(`| Remaining | **${parentalRemaining >= 0 ? fmt(parentalRemaining) : `-${fmt(Math.abs(parentalRemaining))}`}** |`);
      lines.push(`| Credit Card | ${fmt(parentalCCSpent)} |`);
      lines.push(`| Rent | ${fmt(parentalRent)} |`);
      lines.push(`| Utilities | ${fmt(parentalUtilities)} |`);
      lines.push('');
    }
    lines.push('## Month Summary');
    lines.push('');
    lines.push(`| | Amount |`);
    lines.push(`|---|---|`);
    lines.push(`| Total Budget | **${fmt(totalBudget)}** |`);
    lines.push(`| Spent So Far | **${fmt(totalSpent)}** |`);
    lines.push(`| Remaining | **${totalRemaining >= 0 ? fmt(totalRemaining) : `-${fmt(Math.abs(totalRemaining))}`}** |`);
    if (income > 0) lines.push(`| Income This Month | **${fmt(income)}** |`);
    lines.push('');
    lines.push('## Monthly Budgets');
    lines.push('');
    if (budgetRows.length === 0) {
      lines.push('_No budgets configured yet._');
    } else {
      lines.push('| Category | Spent | Limit | Remaining | Status |');
      lines.push('|---|---|---|---|---|');
      for (const b of budgetRows) {
        const remainStr = b.remaining >= 0 ? fmt(b.remaining) : `-${fmt(Math.abs(b.remaining))}`;
        lines.push(`| ${b.category} | ${fmt(b.spent)} | ${fmt(b.budget_limit)} | ${remainStr} | ${statusIcon(b.pct)} (${b.pct}%) |`);
      }
    }
    lines.push('');
    lines.push('## Recent Transactions (last 30)');
    lines.push('');
    if (transactions.length === 0) {
      lines.push('_No transactions yet. Upload a bank statement to get started._');
    } else {
      lines.push('| Date | Description | Category | Amount |');
      lines.push('|---|---|---|---|');
      for (const t of transactions) {
        const amtStr = t.is_expense ? `-${fmt(t.amount)}` : `+${fmt(t.amount)}`;
        const desc = t.description.length > 50 ? t.description.slice(0, 47) + '…' : t.description;
        lines.push(`| ${t.date} | ${desc} | ${t.category || '—'} | ${amtStr} |`);
      }
    }
    lines.push('');
    lines.push('---');
    lines.push('_This file is auto-generated. Edit budgets and transactions in the BudgetAI app._');

    fs.writeFileSync(SNAPSHOT_PATH, lines.join('\n'), 'utf8');
  } catch (err) {
    console.error('[snapshot] Failed to write budget-snapshot.md:', err.message);
  }
}

module.exports = { syncSnapshot };
