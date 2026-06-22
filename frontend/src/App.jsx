import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthPage from './components/AuthPage';
import Dashboard from './components/Dashboard';
import UploadPage from './components/UploadPage';
import ChatInterface from './components/ChatInterface';
import TransactionList from './components/TransactionList';
import ForecastView from './components/ForecastView';
import BudgetManager from './components/BudgetManager';
import ParentalBudget from './components/ParentalBudget';
import Navbar from './components/Navbar';

function ProtectedLayout({ children }) {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
        <Route path="/upload" element={<ProtectedLayout><UploadPage /></ProtectedLayout>} />
        <Route path="/chat" element={<ProtectedLayout><ChatInterface /></ProtectedLayout>} />
        <Route path="/transactions" element={<ProtectedLayout><TransactionList /></ProtectedLayout>} />
        <Route path="/forecast" element={<ProtectedLayout><ForecastView /></ProtectedLayout>} />
        <Route path="/budgets" element={<ProtectedLayout><BudgetManager /></ProtectedLayout>} />
        <Route path="/parental" element={<ProtectedLayout><ParentalBudget /></ProtectedLayout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
