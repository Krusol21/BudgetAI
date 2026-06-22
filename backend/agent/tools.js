const Anthropic = require('@anthropic-ai/sdk');
const { getDb } = require('../database');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a smart, friendly personal finance assistant for a college student.
You have access to their real transaction data, budget limits, and spending history.
Be specific and actionable. Always show actual numbers from their data. Be encouraging but honest.
Keep responses concise — 2-4 sentences for simple questions, structured with bullet points for analysis.
Never make up numbers. Only use data from tool calls.`;

const TOOLS = [
  {
    name: 'get_budget_state',
    description: 'Get current budget categories, limits, and how much has been spent this month vs the limit.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_transactions',
    description: 'Get transactions filtered by category and/or date range.',
    input_schema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Filter by category name (optional)' },
        days_back: { type: 'number', description: 'How many days back to look (default 30)' },
        limit: { type: 'number', description: 'Max transactions to return (default 20)' },
      },
      required: [],
    },
  },
  {
    name: 'forecast_balance',
    description: 'Forecast the user\'s balance at the end of the current month based on spending trends.',
    input_schema: {
      type: 'object',
      properties: {
        monthly_income: { type: 'number', description: 'User\'s estimated monthly income or stipend (optional)' },
      },
      required: [],
    },
  },
  {
    name: 'suggest_reallocation',
    description: 'Suggest how to reallocate budget to free up funds for a specific need.',
    input_schema: {
      type: 'object',
      properties: {
        target_amount: { type: 'number', description: 'Amount of money needed' },
        target_reason: { type: 'string', description: 'What the money is for (e.g. "textbook", "trip")' },
      },
      required: ['target_amount'],
    },
  },
  {
    name: 'get_spending_summary',
    description: 'Get a summary of total spending by category for a given period.',
    input_schema: {
      type: 'object',
      properties: {
        days_back: { type: 'number', description: 'Days to look back (default 30)' },
      },
      required: [],
    },
  },
  {
    name: 'get_parental_budget',
    description: "Get the user's parental annual budget: total limit, amount spent (credit card + rent + utilities), and how much is remaining for the year.",
    input_schema: { type: 'object', properties: {}, required: [] },
  },
];

function executeTool(userId, toolName, toolInput) {
  const db = getDb();
  const now = new Date();

  switch (toolName) {
    case 'get_budget_state': {
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const budgets = db.prepare('SELECT * FROM budgets WHERE user_id = ?').all([userId]);
      const spending = db.prepare(`
        SELECT category, SUM(amount) as spent
        FROM transactions WHERE user_id = ? AND date >= ? AND is_expense = 1
        GROUP BY category
      `).all([userId, monthStart]);
      const spendMap = {};
      for (const s of spending) spendMap[s.category] = s.spent;

      return budgets.map(b => ({
        category: b.category,
        limit: b.budget_limit,
        spent: Math.round((spendMap[b.category] || 0) * 100) / 100,
        remaining: Math.round((b.budget_limit - (spendMap[b.category] || 0)) * 100) / 100,
        percentUsed: Math.round(((spendMap[b.category] || 0) / b.budget_limit) * 100),
      }));
    }

    case 'get_transactions': {
      const daysBack = toolInput.days_back || 30;
      const cutoff = new Date(now - daysBack * 86400000).toISOString().split('T')[0];
      let query = 'SELECT date, amount, description, category, is_expense FROM transactions WHERE user_id = ? AND date >= ?';
      const params = [userId, cutoff];
      if (toolInput.category) { query += ' AND category = ?'; params.push(toolInput.category); }
      query += ' ORDER BY date DESC LIMIT ?';
      params.push(toolInput.limit || 20);
      return db.prepare(query).all(params);
    }

    case 'forecast_balance': {
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const dayOfMonth = now.getDate();
      const daysRemaining = daysInMonth - dayOfMonth;

      const spentThisMonth = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total FROM transactions
        WHERE user_id = ? AND date >= ? AND is_expense = 1
      `).get([userId, monthStart]).total;

      const incomeThisMonth = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total FROM transactions
        WHERE user_id = ? AND date >= ? AND is_expense = 0
      `).get([userId, monthStart]).total;

      const dailyRate = spentThisMonth / Math.max(dayOfMonth, 1);
      const projectedAdditionalSpend = dailyRate * daysRemaining;
      const budgets = db.prepare('SELECT SUM(budget_limit) as total FROM budgets WHERE user_id = ?').get([userId]);

      return {
        monthStart,
        daysInMonth,
        dayOfMonth,
        daysRemaining,
        spentSoFar: Math.round(spentThisMonth * 100) / 100,
        incomeThisMonth: Math.round(incomeThisMonth * 100) / 100,
        dailySpendRate: Math.round(dailyRate * 100) / 100,
        projectedAdditionalSpend: Math.round(projectedAdditionalSpend * 100) / 100,
        projectedMonthTotal: Math.round((spentThisMonth + projectedAdditionalSpend) * 100) / 100,
        totalBudgetLimit: Math.round((budgets.total || 0) * 100) / 100,
        estimatedMonthlyIncome: toolInput.monthly_income || null,
      };
    }

    case 'suggest_reallocation': {
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const budgets = db.prepare('SELECT * FROM budgets WHERE user_id = ?').all([userId]);
      const spending = db.prepare(`
        SELECT category, SUM(amount) as spent FROM transactions
        WHERE user_id = ? AND date >= ? AND is_expense = 1 GROUP BY category
      `).all([userId, monthStart]);
      const spendMap = {};
      for (const s of spending) spendMap[s.category] = s.spent;

      const withSlack = budgets
        .map(b => ({ category: b.category, limit: b.budget_limit, spent: spendMap[b.category] || 0, slack: b.budget_limit - (spendMap[b.category] || 0) }))
        .filter(b => b.slack > 0)
        .sort((a, b) => b.slack - a.slack);

      return {
        targetAmount: toolInput.target_amount,
        targetReason: toolInput.target_reason || 'unspecified',
        categoriesWithSlack: withSlack,
        totalAvailableSlack: Math.round(withSlack.reduce((s, b) => s + b.slack, 0) * 100) / 100,
      };
    }

    case 'get_spending_summary': {
      const daysBack = toolInput.days_back || 30;
      const cutoff = new Date(now - daysBack * 86400000).toISOString().split('T')[0];
      return db.prepare(`
        SELECT category, SUM(amount) as total, COUNT(*) as count
        FROM transactions WHERE user_id = ? AND date >= ? AND is_expense = 1
        GROUP BY category ORDER BY total DESC
      `).all([userId, cutoff]);
    }

    case 'get_parental_budget': {
      const year = now.getFullYear();
      const yearPrefix = `${year}-%`;
      const budget = db.prepare('SELECT annual_limit FROM parental_budgets WHERE user_id = ? AND year = ?').get([userId, year]);
      const ccRow = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND funding_source = 'parental' AND is_expense = 1 AND date LIKE ?`).get([userId, yearPrefix]);
      const manualRow = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM parental_manual_entries WHERE user_id = ? AND month LIKE ?`).get([userId, yearPrefix]);
      const rentRow = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM parental_manual_entries WHERE user_id = ? AND category = 'Rent' AND month LIKE ?`).get([userId, yearPrefix]);
      const utilRow = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM parental_manual_entries WHERE user_id = ? AND category = 'Utilities' AND month LIKE ?`).get([userId, yearPrefix]);
      const creditCardSpent = ccRow ? ccRow.total : 0;
      const manualSpent = manualRow ? manualRow.total : 0;
      const totalSpent = creditCardSpent + manualSpent;
      const annualLimit = budget ? budget.annual_limit : null;
      return {
        year,
        annualLimit,
        totalSpent: Math.round(totalSpent * 100) / 100,
        remaining: annualLimit !== null ? Math.round((annualLimit - totalSpent) * 100) / 100 : null,
        percentUsed: annualLimit ? Math.round((totalSpent / annualLimit) * 100) : null,
        breakdown: {
          creditCard: Math.round(creditCardSpent * 100) / 100,
          rent: rentRow ? Math.round(rentRow.total * 100) / 100 : 0,
          utilities: utilRow ? Math.round(utilRow.total * 100) / 100 : 0,
        },
      };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

async function categorizeTransaction(description, amount, existingCategories) {
  const categoryList = existingCategories.length > 0
    ? existingCategories.join(', ')
    : 'Groceries, Dining Out, Transportation, Entertainment, Textbooks & Supplies, Personal Care, Utilities, Miscellaneous';

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 50,
      messages: [{
        role: 'user',
        content: `Categorize this bank transaction into exactly one of these categories: ${categoryList}\n\nTransaction: "${description}" - $${amount}\n\nRespond with ONLY the category name, nothing else.`,
      }],
    });
    const raw = response.content[0]?.text?.trim() || 'Miscellaneous';
    const matched = existingCategories.find(c => c.toLowerCase() === raw.toLowerCase());
    return matched || raw;
  } catch {
    return 'Miscellaneous';
  }
}

async function runAgent(userId, conversationHistory) {
  const messages = conversationHistory.map(h => ({ role: h.role, content: h.content }));

  let response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: TOOLS,
    messages,
  });

  while (response.stop_reason === 'tool_use') {
    const toolUseBlock = response.content.find(b => b.type === 'tool_use');
    const toolResult = executeTool(userId, toolUseBlock.name, toolUseBlock.input);

    messages.push({ role: 'assistant', content: response.content });
    messages.push({
      role: 'user',
      content: [{
        type: 'tool_result',
        tool_use_id: toolUseBlock.id,
        content: JSON.stringify(toolResult),
      }],
    });

    response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    });
  }

  const textBlock = response.content.find(b => b.type === 'text');
  return textBlock?.text || 'I was unable to generate a response. Please try again.';
}

module.exports = { runAgent, categorizeTransaction };
