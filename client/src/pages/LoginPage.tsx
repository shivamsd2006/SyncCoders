import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useNavigate } from 'react-router-dom';
import { Layers, ShieldCheck, Briefcase, Code, ArrowRight } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (loginEmail: string, loginPass: string) => {
    setIsLoading(true);
    setError('');

    const result = await login(loginEmail, loginPass);
    setIsLoading(false);

    if (result.success) {
      navigate('/');
    } else {
      setError(result.error || 'Invalid credentials');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLogin(email, password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 transition-colors">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 items-center justify-center text-white shadow-lg shadow-sky-500/25">
            <Layers className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            SyncCoders
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-Time Client Project Dashboard with Role-Based Access
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-200 dark:border-rose-900/50 text-xs font-semibold text-rose-600 dark:text-rose-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Work Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@agency.com"
                className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs shadow-md shadow-sky-500/20 transition-all disabled:opacity-50"
            >
              <span>{isLoading ? 'Signing in...' : 'Sign in'}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </form>

          {/* Quick Demo Logins */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-3 text-center">
              Instant Demo Sign-in
            </span>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleLogin('admin@agency.com', 'admin123')}
                className="flex flex-col items-center p-2.5 rounded-xl border border-purple-200 bg-purple-50/50 hover:bg-purple-50 dark:border-purple-900/50 dark:bg-purple-950/20 dark:hover:bg-purple-950/40 transition-colors"
              >
                <ShieldCheck className="h-4 w-4 text-purple-600 dark:text-purple-400 mb-1" />
                <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300">
                  Admin
                </span>
                <span className="text-[9px] text-purple-500">Sarah</span>
              </button>

              <button
                type="button"
                onClick={() => handleLogin('pm1@agency.com', 'pm123')}
                className="flex flex-col items-center p-2.5 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/20 dark:hover:bg-blue-950/40 transition-colors"
              >
                <Briefcase className="h-4 w-4 text-blue-600 dark:text-blue-400 mb-1" />
                <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300">
                  PM 1
                </span>
                <span className="text-[9px] text-blue-500">Alex</span>
              </button>

              <button
                type="button"
                onClick={() => handleLogin('dev1@agency.com', 'dev123')}
                className="flex flex-col items-center p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 transition-colors"
              >
                <Code className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mb-1" />
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                  Dev 1
                </span>
                <span className="text-[9px] text-emerald-500">Ravi</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
