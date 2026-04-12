'use client';

import { Mail, Lock, Chrome, Apple, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';

export default function LoginPage() {
  const { devLogin, login, loading, error: authError, user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  // Show loading while checking auth or redirecting
  if (loading || user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy via-navy-dark to-navy-light flex items-center justify-center">
        <Loader2 className="animate-spin text-gold" size={32} />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    setError(null);
    try {
      // In dev mode, use mock token (backend accepts JSON with email + uid)
      await devLogin(email, `dev-${email}`);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDevLogin = async (testEmail: string, uid: string) => {
    setSubmitting(true);
    setError(null);
    try {
      await devLogin(testEmail, uid);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const displayError = error || authError;

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy via-navy-dark to-navy-light flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-baseline justify-center gap-1 mb-2">
            <span className="text-4xl font-bold text-white">DBM</span>
            <span className="text-xs text-gold font-semibold">BETA</span>
          </div>
          <p className="text-white/60">Construction Services Portal</p>
        </div>

        {/* Login Card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
          <h1 className="text-2xl font-bold text-white mb-2">Welcome Back</h1>
          <p className="text-white/60 mb-8 text-sm">Sign in to your account</p>

          {/* Error Display */}
          {displayError && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle size={16} />
              {displayError}
            </div>
          )}

          {/* Email Form */}
          <form onSubmit={handleSubmit} className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-white/40" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-white/40 focus:outline-none focus:border-gold/50 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-white/40" size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-white/40 focus:outline-none focus:border-gold/50 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !email}
              className="w-full bg-gold text-navy font-semibold py-2.5 rounded-lg hover:bg-gold/90 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-white/10"></div>
            <span className="text-xs text-white/40">OR</span>
            <div className="flex-1 h-px bg-white/10"></div>
          </div>

          {/* Social Auth */}
          <div className="space-y-3 mb-6">
            <button className="w-full border border-white/20 text-white font-medium py-2.5 rounded-lg hover:bg-white/5 transition-colors flex items-center justify-center gap-2">
              <Chrome size={18} />
              Continue with Google
            </button>
            <button className="w-full border border-white/20 text-white font-medium py-2.5 rounded-lg hover:bg-white/5 transition-colors flex items-center justify-center gap-2">
              <Apple size={18} />
              Continue with Apple
            </button>
          </div>

          {/* Dev Quick Login */}
          <div className="border-t border-white/10 pt-4 mt-4">
            <p className="text-xs text-white/40 mb-3 text-center">Dev Quick Login</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleDevLogin('owner@test.com', 'test-owner-uid')}
                disabled={submitting}
                className="px-3 py-2 text-xs bg-white/5 border border-white/10 text-white/70 rounded-lg hover:border-gold/30 hover:text-gold transition-colors disabled:opacity-50"
              >
                Owner
              </button>
              <button
                onClick={() => handleDevLogin('pro@test.com', 'test-pro-uid')}
                disabled={submitting}
                className="px-3 py-2 text-xs bg-white/5 border border-white/10 text-white/70 rounded-lg hover:border-gold/30 hover:text-gold transition-colors disabled:opacity-50"
              >
                Provider
              </button>
            </div>
          </div>

          {/* Link to Landing */}
          <p className="text-sm text-white/60 text-center mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/" className="text-gold hover:text-gold/80 transition-colors">
              Back to Home
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="text-xs text-white/40 text-center mt-8">
          Protected by enterprise security
        </p>
      </div>
    </div>
  );
}
