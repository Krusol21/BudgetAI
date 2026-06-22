import { useState, useEffect, useRef } from 'react';
import api from '../api/client';

const SUGGESTIONS = [
  'How much have I spent this month?',
  'Am I on track to stay within my budget?',
  'Where am I overspending?',
  'Can you forecast my balance for end of month?',
  'I need $200 for a weekend trip — what should I cut?',
  'How much did I spend on dining this month?',
];

function Message({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`chat-bubble flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
        isUser ? 'bg-brand-600 text-white' : 'bg-gradient-to-br from-purple-500 to-brand-600 text-white'
      }`}>
        {isUser ? 'You' : 'AI'}
      </div>
      {/* Bubble */}
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
        isUser
          ? 'bg-brand-600 text-white rounded-tr-sm'
          : 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm shadow-sm'
      }`}>
        {msg.content}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="chat-bubble flex gap-3">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-brand-600 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">
        AI
      </div>
      <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1.5 items-center h-4">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ChatInterface() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const bottomRef = useRef();
  const inputRef = useRef();

  useEffect(() => {
    api.get('/agent/history').then(({ data }) => {
      if (data.history.length > 0) {
        setMessages(data.history);
      } else {
        setMessages([{
          role: 'assistant',
          content: "Hi! I'm your personal budget assistant. I have access to your transaction history and budget limits. Ask me anything — like how much you've spent, whether you can afford something, or how to reallocate your budget.",
        }]);
      }
    }).finally(() => setHistoryLoading(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function send(text) {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setLoading(true);
    try {
      const { data } = await api.post('/agent/chat', { message: msg });
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I ran into an error. Please try again.',
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  async function clearHistory() {
    await api.delete('/agent/history');
    setMessages([{
      role: 'assistant',
      content: "Conversation cleared. How can I help you with your budget today?",
    }]);
  }

  if (historyLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 140px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Ask AI</h1>
          <p className="text-slate-500 text-sm mt-0.5">Your personal budget advisor powered by Claude</p>
        </div>
        <button onClick={clearHistory} className="btn-ghost text-sm text-slate-400 hover:text-red-500">
          Clear history
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.map((msg, i) => <Message key={i} msg={msg} />)}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="mb-4">
          <p className="text-xs text-slate-400 mb-2 font-medium">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => send(s)}
                className="text-xs bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-full hover:border-brand-300 hover:text-brand-600 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex gap-3 bg-white border border-slate-200 rounded-2xl p-2 shadow-sm">
        <input
          ref={inputRef}
          className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none placeholder:text-slate-400"
          placeholder="Ask about your budget, spending, or forecasts…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          disabled={loading}
        />
        <button
          onClick={() => send()}
          disabled={!input.trim() || loading}
          className="bg-brand-600 text-white w-10 h-10 rounded-xl flex items-center justify-center
                     hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  );
}
