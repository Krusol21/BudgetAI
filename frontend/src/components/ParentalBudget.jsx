import { useState, useEffect } from 'react';
import api from '../api/client';

const fmt = (n) => `$${Math.abs(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export default function ParentalBudget() {
  const [summary, setSummary] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [setupMode, setSetupMode] = useState(false);
  const [annualInput, setAnnualInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [entryForm, setEntryForm] = useState({ category: 'Rent', month: currentMonth(), amount: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try {
      const [sumRes, entRes] = await Promise.all([
        api.get('/parental/summary'),
        api.get('/parental/manual-entries'),
      ]);
      setSummary(sumRes.data);
      setEntries(entRes.data.entries);
    } catch {
      setError('Failed to load parental budget data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSetup(e) {
    e.preventDefault();
    const val = parseFloat(annualInput);
    if (!val || val <= 0) return setError('Enter a valid positive amount.');
    setSaving(true);
    setError('');
    try {
      await api.post('/parental/setup', { annual_limit: val, year: new Date().getFullYear() });
      setSetupMode(false);
      setAnnualInput('');
      await load();
    } catch {
      setError('Failed to save budget. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddEntry(e) {
    e.preventDefault();
    const amt = parseFloat(entryForm.amount);
    if (!amt || amt <= 0) return setError('Enter a valid amount.');
    setSubmitting(true);
    setError('');
    try {
      await api.post('/parental/manual-entries', {
        amount: amt,
        category: entryForm.category,
        month: entryForm.month,
        description: entryForm.description || undefined,
      });
      setEntryForm(f => ({ ...f, amount: '', description: '' }));
      await load();
    } catch {
      setError('Failed to add entry. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/parental/manual-entries/${id}`);
      await load();
    } catch {
      setError('Failed to delete entry.');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const pct = summary?.annualLimit ? Math.min(100, Math.round((summary.totalSpent / summary.annualLimit) * 100)) : 0;
  const barColor = pct >= 85 ? 'bg-red-500' : pct >= 60 ? 'bg-amber-500' : 'bg-green-500';
  const isConfigured = summary?.annualLimit !== null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Parents' Annual Budget</h1>
          <p className="text-sm text-gray-500 mt-1">{new Date().getFullYear()} — tracks credit card, rent, and utilities</p>
        </div>
        {isConfigured && !setupMode && (
          <button onClick={() => { setSetupMode(true); setAnnualInput(String(summary.annualLimit)); }}
            className="text-sm text-indigo-600 hover:underline">Edit Limit</button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      {/* Setup / Edit */}
      {(!isConfigured || setupMode) && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {isConfigured ? 'Update Annual Limit' : 'Set Up Your Parents\' Annual Budget'}
          </h2>
          <form onSubmit={handleSetup} className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm text-gray-600 mb-1">Annual budget amount ($)</label>
              <input
                type="number" min="1" step="any" placeholder="e.g. 15000"
                value={annualInput} onChange={e => setAnnualInput(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                required
              />
            </div>
            <button type="submit" disabled={saving}
              className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
            {setupMode && (
              <button type="button" onClick={() => setSetupMode(false)}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">Cancel</button>
            )}
          </form>
        </div>
      )}

      {/* Progress */}
      {isConfigured && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-gray-500">Used</span>
            <span className="text-sm font-semibold text-gray-900">{pct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-4">
            <div className={`${barColor} h-4 rounded-full transition-all`} style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span><span className="font-semibold text-gray-900">{fmt(summary.totalSpent)}</span> used</span>
            <span><span className="font-semibold text-gray-900">{fmt(summary.remaining)}</span> remaining of {fmt(summary.annualLimit)}</span>
          </div>

          {/* Breakdown */}
          <div className="pt-2 border-t border-gray-50 grid grid-cols-3 gap-4">
            {[
              { label: 'Credit Card', value: summary.breakdown.creditCard, note: 'via CSV upload' },
              { label: 'Rent', value: summary.breakdown.rent, note: 'manual entries' },
              { label: 'Utilities', value: summary.breakdown.utilities, note: 'manual entries' },
            ].map(item => (
              <div key={item.label} className="text-center">
                <p className="text-xs text-gray-400 mb-1">{item.label}</p>
                <p className="text-lg font-bold text-gray-900">{fmt(item.value)}</p>
                <p className="text-xs text-gray-400">{item.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manual Entry Form */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Add Rent or Utilities Payment</h2>
        <form onSubmit={handleAddEntry} className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Category</label>
            <select value={entryForm.category} onChange={e => setEntryForm(f => ({ ...f, category: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
              <option>Rent</option>
              <option>Utilities</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Month</label>
            <input type="month" value={entryForm.month} onChange={e => setEntryForm(f => ({ ...f, month: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              required />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Amount ($)</label>
            <input type="number" min="1" step="any" placeholder="e.g. 1200"
              value={entryForm.amount} onChange={e => setEntryForm(f => ({ ...f, amount: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              required />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Description (optional)</label>
            <input type="text" placeholder="e.g. Monthly rent"
              value={entryForm.description} onChange={e => setEntryForm(f => ({ ...f, description: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div className="col-span-2">
            <button type="submit" disabled={submitting}
              className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {submitting ? 'Adding…' : 'Add Entry'}
            </button>
          </div>
        </form>
      </div>

      {/* Entries List */}
      {entries.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Manual Entries</h2>
          <div className="space-y-2">
            {entries.map(entry => (
              <div key={entry.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${entry.category === 'Rent' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                    {entry.category}
                  </span>
                  <div>
                    <p className="text-sm text-gray-700">{entry.description || entry.category}</p>
                    <p className="text-xs text-gray-400">{entry.month}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold text-gray-900">{fmt(entry.amount)}</span>
                  <button onClick={() => handleDelete(entry.id)}
                    className="text-red-400 hover:text-red-600 text-xs">Remove</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
