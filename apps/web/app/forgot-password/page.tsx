'use client';

import {
  Mail,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  KeyRound,
  Info,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { sendPasswordReset, isFirebaseConfigured } from '../../lib/firebase';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (!isFirebaseConfigured) {
        // Dev/local environments use mock login and have no password to reset.
        setError(
          'Password reset is unavailable in this environment. Use the Dev Login tool to sign in.',
        );
        return;
      }
      await sendPasswordReset(email);
      // Always show success even if the email has no account, to avoid leaking
      // which addresses are registered (account-enumeration protection).
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6 sm:p-10">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center">
              <span className="text-navy text-xl font-black">D</span>
            </div>
            <span className="text-navy text-2xl font-extrabold tracking-tight">
              DBM
            </span>
          </Link>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 size={28} className="text-emerald-600" />
            </div>
            <h1 className="text-navy text-2xl font-extrabold tracking-tight mb-2">
              Check your inbox
            </h1>
            <p className="text-gray-500 text-sm mb-2">
              If an account exists for{' '}
              <span className="font-semibold text-gray-700">{email}</span>,
              we&apos;ve sent a link to reset your password.
            </p>
            <p className="text-gray-400 text-xs mb-8">
              The email can take a minute to arrive. Be sure to check spam.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 text-navy font-semibold text-sm hover:text-gold-dark transition"
            >
              <ArrowLeft size={15} />
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center mb-5">
              <div className="w-12 h-12 rounded-xl bg-navy/5 flex items-center justify-center">
                <KeyRound size={22} className="text-navy" />
              </div>
            </div>
            <div className="mb-7 text-center">
              <h1 className="text-navy text-2xl font-extrabold tracking-tight mb-2">
                Reset your password
              </h1>
              <p className="text-gray-500 text-sm">
                Enter the email you use for DBM and we&apos;ll send you a link
                to set a new password.
              </p>
            </div>

            {error && (
              <div className="mb-5 p-3.5 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2.5 text-red-700 text-sm">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

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
                    autoFocus
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:bg-white focus:border-gold focus:ring-2 focus:ring-gold/20 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !email}
                className="w-full bg-navy hover:bg-navy-light text-white font-semibold py-3 rounded-xl disabled:opacity-50 transition-colors shadow-md flex items-center justify-center gap-2 group"
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Sending…
                  </>
                ) : (
                  <>
                    Send reset link
                    <ArrowRight
                      size={15}
                      className="group-hover:translate-x-0.5 transition-transform"
                    />
                  </>
                )}
              </button>
            </form>

            {/* Social-only account note */}
            <div className="mt-5 p-3.5 bg-blue-50/60 border border-blue-100 rounded-xl flex items-start gap-2.5 text-blue-800 text-xs">
              <Info size={15} className="shrink-0 mt-0.5" />
              <span>
                Signed up with Google or Apple? Those accounts don&apos;t have a
                DBM password — just use the{' '}
                <Link href="/login" className="font-semibold underline">
                  Google or Apple button
                </Link>{' '}
                on the sign-in page.
              </span>
            </div>

            <p className="text-sm text-gray-500 text-center mt-7">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-navy font-semibold hover:text-gold-dark transition"
              >
                <ArrowLeft size={14} />
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
