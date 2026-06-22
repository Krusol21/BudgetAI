import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import api from '../api/client';

const COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#06b6d4','#f43f5e','#84cc16'];

function StatCard({ label, value, sub, color = 'indigo' }) {
  const colors = {
    indigo: 'from-brand-500 to-purple-600',
    green: 'from-emerald-500 to-teal-600',
    amber: 'from-amber-400 to-orange-500',
    rose: 'from-rose-500 to-pink-600',
  };
  return (
    <div className={`card bg-gradient-to-br ${colors[color]} text-white border-0`}>
      <p className="text-white/70 text-sm font-medium">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      {sub && <p className="text-white/60 text-xs mt-1">{sub}</p>}
    </div>
  );
}

const fmt = n => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [budgets, setBudgets] = useState([]);
  const [parentalSummary, setParentalSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/transactions/summary'),
      api.get('/budgets'),
      api.get('/parental/summary').catch(() => ({ data: null })),
    ]).then(([s, b, p]) => {
      setSummary(s.data);
      setBudgets(b.data);
      setParentalSummary(p.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
    </div>
  );

  const totalBudget = budgets.reduce((s, b) => s + b.budget_limit, 0);
  const budgetHealth = totalBudget > 0
    ? Math.round((1 - (summary?.totalSpent || 0) / totalBudget) * 100)
    : 100;
  const healthColor = budgetHealth > 40 ? 'green' : budgetHealth > 20 ? 'amber' : 'rose';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Link to="/upload" className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Upload Statement
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Spent This Month" value={fmt(summary?.totalSpent || 0)} color="indigo" />
        <StatCard label="Income This Month" value={fmt(summary?.totalIncome || 0)} color="green" />
        <StatCard label="Total Budget" value={fmt(totalBudget)} color="amber" />
        <StatCard
          label="Budget Health"
          value={`${budgetHealth}%`}
          sub={budgetHealth > 40 ? 'Looking good!' : budgetHealth > 20 ? 'Watch spending' : 'Over budget'}
          color={healthColor}
        />
        {parentalSummary?.annualLimit ? (
          <Link to="/parental">
            <StatCard
              label="Parents' Budget"
              value={fmt(parentalSummary.remaining)}
              sub={`${Math.round((parentalSummary.totalSpent / parentalSummary.annualLimit) * 100)}% of ${fmt(parentalSummary.annualLimit)} used`}
              color={parentalSummary.remaining / parentalSummary.annualLimit > 0.15 ? 'green' : 'rose'}
            />
          </Link>
        ) : (
          <Link to="/parental">
            <StatCard label="Parents' Budget" value="Not set up" sub="Click to configure" color="indigo" />
          </Link>
        )}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spending by category */}
        <div className="card">
          <h2 className="font-semibold text-slate-800 mb-4">Spending by Category</h2>
          {summary?.monthly?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={summary.monthly}
                  dataKey="total"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={45}
                  paddingAngle={3}
                >
                  {summary.monthly.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex flex-col items-center justify-center text-slate-400">
              <svg className="w-12 h-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-sm">Upload a statement to see spending</p>
            </div>
          )}
          {/* Legend */}
          <div className="grid grid-cols-2 gap-1 mt-2">
            {summary?.monthly?.slice(0, 6).map((item, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-slate-600">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="truncate">{item.category}</span>
                <span className="ml-auto font-medium">{fmt(item.total)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Daily spending */}
        <div className="card">
          <h2 className="font-semibold text-slate-800 mb-4">Daily Spending This Month</h2>
          {summary?.daily?.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={summary.daily} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickFormatter={d => d.slice(5)}
                />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${v}`} />
                <Tooltip formatter={v => [fmt(v), 'Spent']} labelFormatter={l => `Date: ${l}`} />
                <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex flex-col items-center justify-center text-slate-400">
              <svg className="w-12 h-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <p className="text-sm">No spending data yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Budget progress */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-800">Budget Progress</h2>
          <Link to="/budgets" className="text-sm text-brand-600 hover:text-brand-700 font-medium">Manage →</Link>
        </div>
        <div className="space-y-3">
          {budgets.length === 0 && (
            <p className="text-slate-400 text-sm">No budgets set up yet.</p>
          )}
          {budgets.map(b => {
            const pct = Math.min((b.spent / b.budget_limit) * 100, 100);
            const over = b.spent > b.budget_limit;
            return (
              <div key={b.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-slate-700">{b.category}</span>
                  <span className={over ? 'text-rose-600 font-semibold' : 'text-slate-500'}>
                    {fmt(b.spent)} / {fmt(b.budget_limit)}
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      over ? 'bg-rose-500' : pct > 75 ? 'bg-amber-400' : 'bg-brand-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { to: '/chat', icon: '💬', label: 'Ask AI', desc: 'Get spending advice' },
          { to: '/upload', icon: '📤', label: 'Upload CSV', desc: 'Import bank statement' },
          { to: '/transactions', icon: '📋', label: 'Transactions', desc: 'View all transactions' },
          { to: '/forecast', icon: '📈', label: 'Forecast', desc: 'See balance projection' },
        ].map(item => (
          <Link
            key={item.to}
            to={item.to}
            className="card hover:border-brand-200 hover:shadow-md transition-all duration-200 text-center group cursor-pointer"
          >
            <div className="text-3xl mb-2">{item.icon}</div>
            <p className="font-medium text-slate-800 text-sm">{item.label}</p>
            <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
