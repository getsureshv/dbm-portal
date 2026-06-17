'use client';

import {
  Mail,
  Lock,
  AlertCircle,
  Loader2,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import {
  signInWithGoogle,
  signInWithApple,
  signInWithEmailPassword,
  isFirebaseConfigured,
} from '../../lib/firebase';

export default function LoginPage() {
  const {
    devLogin,
    login,
    loading,
    error: authError,
    user,
  } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  if (loading || user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-gold" size={32} />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    setError(null);
    try {
      if (isFirebaseConfigured) {
        const idToken = await signInWithEmailPassword(email, password);
        await login(idToken);
      } else {
        await devLogin(email, `dev-${email}`);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setSocialLoading('google');
    setError(null);
    try {
      const idToken = await signInWithGoogle();
      await login(idToken);
    } catch (err: any) {
      if (err.message !== 'Redirecting to Google sign-in...') {
        setError(err.message || 'Google sign-in failed');
      }
    } finally {
      setSocialLoading(null);
    }
  };

  const handleAppleSignIn = async () => {
    setSocialLoading('apple');
    setError(null);
    try {
      const idToken = await signInWithApple();
      await login(idToken);
    } catch (err: any) {
      if (err.message !== 'Redirecting to Apple sign-in...') {
        setError(err.message || 'Apple sign-in failed');
      }
    } finally {
      setSocialLoading(null);
    }
  };

  const displayError = error || authError;

  return (
    <div className="min-h-screen bg-white flex">
      {/* ── Left Brand Panel (hidden on mobile) ─────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-navy">
        <div className="absolute inset-0 bg-gradient-to-br from-navy via-navy-dark to-[#0a1135]" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="absolute -top-32 -left-24 w-96 h-96 bg-gold/15 rounded-full blur-[100px]" />
        <div className="absolute -bottom-32 -right-24 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px]" />

        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 w-fit group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
              <span className="text-navy text-xl font-black">D</span>
            </div>
            <div>
              <div className="text-white font-extrabold text-xl tracking-tight leading-none">
                DBM
              </div>
              <div className="text-white/40 text-[11px] mt-0.5">
                Don&apos;t Build Meh
              </div>
            </div>
          </Link>

          {/* Centered hero pitch */}
          <div className="my-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-6 backdrop-blur">
              <Sparkles size={13} className="text-gold" />
              <span className="text-white/80 text-xs font-medium tracking-wide">
                AI-powered construction marketplace
              </span>
            </div>
            <h2 className="text-white text-4xl xl:text-5xl font-extrabold leading-[1.1] tracking-tight mb-5">
              Build smarter.<br />
              <span className="text-gold">Hire with confidence.</span>
            </h2>
            <p className="text-white/60 text-base max-w-md leading-relaxed">
              The platform where homeowners and verified pros connect through
              AI-generated scopes — not phone tag.
            </p>

            {/* Mini stats */}
            <div className="flex gap-8 mt-10">
              <div>
                <div className="text-gold font-extrabold text-2xl">500+</div>
                <div className="text-white/50 text-xs mt-0.5">
                  Verified Pros
                </div>
              </div>
              <div className="w-px bg-white/10" />
              <div>
                <div className="text-gold font-extrabold text-2xl">4.8/5</div>
                <div className="text-white/50 text-xs mt-0.5">Avg Rating</div>
              </div>
              <div className="w-px bg-white/10" />
              <div>
                <div className="text-gold font-extrabold text-2xl">$42M</div>
                <div className="text-white/50 text-xs mt-0.5">Sourced</div>
              </div>
            </div>
          </div>

          {/* Testimonial */}
          <figure className="bg-white/[0.04] border border-white/10 rounded-2xl p-5 backdrop-blur">
            <blockquote className="text-white/85 text-sm leading-relaxed">
              “The AI Scope Architect saved me weeks. Contractors actually
              respected the document it generated.”
            </blockquote>
            <figcaption className="flex items-center gap-3 mt-4 pt-4 border-t border-white/10">
              <img
                src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop&crop=faces"
                alt=""
                className="w-9 h-9 rounded-full object-cover ring-2 ring-white/10"
              />
              <div>
                <div className="text-white text-sm font-semibold">
                  Priya Anand
                </div>
                <div className="text-white/40 text-xs">
                  Homeowner · Austin, TX
                </div>
              </div>
            </figcaption>
          </figure>
        </div>
      </div>

      {/* ── Right Form Panel ────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2.5 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center">
                <span className="text-navy text-xl font-black">D</span>
              </div>
              <span className="text-navy text-2xl font-extrabold tracking-tight">
                DBM
              </span>
            </Link>
          </div>

          {/* Form Header */}
          <div className="mb-8">
            <h1 className="text-navy text-3xl font-extrabold tracking-tight mb-2">
              Welcome back
            </h1>
            <p className="text-gray-500 text-sm">
              Sign in to continue to your dashboard.
            </p>
          </div>

          {/* Error Banner */}
          {displayError && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2.5 text-red-700 text-sm">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{displayError}</span>
            </div>
          )}

          {/* Social Auth (top — common UX pattern) */}
          {/* Apple sign-in is temporarily disabled until the Apple Developer
              Services ID / Sign in with Apple key is configured. Re-enable by
              restoring the Apple <button> below and the grid-cols-2 layout. */}
          <div className="grid grid-cols-1 gap-3 mb-5">
            <button
              onClick={handleGoogleSignIn}
              disabled={submitting || !!socialLoading}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-700 font-medium text-sm hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 transition shadow-sm"
            >
              {socialLoading === 'google' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              )}
              Google
            </button>
          </div>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-[11px] text-gray-400 uppercase tracking-widest font-medium">
              or with email
            </span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                Email
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  size={16}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:bg-white focus:border-gold focus:ring-2 focus:ring-gold/20 transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Password
                </label>
                {isFirebaseConfigured && (
                  <Link
                    href="/forgot-password"
                    className="text-xs text-navy font-semibold hover:text-gold-dark transition"
                  >
                    Forgot password?
                  </Link>
                )}
              </div>
              <div className="relative">
                <Lock
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  size={16}
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:bg-white focus:border-gold focus:ring-2 focus:ring-gold/20 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={
                submitting || !email || (isFirebaseConfigured && !password)
              }
              className="w-full bg-navy hover:bg-navy-light text-white font-semibold py-3 rounded-xl disabled:opacity-50 transition-colors shadow-md flex items-center justify-center gap-2 group"
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Signing in…
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight
                    size={15}
                    className="group-hover:translate-x-0.5 transition-transform"
                  />
                </>
              )}
            </button>
          </form>

          {/* Account-recovery helper (covers "forgot username": DBM uses your
              email as the only identifier, so there is no separate username). */}
          <p className="text-xs text-gray-400 text-center mt-5">
            Not sure which email you used? Try the{' '}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="text-gray-500 font-medium underline hover:text-gray-700 transition"
            >
              Google button
            </button>{' '}
            — DBM signs you in by email, so there&apos;s no separate username to
            remember.
          </p>

          {/* Sign-up CTA */}
          <p className="text-sm text-gray-500 text-center mt-7">
            New to DBM?{' '}
            <Link
              href="/onboarding"
              className="text-navy font-semibold hover:text-gold-dark transition"
            >
              Create an account →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
