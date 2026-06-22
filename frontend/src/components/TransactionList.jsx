import { useEffect, useState } from 'react';
import api from '../api/client';

const fmt = n => `$${Math.abs(n).toFixed(2)}`;

const CATEGORIES = [
  'All', 'Groceries', 'Dining Out', 'Transportation', 'Entertainment',
  'Textbooks & Supplies', 'Personal Care', 'Utilities', 'Miscellaneous',
];

const CATEGORY_COLORS = {
  'Groceries': 'bg-emerald-100 text-emerald-700',
  'Dining Out': 'bg-orange-100 text-orange-700',
  'Transportation': 'bg-blue-100 text-blue-700',
  'Entertainment': 'bg-purple-100 text-purple-700',
  'Textbooks & Supplies': 'bg-yellow-100 text-yellow-700',
  'Personal Care': 'bg-pink-100 text-pink-700',
  'Utilities': 'bg-cyan-100 text-cyan-700',
  'Miscellaneous': 'bg-slate-100 text-slate-700',
};

function catClass(cat) {
  return CATEGORY_COLORS[cat] || 'bg-slate-100 text-slate-700';
}

export default function TransactionList() {
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [editId, setEditId] = useState(null);
  const [editCat, setEditCat] = useState('');
  const [page, setPage] = useState(0);
  const PER_PAGE = 20;

  useEffect(() => {
    setLoading(true);
    const params = {
      limit: PER_PAGE,
      offset: page * PER_PAGE,
      ...(category !== 'All' && { category }),
    };
    api.get('/transactions', { params }).then(({ data }) => {
      setTransactions(data.transactions);
      setTotal(data.total);
    }).finally(() => setLoading(false));
  }, [category, page]);

  async function saveCategory(id) {
    await api.put(`/transactions/${id}/category`, { category: editCat });
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, category: editCat } : t));
    setEditId(null);
  }

  async function deleteTransaction(id) {
    await api.delete(`/transactions/${id}`);
    setTransactions(prev => prev.filter(t => t.id !== id));
    setTotal(prev => prev - 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Transactions</h1>
          <p className="text-slate-500 text-sm mt-0.5">{total} total transactions</p>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => { setCategory(cat); setPage(0); }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              category === cat
                ? 'bg-brand-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-brand-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="card text-center py-16 text-slate-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="font-medium">No transactions found</p>
          <p className="text-sm mt-1">Upload a bank statement to get started</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-6 py-3 font-medium text-slate-500">Date</th>
                  <th className="text-left px-6 py-3 font-medium text-slate-500">Description</th>
                  <th className="text-left px-6 py-3 font-medium text-slate-500">Category</th>
                  <th className="text-right px-6 py-3 font-medium text-slate-500">Amount</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {transactions.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 text-slate-500 whitespace-nowrap">{t.date}</td>
                    <td className="px-6 py-3 font-medium text-slate-800 max-w-xs truncate">{t.description}</td>
                    <td className="px-6 py-3">
                      {editId === t.id ? (
                        <div className="flex gap-2 items-center">
                          <select
                            className="input py-1 text-xs"
                            value={editCat}
                            onChange={e => setEditCat(e.target.value)}
                          >
                            {CATEGORIES.filter(c => c !== 'All').map(c => (
                              <option key={c}>{c}</option>
                            ))}
                          </select>
                          <button onClick={() => saveCategory(t.id)} className="text-emerald-600 hover:text-emerald-700 font-medium text-xs">Save</button>
                          <button onClick={() => setEditId(null)} className="text-slate-400 hover:text-slate-600 text-xs">Cancel</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditId(t.id); setEditCat(t.category || 'Miscellaneous'); }}
                          className={`badge ${catClass(t.category)} hover:opacity-80 transition-opacity cursor-pointer`}
                        >
                          {t.category || 'Uncategorized'}
                        </button>
                      )}
                    </td>
                    <td className={`px-6 py-3 text-right font-semibold whitespace-nowrap ${
                      t.is_expense ? 'text-rose-600' : 'text-emerald-600'
                    }`}>
                      {t.is_expense ? '-' : '+'}{fmt(t.amount)}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => deleteTransaction(t.id)}
                        className="text-slate-300 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > PER_PAGE && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-slate-50">
              <span className="text-sm text-slate-500">
                Showing {page * PER_PAGE + 1}–{Math.min((page + 1) * PER_PAGE, total)} of {total}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="btn-ghost text-sm py-1.5 px-3 disabled:opacity-40"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={(page + 1) * PER_PAGE >= total}
                  className="btn-ghost text-sm py-1.5 px-3 disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
