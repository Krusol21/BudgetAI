import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import api from '../api/client';

const fmt = n => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ForecastView() {
  const [summary, setSummary] = useState(null);
  const [budgets, setBudgets] = useState([]);
  const [income, setIncome] = useState('');
  const [loading, setLoading] = useState(true);
  const [asking, setAsking] = useState(false);
  const [forecast, setForecast] = useState(null);

  useEffect(() => {
    Promise.all([api.get('/transactions/summary'), api.get('/budgets')])
      .then(([s, b]) => { setSummary(s.data); setBudgets(b.data); })
      .finally(() => setLoading(false));
  }, []);

  async function getForecast() {
    setAsking(true);
    setForecast(null);
    const msg = `Please forecast my balance for the rest of this month.${
      income ? ` My monthly income/stipend is $${income}.` : ''
    } Use the forecast_balance tool and give me a detailed breakdown with risk flags.`;
    try {
      const { data } = await api.post('/agent/chat', { message: msg });
      setForecast(data.reply);
    } finally {
      setAsking(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
    </div>
  );

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();

  // Build projected spending line from daily data
  const dailyData = summary?.daily || [];
  const totalSpent = summary?.totalSpent || 0;
  const dailyRate = dayOfMonth > 0 ? totalSpent / dayOfMonth : 0;
  const totalBudget = budgets.reduce((s, b) => s + b.budget_limit, 0);

  // Generate projected points for remaining days
  const projectedData = [];
  let running = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const actual = dailyData.find(x => x.date === dateStr);
    if (d <= dayOfMonth) {
      running += actual?.total || 0;
      projectedData.push({ date: dateStr.slice(5), actual: Math.round(running * 100) / 100 });
    } else {
      running += dailyRate;
      projectedData.push({ date: dateStr.slice(5), projected: Math.round(running * 100) / 100 });
    }
  }

  const projectedTotal = totalSpent + dailyRate * (daysInMonth - dayOfMonth);
  const overage = projectedTotal - totalBudget;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Balance Forecast</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Projected spending for {now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-xs font-medium text-slate-500">Spent So Far</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{fmt(totalSpent)}</p>
          <p className="text-xs text-slate-400 mt-0.5">Day {dayOfMonth} of {daysInMonth}</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium text-slate-500">Daily Rate</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{fmt(dailyRate)}</p>
          <p className="text-xs text-slate-400 mt-0.5">per day</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium text-slate-500">Projected Total</p>
          <p className={`text-2xl font-bold mt-1 ${projectedTotal > totalBudget ? 'text-rose-600' : 'text-emerald-600'}`}>
            {fmt(projectedTotal)}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">by month end</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium text-slate-500">vs Budget</p>
          <p className={`text-2xl font-bold mt-1 ${overage > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {overage > 0 ? `+${fmt(overage)} over` : `${fmt(Math.abs(overage))} under`}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">total budget: {fmt(totalBudget)}</p>
        </div>
      </div>

      {/* Spending projection chart */}
      <div className="card">
        <h2 className="font-semibold text-slate-800 mb-4">Spending Projection</h2>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={projectedData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${v}`} />
            <Tooltip formatter={(v, name) => [fmt(v), name === 'actual' ? 'Actual' : 'Projected']} />
            <ReferenceLine y={totalBudget} stroke="#f59e0b" strokeDasharray="6 3" label={{ value: 'Budget', position: 'right', fontSize: 11, fill: '#f59e0b' }} />
            <Line type="monotone" dataKey="actual" stroke="#6366f1" strokeWidth={2.5} dot={false} connectNulls />
            <Line type="monotone" dataKey="projected" stroke="#6366f1" strokeWidth={2} strokeDasharray="6 3" dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-3 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-brand-500 rounded" />
            <span>Actual spending</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-brand-500 rounded border-dashed" style={{ borderTop: '2px dashed #6366f1', background: 'transparent' }} />
            <span>Projected</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-amber-400 rounded" />
            <span>Budget limit</span>
          </div>
        </div>
      </div>

      {/* AI forecast */}
      <div className="card">
        <h2 className="font-semibold text-slate-800 mb-4">AI Detailed Forecast</h2>
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Monthly income / stipend (optional)
            </label>
            <input
              type="number"
              className="input"
              placeholder="e.g. 1200"
              value={income}
              onChange={e => setIncome(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <button onClick={getForecast} disabled={asking} className="btn-primary h-10">
              {asking ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Forecasting…
                </span>
              ) : 'Get AI Forecast'}
            </button>
          </div>
        </div>

        {forecast ? (
          <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {forecast}
          </div>
        ) : (
          <div className="bg-slate-50 rounded-xl p-8 text-center text-slate-400">
            <svg className="w-10 h-10 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <p className="text-sm">Click "Get AI Forecast" for a detailed analysis with risk flags</p>
          </div>
        )}
      </div>

      {/* Category risk table */}
      {budgets.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-slate-800 mb-4">Category Risk Overview</h2>
          <div className="space-y-3">
            {budgets
              .sort((a, b) => (b.spent / b.budget_limit) - (a.spent / a.budget_limit))
              .map(b => {
                const pct = Math.min((b.spent / b.budget_limit) * 100, 100);
                const projected = (b.spent / Math.max(dayOfMonth, 1)) * daysInMonth;
                const risk = projected > b.budget_limit ? 'Over' : projected > b.budget_limit * 0.9 ? 'At Risk' : 'On Track';
                const riskClass = risk === 'Over' ? 'text-rose-600 bg-rose-50' : risk === 'At Risk' ? 'text-amber-600 bg-amber-50' : 'text-emerald-600 bg-emerald-50';
                return (
                  <div key={b.id} className="flex items-center gap-4">
                    <div className="w-36 flex-shrink-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{b.category}</p>
                    </div>
                    <div className="flex-1">
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${pct > 100 ? 'bg-rose-500' : pct > 75 ? 'bg-amber-400' : 'bg-brand-500'}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-24 text-right flex-shrink-0">
                      <p className="text-sm text-slate-500">{fmt(b.spent)} / {fmt(b.budget_limit)}</p>
                    </div>
                    <span className={`badge flex-shrink-0 ${riskClass}`}>{risk}</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
