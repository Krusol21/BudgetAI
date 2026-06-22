import { useEffect, useState } from 'react';
import api from '../api/client';

const fmt = n => `$${Math.abs(n).toFixed(2)}`;

const DEFAULT_CATEGORIES = [
  'Groceries', 'Dining Out', 'Transportation', 'Entertainment',
  'Textbooks & Supplies', 'Personal Care', 'Utilities', 'Miscellaneous',
];

export default function BudgetManager() {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);
  const [editLimit, setEditLimit] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newLimit, setNewLimit] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/budgets').then(({ data }) => setBudgets(data)).finally(() => setLoading(false));
  }, []);

  async function saveEdit(id) {
    await api.put(`/budgets/${id}`, { budget_limit: Number(editLimit) });
    setBudgets(prev => prev.map(b => b.id === id ? { ...b, budget_limit: Number(editLimit) } : b));
    setEditId(null);
  }

  async function addBudget() {
    if (!newCategory || !newLimit) { setError('Both fields required'); return; }
    setError('');
    try {
      const { data } = await api.post('/budgets', { category: newCategory, budget_limit: Number(newLimit) });
      setBudgets(prev => [...prev, { ...data, spent: 0, remaining: Number(newLimit) }]);
      setNewCategory('');
      setNewLimit('');
      setAdding(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add budget');
    }
  }

  async function deleteBudget(id) {
    await api.delete(`/budgets/${id}`);
    setBudgets(prev => prev.filter(b => b.id !== id));
  }

  const totalLimit = budgets.reduce((s, b) => s + b.budget_limit, 0);
  const totalSpent = budgets.reduce((s, b) => s + (b.spent || 0), 0);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Budget Manager</h1>
          <p className="text-slate-500 text-sm mt-0.5">Set and adjust your monthly spending limits</p>
        </div>
        <button onClick={() => setAdding(true)} className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Category
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-xs text-slate-500">Total Budget</p>
          <p className="text-xl font-bold text-slate-800 mt-1">{fmt(totalLimit)}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-slate-500">Spent This Month</p>
          <p className="text-xl font-bold text-rose-600 mt-1">{fmt(totalSpent)}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-slate-500">Remaining</p>
          <p className={`text-xl font-bold mt-1 ${totalLimit - totalSpent < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {fmt(totalLimit - totalSpent)}
          </p>
        </div>
      </div>

      {/* Add form */}
      {adding && (
        <div className="card border-brand-200">
          <h3 className="font-semibold text-slate-800 mb-4">Add New Budget Category</h3>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Category</label>
              <select
                className="input"
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
              >
                <option value="">Select or type below</option>
                {DEFAULT_CATEGORIES.filter(c => !budgets.find(b => b.category === c)).map(c => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <input
                className="input mt-2"
                placeholder="Or type a custom category"
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
              />
            </div>
            <div className="w-36">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Monthly Limit</label>
              <input
                type="number"
                className="input"
                placeholder="e.g. 200"
                value={newLimit}
                onChange={e => setNewLimit(e.target.value)}
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
          <div className="flex gap-2 mt-4">
            <button onClick={addBudget} className="btn-primary">Save Category</button>
            <button onClick={() => { setAdding(false); setError(''); }} className="btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      {/* Budget list */}
      <div className="card p-0 overflow-hidden">
        <div className="divide-y divide-slate-50">
          {budgets.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <p>No budgets yet. Add your first category above.</p>
            </div>
          )}
          {budgets.map(b => {
            const pct = Math.min((b.spent / b.budget_limit) * 100, 100);
            const over = b.spent > b.budget_limit;
            return (
              <div key={b.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-slate-800">{b.category}</span>
                      <div className="flex items-center gap-2">
                        {over && (
                          <span className="badge bg-rose-100 text-rose-600">Over budget</span>
                        )}
                        {editId === b.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-500">$</span>
                            <input
                              type="number"
                              className="input w-24 py-1 text-sm"
                              value={editLimit}
                              onChange={e => setEditLimit(e.target.value)}
                              autoFocus
                            />
                            <button onClick={() => saveEdit(b.id)} className="text-sm text-emerald-600 font-medium">Save</button>
                            <button onClick={() => setEditId(null)} className="text-sm text-slate-400">Cancel</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-slate-500">
                              {fmt(b.spent)} <span className="text-slate-300">/</span> {fmt(b.budget_limit)}
                            </span>
                            <button
                              onClick={() => { setEditId(b.id); setEditLimit(b.budget_limit); }}
                              className="text-slate-400 hover:text-brand-600 transition-colors"
                              title="Edit limit"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => deleteBudget(b.id)}
                              className="text-slate-300 hover:text-red-400 transition-colors"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          over ? 'bg-rose-500' : pct > 75 ? 'bg-amber-400' : 'bg-brand-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {over
                        ? `${fmt(b.spent - b.budget_limit)} over limit`
                        : `${fmt(b.remaining)} remaining (${Math.round(100 - pct)}% left)`}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
