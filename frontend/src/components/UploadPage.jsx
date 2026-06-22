import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

const fmt = n => `$${Math.abs(n).toFixed(2)}`;
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

function categoryClass(cat) {
  return CATEGORY_COLORS[cat] || 'bg-slate-100 text-slate-700';
}

export default function UploadPage() {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [isParental, setIsParental] = useState(false);
  const inputRef = useRef();

  function handleFile(f) {
    if (!f) return;
    if (!f.name.endsWith('.csv')) { setError('Please upload a .csv file'); return; }
    setFile(f);
    setError('');
    setResult(null);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }

  async function upload() {
    if (!file) return;
    setUploading(true);
    setError('');
    const form = new FormData();
    form.append('file', file);
    if (isParental) form.append('funding_source', 'parental');
    try {
      const { data } = await api.post('/transactions/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(data);
      setFile(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Upload Bank Statement</h1>
        <p className="text-slate-500 text-sm mt-1">
          Export a CSV from your bank and upload it here. The AI will auto-categorize every transaction.
        </p>
      </div>

      {/* Supported banks info */}
      <div className="card bg-brand-50 border-brand-100">
        <p className="text-sm font-medium text-brand-700 mb-2">Supported formats</p>
        <div className="flex flex-wrap gap-2">
          {['Chase', 'Bank of America', 'Wells Fargo', 'Capital One', 'Discover', 'Any CSV with Date + Description + Amount'].map(b => (
            <span key={b} className="badge bg-brand-100 text-brand-700">{b}</span>
          ))}
        </div>
      </div>

      {/* Parental toggle */}
      <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
        <input
          id="parental-toggle"
          type="checkbox"
          checked={isParental}
          onChange={e => setIsParental(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
        />
        <label htmlFor="parental-toggle" className="cursor-pointer">
          <span className="text-sm font-medium text-indigo-800">This is a parental credit card statement</span>
          <p className="text-xs text-indigo-500 mt-0.5">Transactions will count against your parents' annual budget</p>
        </label>
      </div>

      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200 ${
          dragging
            ? 'border-brand-500 bg-brand-50 drop-active'
            : file
            ? 'border-emerald-400 bg-emerald-50'
            : 'border-slate-300 hover:border-brand-400 hover:bg-slate-50'
        }`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !file && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={e => handleFile(e.target.files[0])}
        />

        {file ? (
          <div className="space-y-3">
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-semibold text-slate-800">{file.name}</p>
            <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
            <button
              onClick={e => { e.stopPropagation(); setFile(null); }}
              className="text-sm text-slate-400 hover:text-red-500 transition-colors"
            >
              Remove file
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <p className="font-medium text-slate-700">Drop your CSV here</p>
            <p className="text-sm text-slate-400">or click to browse files</p>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {file && !uploading && (
        <button onClick={upload} className="btn-primary w-full py-3 text-base">
          Process Statement with AI
        </button>
      )}

      {uploading && (
        <div className="card text-center py-8 space-y-4">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto" />
          <div>
            <p className="font-medium text-slate-700">AI is processing your transactions…</p>
            <p className="text-sm text-slate-400 mt-1">Categorizing each transaction intelligently</p>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-emerald-700 font-medium">
              {result.imported} transactions imported and categorized
            </p>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-800">Imported Transactions</h2>
              <Link to="/transactions" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
                View all →
              </Link>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {result.transactions.map(t => (
                <div key={t.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{t.description}</p>
                    <p className="text-xs text-slate-400">{t.date}</p>
                  </div>
                  <span className={`badge ${categoryClass(t.category)} flex-shrink-0`}>{t.category}</span>
                  <span className={`text-sm font-semibold flex-shrink-0 ${t.isExpense ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {t.isExpense ? '-' : '+'}{fmt(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Help */}
      <div className="card bg-slate-50 border-slate-100">
        <p className="text-sm font-medium text-slate-700 mb-3">How to export from your bank</p>
        <ol className="space-y-1.5 text-sm text-slate-500 list-decimal list-inside">
          <li><strong>Chase:</strong> Accounts → Download Account Activity → CSV</li>
          <li><strong>Bank of America:</strong> Accounts → Download → Date range → CSV</li>
          <li><strong>Capital One:</strong> Transactions → Download → CSV</li>
          <li><strong>Other banks:</strong> Look for "Export", "Download", or "Statement" in transactions view</li>
        </ol>
      </div>
    </div>
  );
}
