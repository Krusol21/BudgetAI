# BudgetAI — College Budget Assistant

A full-stack agentic budgeting app. Upload your bank CSV, let Claude categorize every transaction, ask questions in plain English, and get forecasts for your month-end balance.

---

## Quick Start

### 1. Get a Claude API key

The app uses the Claude API directly — this is separate from your Claude Pro subscription and billed per-use (expect under $1/month for personal budgeting).

1. Go to **[console.anthropic.com](https://console.anthropic.com)** and sign in with your Anthropic account
2. Navigate to **API Keys** → **Create Key** — copy it somewhere safe, it's only shown once
3. Go to **Billing** → add a payment method (pay-as-you-go, no commitment)

### 2. Clone / navigate to this folder

```
cd BUDGET_WORKFLOW
```

### 3. Set up the backend

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

Open `.env` and fill in both values:

```
ANTHROPIC_API_KEY=sk-ant-...        # paste your key from step 1
JWT_SECRET=...                       # generate one with the command below
```

Generate a JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

```bash
npm run dev
```

Backend runs on `http://localhost:3001`.

### 4. Set up the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`. Open that in your browser.

---

## Features

| Feature | Description |
|---|---|
| **CSV Upload** | Export from any major bank, drag & drop, AI auto-categorizes |
| **AI Chat** | Ask "Can I afford a $300 textbook?" in plain English |
| **Dashboard** | Spending by category (donut chart) + daily bar chart + budget progress |
| **Forecast** | Projected month-end balance with risk flags per category |
| **Budget Manager** | Set/edit/delete monthly limits per category |
| **Transactions** | Full list with category override, pagination, delete |

---

## How to export your bank CSV

| Bank | Steps |
|---|---|
| Chase | Accounts → Download Account Activity → CSV |
| Bank of America | Accounts → Download → Date range → CSV |
| Capital One | Transactions → Download → CSV |
| Wells Fargo | Accounts → Download Account Activity → CSV |
| Discover | Statements & Activity → Download → CSV |

---

## Tech Stack

- **Backend:** Node.js + Express, SQLite (better-sqlite3), JWT auth
- **AI:** Claude Sonnet (chat/forecast) + Claude Haiku (categorization)
- **Frontend:** React + Vite + Tailwind CSS + Recharts
- **Hosting:** Deploy backend to Railway/Render free tier, frontend to Vercel

---

## Deployment (free)

### Backend → Railway
1. Push `backend/` to a GitHub repo
2. Connect to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add environment variables (ANTHROPIC_API_KEY, JWT_SECRET)
4. Set start command: `node server.js`

### Frontend → Vercel
1. Push `frontend/` to GitHub
2. Connect to [vercel.com](https://vercel.com) → New Project
3. Set `VITE_API_URL` if needed, update `vite.config.js` proxy to point to your Railway URL

---

## Cost

$0/month using free tiers:
- Railway/Render: free tier (backend)
- Vercel: free tier (frontend)
- SQLite: local file, no cost
- Anthropic API: ~$0.50–$1/month typical usage (Claude Haiku for categorization, Sonnet for chat)
