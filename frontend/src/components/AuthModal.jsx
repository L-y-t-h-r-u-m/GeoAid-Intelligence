import React, { useState } from 'react';
import { X, Mail, Lock, User, Phone } from 'lucide-react';

const API_URL = 'http://localhost:5000/api/auth';

export default function AuthModal({ onClose, onLogin }) {
  const [view, setView] = useState('login'); // 'login', 'register', 'forgot', 'reset'
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'volunteer',
    otp: '',
    newPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      let endpoint = '';
      let body = {};

      if (view === 'login') {
        endpoint = '/login';
        body = { email: formData.email, password: formData.password };
      } else if (view === 'register') {
        endpoint = '/register';
        body = { ...formData };
      } else if (view === 'verify') {
        endpoint = '/verify-otp';
        body = { email: formData.email, otp: formData.otp };
      } else if (view === 'forgot') {
        endpoint = '/forgot-password';
        body = { email: formData.email };
      } else if (view === 'reset') {
        endpoint = '/reset-password';
        body = { email: formData.email, otp: formData.otp, newPassword: formData.newPassword };
      }

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong');
      }

      if (view === 'login') {
        onLogin(data, data.token);
      } else if (view === 'register') {
        // Skip OTP — log in directly if token returned, otherwise show message
        if (data.token) {
          onLogin(data, data.token);
        } else {
          setMessage(data.message || 'Account created! Please sign in.');
          setView('login');
        }
      } else if (view === 'forgot') {
        setMessage(data.message);
        setView('reset');
      } else if (view === 'reset') {
        setMessage(data.message);
        setView('login');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6 text-center">
          {view === 'login' && 'Sign In'}
          {view === 'register' && 'Create Account'}
          {view === 'forgot' && 'Reset Password'}
          {view === 'reset' && 'Set New Password'}
        </h2>

        {error && <div className="p-3 mb-4 text-sm text-rose-600 bg-rose-50 rounded-lg">{error}</div>}
        {message && <div className="p-3 mb-4 text-sm text-emerald-600 bg-emerald-50 rounded-lg">{message}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {(view === 'login' || view === 'register' || view === 'forgot' || view === 'reset') && (
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="email" name="email" placeholder="Email Address" required
                value={formData.email} onChange={handleChange}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          {view === 'register' && (
            <>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text" name="name" placeholder="Full Name" required
                  value={formData.name} onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="tel" name="phone" placeholder="Phone Number (Optional)"
                  value={formData.phone} onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {/* Role selection removed, defaulting to volunteer */}

            </>
          )}

          {(view === 'login' || view === 'register') && (
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="password" name="password" placeholder="Password" required
                value={formData.password} onChange={handleChange}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          {view === 'reset' && (
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text" name="otp" placeholder="6-digit OTP Code" required
                value={formData.otp} onChange={handleChange}
                className="w-full pl-10 pr-4 py-2 tracking-widest bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          {view === 'reset' && (
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="password" name="newPassword" placeholder="New Password" required
                value={formData.newPassword} onChange={handleChange}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Submit'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400 flex flex-col gap-2">
          {view === 'login' && (
            <>
              <button onClick={() => setView('forgot')} className="hover:text-indigo-600 dark:hover:text-indigo-400">Forgot Password?</button>
              <p>Don't have an account? <button onClick={() => setView('register')} className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">Sign Up</button></p>
            </>
          )}
          {view === 'register' && (
            <p>Already have an account? <button onClick={() => setView('login')} className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">Sign In</button></p>
          )}
          {(view === 'forgot' || view === 'reset') && (
            <button onClick={() => setView('login')} className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline">Back to Login</button>
          )}
        </div>
      </div>
    </div>
  );
}
