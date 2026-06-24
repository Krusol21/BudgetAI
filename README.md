# BudgetAI

A full-stack AI-powered personal finance app for college students. Upload bank statements, track spending across categories, ask questions in plain English, and get AI-generated forecasts — all powered by Claude (Anthropic).

Built as a personal project to practice automating workflows, using AI intentionally and responsibly.

---

## Features

| | |
|---|---|
| **CSV Import** | Drag-and-drop bank statement upload with auto-detection of Chase, Bank of America, Capital One, Fidelity, Amex, and any standard CSV format |
| **AI Categorization** | Every transaction is automatically categorized by Claude Haiku |
| **AI Chat Agent** | Ask questions like "Can I afford a weekend trip?" — Claude Sonnet uses live budget data via tool use to answer accurately |
| **Dashboard** | Spending donut chart, daily bar chart, budget progress bars, and a parental budget summary card |
| **Forecast** | Projected month-end balance based on current daily spending rate, with per-category risk flags |
| **Budget Manager** | Create, edit, and delete monthly spending limits per category |
| **Duplicate Detection** | Re-uploading an overlapping statement skips already-imported transactions automatically |

---

## Tech Stack

**Backend**
- Node.js + Express
- SQLite via [sql.js](https://github.com/sql-js/sql-js) (WebAssembly — no native compilation required)
- JWT authentication
- [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-node)

**Frontend**
- React + Vite
- Tailwind CSS
- Recharts

**AI**
- Claude Haiku — transaction categorization
- Claude Sonnet — conversational agent with agentic tool use (budget state, transaction lookup, forecasting, reallocation suggestions)

---

## Getting Started

### Prerequisites

- [Node.js v22 LTS](https://nodejs.org)
- An [Anthropic API key](https://console.anthropic.com) (pay-as-you-go; typical usage runs under $1/month)

### Installation

```bash
git clone https://github.com/Krusol21/BudgetAI.git
cd BudgetAI
```

**Backend:**
```bash
cd backend
npm install
cp .env.example .env
```

Open `.env` and fill in:
```
ANTHROPIC_API_KEY=your_key_here
JWT_SECRET=your_jwt_secret_here
```

Generate a JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Frontend:**
```bash
cd ../frontend
npm install
```

### Running

On Windows, double-click `start-budgetai.bat` — it starts both servers and opens the app in your browser.

Or manually:
```bash
# terminal 1
cd backend && npm run dev

# terminal 2
cd frontend && npm run dev
```

App runs at `http://localhost:5173`.

---

## Project Structure

```
BudgetAI/
├── backend/
│   ├── agent/
│   │   ├── tools.js        # Claude tool definitions + agentic loop
│   │   └── snapshot.js     # Auto-generates budget-snapshot.md on every data change
│   ├── routes/
│   │   ├── transactions.js # CSV upload, parsing, categorization
│   │   ├── budgets.js      # Monthly budget CRUD
│   │   ├── parentalBudget.js
│   │   ├── agent.js        # Chat endpoint
│   │   └── auth.js
│   ├── database.js         # sql.js init, migrations, disk persistence
│   └── server.js
├── frontend/
│   └── src/
│       └── components/     # Dashboard, UploadPage, ChatInterface, etc.
├── budget-snapshot.md      # Human-readable live budget view (auto-generated)
└── start-budgetai.bat
```

---

## How It Works

The AI agent uses Claude's tool use API in an agentic loop. When you send a message, Claude decides which tools to call — querying live transaction data, budget limits, forecasts, or reallocation suggestions — before composing a response. This means answers are always grounded in your real numbers, not hallucinated.

A `budget-snapshot.md` file is written to disk after every data change, giving a human-readable view of your current budget state at any time without opening the app.
