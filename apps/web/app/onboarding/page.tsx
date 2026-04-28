'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronRight,
  Check,
  AlertCircle,
  Loader2,
  Mail,
  Lock,
  Sparkles,
  ShieldCheck,
  Home,
  HardHat,
  ArrowRight,
  ArrowLeft,
  User,
  Phone,
  Building2,
  Globe,
  CalendarClock,
  MapPin,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { onboarding } from '../../lib/api';
import {
  signInWithGoogle,
  signInWithApple,
  signUpWithEmailPassword,
  isFirebaseConfigured,
} from '../../lib/firebase';

type OnboardingStep = 'role' | 'owner-profile' | 'provider-profile' | 'complete';

const PROVIDER_TYPES = [
  {
    id: 'PROFESSIONAL',
    label: 'Professional Services',
    description: 'General contractors, architects, engineers',
    icon: HardHat,
  },
  {
    id: 'SUPPLIER',
    label: 'Supplier',
    description: 'Materials and equipment suppliers',
    icon: Building2,
  },
  {
    id: 'FREIGHT',
    label: 'Freight / Logistics',
    description: 'Transportation and logistics',
    icon: MapPin,
  },
];

const TRADES = [
  'Electrical',
  'Plumbing',
  'HVAC',
  'Carpentry',
  'Masonry',
  'Roofing',
  'Concrete',
  'Painting',
  'Flooring',
  'Landscaping',
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading, refreshUser, devLogin, login } = useAuth();

  const [step, setStep] = useState<OnboardingStep>('role');
  const [role, setRole] = useState<'owner' | 'provider' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Owner form
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');

  // Provider form (single page)
  const [providerType, setProviderType] = useState('');
  const [company, setCompany] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [contactEmail, setContactEmail] = useState(user?.email || '');
  const [primaryTrade, setPrimaryTrade] = useState('');
  const [website, setWebsite] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [yearsInBusiness, setYearsInBusiness] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateRegion, setStateRegion] = useState('');
  const [zip, setZip] = useState('');

  // Auth state for sign-up
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(
    null,
  );

  useEffect(() => {
    if (!user) return;
    if (user.onboardingComplete) {
      router.replace('/dashboard');
      return;
    }
    if (user.role === 'OWNER') {
      setRole('owner');
      setStep('owner-profile');
    } else if (user.role === 'PROVIDER') {
      setRole('provider');
      if (user.providerType) {
        setProviderType(user.providerType);
      }
      setStep('provider-profile');
    }
    if (user.email && !contactEmail) setContactEmail(user.email);
  }, [user, router, contactEmail]);

  const handleEmailSignup = async () => {
    if (!authEmail) return;
    if (isFirebaseConfigured && !authPassword) {
      setError('Please choose a password.');
      return;
    }
    if (isFirebaseConfigured && authPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (isFirebaseConfigured) {
        const idToken = await signUpWithEmailPassword(authEmail, authPassword);
        await login(idToken);
      } else {
        await devLogin(authEmail, `dev-${authEmail}`);
      }
    } catch (err: any) {
      setError(err.message || 'Sign-up failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignup = async () => {
    setSocialLoading('google');
    setError(null);
    try {
      const idToken = await signInWithGoogle();
      await login(idToken);
    } catch (err: any) {
      if (err.message !== 'Redirecting to Google sign-in...') {
        setError(err.message || 'Google sign-up failed');
      }
    } finally {
      setSocialLoading(null);
    }
  };

  const handleAppleSignup = async () => {
    setSocialLoading('apple');
    setError(null);
    try {
      const idToken = await signInWithApple();
      await login(idToken);
    } catch (err: any) {
      setError(err.message || 'Apple sign-up failed');
    } finally {
      setSocialLoading(null);
    }
  };

  const handleRoleSelect = async (selectedRole: 'owner' | 'provider') => {
    setSubmitting(true);
    setError(null);
    try {
      if (selectedRole === 'owner') {
        await onboarding.setRole({ role: 'OWNER' });
        await refreshUser();
        setRole('owner');
        setStep('owner-profile');
      } else {
        setRole('provider');
        setStep('provider-profile');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to set role');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOwnerSubmit = async () => {
    if (!name || !phone) return;
    setSubmitting(true);
    setError(null);
    try {
      if (!user?.role) {
        await onboarding.setRole({ role: 'OWNER' });
      }
      await onboarding.createProfile({ name, phone });
      await refreshUser();
      setStep('complete');
    } catch (err: any) {
      setError(err.message || 'Failed to create profile');
    } finally {
      setSubmitting(false);
    }
  };

  const buildAddress = () => {
    if (!street && !city && !stateRegion && !zip) return undefined;
    return { street, city, state: stateRegion, zipCode: zip };
  };

  const handleProviderSubmit = async () => {
    if (
      !providerType ||
      !company ||
      !firstName ||
      !lastName ||
      !contactEmail ||
      !phone
    ) {
      setError('Please fill all required fields');
      return;
    }
    if (providerType === 'PROFESSIONAL' && !primaryTrade) {
      setError('Please select a primary trade');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (!user?.role) {
        await onboarding.setRole({
          role: 'PROVIDER',
          providerType: providerType as 'PROFESSIONAL' | 'SUPPLIER' | 'FREIGHT',
        });
      }

      const baseProfile: Record<string, unknown> = {
        firstName,
        lastName,
        companyName: company,
        contactNumber1: phone,
        email: contactEmail,
      };

      const optional: Record<string, unknown> = {};
      if (website) optional.website = website;
      const addr = buildAddress();
      if (addr) optional.address = addr;
      const yearsNum = yearsInBusiness ? parseInt(yearsInBusiness, 10) : null;
      if (yearsNum && !Number.isNaN(yearsNum)) optional.yearsInBusiness = yearsNum;

      const profileData: Record<string, unknown> = {
        ...baseProfile,
        ...optional,
      };

      if (providerType === 'PROFESSIONAL') {
        profileData.tradeNameSlug = primaryTrade.toLowerCase();
        if (licenseNumber) profileData.licenseNumber = licenseNumber;
      }

      await onboarding.createProfile(profileData);
      await refreshUser();
      setStep('complete');
    } catch (err: any) {
      setError(err.message || 'Failed to create profile');
    } finally {
      setSubmitting(false);
    }
  };

  /* ────────── Loading ────────── */
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-gold" size={32} />
      </div>
    );
  }

  /* ────────── Phase 1: Sign-Up Auth (split-screen) ────────── */
  if (!user) {
    return (
      <div className="min-h-screen bg-white flex">
        {/* Left brand panel */}
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

            <div className="my-12">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-6 backdrop-blur">
                <Sparkles size={13} className="text-gold" />
                <span className="text-white/80 text-xs font-medium tracking-wide">
                  Join 500+ verified pros and homeowners
                </span>
              </div>
              <h2 className="text-white text-4xl xl:text-5xl font-extrabold leading-[1.1] tracking-tight mb-5">
                Start your project<br />
                <span className="text-gold">the smart way.</span>
              </h2>
              <p className="text-white/60 text-base max-w-md leading-relaxed">
                In minutes you&apos;ll have a clear scope, a list of qualified
                pros, and a way to compare bids — all from one place.
              </p>

              <ul className="space-y-3 mt-10 max-w-md">
                {[
                  'AI Scope Architect generates your SOW for free',
                  'Verified, licensed pros — never cold-call again',
                  'Compare bids and award projects in one place',
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 text-sm text-white/85"
                  >
                    <div className="mt-0.5 w-5 h-5 rounded-full bg-gold/15 flex items-center justify-center shrink-0">
                      <CheckCircle2 size={12} className="text-gold" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-white/40 text-xs">
              By signing up you agree to our Terms and Privacy Policy.
            </p>
          </div>
        </div>

        {/* Right form panel */}
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

            <div className="mb-8">
              <h1 className="text-navy text-3xl font-extrabold tracking-tight mb-2">
                Create your account
              </h1>
              <p className="text-gray-500 text-sm">
                Get started free — no credit card required.
              </p>
            </div>

            {error && (
              <div className="mb-5 p-3.5 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2.5 text-red-700 text-sm">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Social Auth */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <button
                onClick={handleGoogleSignup}
                disabled={!isFirebaseConfigured || socialLoading !== null}
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
              <button
                onClick={handleAppleSignup}
                disabled={!isFirebaseConfigured || socialLoading !== null}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-black text-white font-medium text-sm rounded-xl hover:bg-gray-900 disabled:opacity-50 transition shadow-sm"
              >
                {socialLoading === 'apple' ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                  </svg>
                )}
                Apple
              </button>
            </div>

            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-[11px] text-gray-400 uppercase tracking-widest font-medium">
                or with email
              </span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <div className="space-y-4">
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
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === 'Enter' && handleEmailSignup()
                    }
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:bg-white focus:border-gold focus:ring-2 focus:ring-gold/20 transition"
                  />
                </div>
              </div>

              {isFirebaseConfigured && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                      size={16}
                    />
                    <input
                      type="password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === 'Enter' && handleEmailSignup()
                      }
                      placeholder="At least 6 characters"
                      autoComplete="new-password"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:bg-white focus:border-gold focus:ring-2 focus:ring-gold/20 transition"
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handleEmailSignup}
                disabled={
                  !authEmail ||
                  (isFirebaseConfigured && !authPassword) ||
                  submitting
                }
                className="w-full bg-navy hover:bg-navy-light text-white font-semibold py-3 rounded-xl disabled:opacity-50 transition-colors shadow-md flex items-center justify-center gap-2 group"
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Creating account…
                  </>
                ) : (
                  <>
                    Create Account
                    <ArrowRight
                      size={15}
                      className="group-hover:translate-x-0.5 transition-transform"
                    />
                  </>
                )}
              </button>
            </div>

            {!isFirebaseConfigured && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2 text-amber-800 text-xs">
                <ShieldCheck size={14} className="shrink-0 mt-0.5" />
                <span>
                  Firebase not configured — email creates a dev account for
                  local testing.
                </span>
              </div>
            )}

            <p className="text-sm text-gray-500 text-center mt-7">
              Already have an account?{' '}
              <Link
                href="/login"
                className="text-navy font-semibold hover:text-gold-dark transition"
              >
                Log in →
              </Link>
            </p>

            <p className="text-[11px] text-gray-400 text-center mt-6 leading-relaxed">
              By creating an account you agree to DBM&apos;s{' '}
              <a href="#" className="underline hover:text-gray-600">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="#" className="underline hover:text-gray-600">
                Privacy Policy
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ────────── Phase 2: Authenticated — Role / Profile / Complete ────────── */
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top progress strip */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center">
              <span className="text-navy text-base font-black">D</span>
            </div>
            <span className="text-navy text-lg font-extrabold tracking-tight">
              DBM
            </span>
          </Link>
          <ProgressIndicator step={step} />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-3.5 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2.5 text-red-700 text-sm">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Header */}
        {step !== 'complete' && (
          <div className="mb-8">
            <h1 className="text-navy text-3xl font-extrabold tracking-tight">
              {step === 'role' && 'Welcome — let\u2019s set up your account'}
              {step === 'owner-profile' && 'Tell us about you'}
              {step === 'provider-profile' && 'Set up your business profile'}
            </h1>
            <p className="text-gray-500 text-sm mt-2">
              {step === 'role' && 'Choose how you\u2019ll use DBM.'}
              {step === 'owner-profile' &&
                'Just a couple of details and you\u2019re in.'}
              {step === 'provider-profile' &&
                'A complete profile gets 4× more bids — but you can come back to fill optional details later.'}
            </p>
          </div>
        )}

        {/* Role Selection */}
        {step === 'role' && (
          <div className="space-y-4">
            <button
              onClick={() => handleRoleSelect('owner')}
              disabled={submitting}
              className="w-full p-6 bg-white border-2 border-gray-200 hover:border-gold rounded-2xl shadow-sm hover:shadow-lg transition-all text-left group disabled:opacity-50"
            >
              <div className="flex items-start gap-5">
                <div className="w-14 h-14 rounded-2xl bg-gold/10 group-hover:bg-gold/20 flex items-center justify-center shrink-0 transition">
                  <Home size={26} className="text-gold-dark" />
                </div>
                <div className="flex-1">
                  <h3 className="text-navy text-lg font-bold mb-1">
                    I&apos;m an Owner
                  </h3>
                  <p className="text-gray-500 text-sm leading-relaxed">
                    Homeowners and developers seeking expert teams to plan,
                    build, or remodel.
                  </p>
                </div>
                <ArrowRight
                  size={20}
                  className="text-gray-300 group-hover:text-gold-dark group-hover:translate-x-1 transition shrink-0 mt-1"
                />
              </div>
            </button>

            <button
              onClick={() => handleRoleSelect('provider')}
              disabled={submitting}
              className="w-full p-6 bg-white border-2 border-gray-200 hover:border-blue-400 rounded-2xl shadow-sm hover:shadow-lg transition-all text-left group disabled:opacity-50"
            >
              <div className="flex items-start gap-5">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center shrink-0 transition">
                  <HardHat size={26} className="text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-navy text-lg font-bold mb-1">
                    I&apos;m a Provider
                  </h3>
                  <p className="text-gray-500 text-sm leading-relaxed">
                    Architects, contractors, suppliers, and service providers
                    looking to grow their business.
                  </p>
                </div>
                <ArrowRight
                  size={20}
                  className="text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition shrink-0 mt-1"
                />
              </div>
            </button>
          </div>
        )}

        {/* Owner Profile */}
        {step === 'owner-profile' && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-8 space-y-6">
            <Field
              label="Full Name"
              icon={<User size={15} />}
              required
            >
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                className={inputClass}
              />
            </Field>

            <Field
              label="Phone Number"
              icon={<Phone size={15} />}
              required
              hint="We share this only with pros you choose to work with."
            >
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className={inputClass}
              />
            </Field>

            <button
              onClick={handleOwnerSubmit}
              disabled={!name || !phone || submitting}
              className="w-full bg-navy hover:bg-navy-light text-white font-semibold py-3 rounded-xl disabled:opacity-50 transition shadow-md flex items-center justify-center gap-2 group"
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Saving…
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight
                    size={15}
                    className="group-hover:translate-x-0.5 transition-transform"
                  />
                </>
              )}
            </button>
          </div>
        )}

        {/* Provider Profile */}
        {step === 'provider-profile' && (
          <div className="space-y-6">
            {/* Provider Type */}
            <SectionCard
              title="Provider Type"
              required
              description="What kind of business are you running?"
            >
              <div className="grid sm:grid-cols-3 gap-3">
                {PROVIDER_TYPES.map((type) => {
                  const Icon = type.icon;
                  const active = providerType === type.id;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setProviderType(type.id)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        active
                          ? 'border-gold bg-gold/5 shadow-md ring-2 ring-gold/20'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 transition ${
                          active
                            ? 'bg-gold text-navy'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        <Icon size={18} />
                      </div>
                      <h4 className="font-bold text-navy text-sm leading-tight">
                        {type.label}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1 leading-snug">
                        {type.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </SectionCard>

            {/* Company & Contact */}
            <SectionCard
              title="Company & Contact"
              description="Required information for your public profile."
            >
              <div className="space-y-4">
                <Field label="Company Name" icon={<Building2 size={15} />} required>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Your Company Name"
                    className={inputClass}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="First Name" required>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="First"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Last Name" required>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Last"
                      className={inputClass}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field
                    label="Business Email"
                    icon={<Mail size={15} />}
                    required
                  >
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="you@example.com"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Phone" icon={<Phone size={15} />} required>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                      className={inputClass}
                    />
                  </Field>
                </div>

                {providerType === 'PROFESSIONAL' && (
                  <Field
                    label="Primary Trade"
                    required
                    hint="The trade clients are most likely to find you under."
                  >
                    <select
                      value={primaryTrade}
                      onChange={(e) => setPrimaryTrade(e.target.value)}
                      className={`${inputClass} appearance-none bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23999%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22/%3E%3C/svg%3E')] bg-no-repeat bg-[right_1rem_center] bg-[length:16px] pr-10`}
                    >
                      <option value="">Select a trade…</option>
                      {TRADES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>
            </SectionCard>

            {/* Optional details */}
            <SectionCard
              title="Additional Details"
              optional
              description="These help you stand out — but you can skip and come back later."
            >
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Website" icon={<Globe size={15} />}>
                    <input
                      type="url"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://example.com"
                      className={inputClass}
                    />
                  </Field>
                  <Field
                    label="Years in Business"
                    icon={<CalendarClock size={15} />}
                  >
                    <input
                      type="number"
                      min={0}
                      value={yearsInBusiness}
                      onChange={(e) => setYearsInBusiness(e.target.value)}
                      placeholder="e.g. 5"
                      className={inputClass}
                    />
                  </Field>
                </div>

                {providerType === 'PROFESSIONAL' && (
                  <Field label="License Number" icon={<FileText size={15} />}>
                    <input
                      type="text"
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      placeholder="License # if applicable"
                      className={inputClass}
                    />
                  </Field>
                )}

                <Field label="Business Address" icon={<MapPin size={15} />}>
                  <input
                    type="text"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="Street address"
                    className={`${inputClass} mb-3`}
                  />
                  <div className="grid grid-cols-3 gap-3">
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="City"
                      className={inputClass}
                    />
                    <input
                      type="text"
                      value={stateRegion}
                      onChange={(e) => setStateRegion(e.target.value)}
                      placeholder="State"
                      className={inputClass}
                    />
                    <input
                      type="text"
                      value={zip}
                      onChange={(e) => setZip(e.target.value)}
                      placeholder="ZIP"
                      className={inputClass}
                    />
                  </div>
                </Field>
              </div>
            </SectionCard>

            <div className="sticky bottom-4 z-10 flex flex-col-reverse sm:flex-row gap-3 bg-white p-4 rounded-2xl shadow-xl border border-gray-100">
              <button
                onClick={() => setStep('role')}
                disabled={submitting}
                className="px-5 py-2.5 text-gray-600 hover:text-navy font-semibold text-sm transition flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <ArrowLeft size={15} />
                Back
              </button>
              <button
                onClick={handleProviderSubmit}
                disabled={submitting}
                className="flex-1 bg-navy hover:bg-navy-light text-white font-semibold py-3 rounded-xl disabled:opacity-50 transition shadow-md flex items-center justify-center gap-2 group"
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Creating profile…
                  </>
                ) : (
                  <>
                    Complete Setup
                    <Check size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Completion */}
        {step === 'complete' && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-12 text-center">
            <div className="relative inline-flex items-center justify-center mb-6">
              <div className="absolute inset-0 bg-gold/20 rounded-full blur-2xl" />
              <div className="relative w-20 h-20 bg-gradient-to-br from-gold to-gold-dark rounded-full flex items-center justify-center shadow-xl">
                <Check className="text-navy" size={36} strokeWidth={3} />
              </div>
            </div>
            <h2 className="text-navy text-3xl font-extrabold tracking-tight mb-3">
              You&apos;re all set!
            </h2>
            <p className="text-gray-500 mb-8 max-w-sm mx-auto">
              Your profile is live. Let&apos;s get your first project moving.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 bg-navy hover:bg-navy-light text-white font-semibold px-8 py-3 rounded-xl transition shadow-md group"
            >
              Go to Dashboard
              <ArrowRight
                size={16}
                className="group-hover:translate-x-1 transition-transform"
              />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────── Helpers ────────── */

const inputClass =
  'w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:bg-white focus:border-gold focus:ring-2 focus:ring-gold/20 transition';

function Field({
  label,
  icon,
  required,
  hint,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
        {icon && <span className="text-gray-400">{icon}</span>}
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1.5">{hint}</p>}
    </div>
  );
}

function SectionCard({
  title,
  description,
  required,
  optional,
  children,
}: {
  title: string;
  description?: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-7">
      <div className="flex items-baseline justify-between mb-4 pb-4 border-b border-gray-100">
        <div>
          <h3 className="text-navy text-base font-bold flex items-center gap-2">
            {title}
            {required && <span className="text-red-500">*</span>}
          </h3>
          {description && (
            <p className="text-xs text-gray-500 mt-1">{description}</p>
          )}
        </div>
        {optional && (
          <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">
            Optional
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function ProgressIndicator({ step }: { step: OnboardingStep }) {
  const steps: { id: OnboardingStep; label: string }[] = [
    { id: 'role', label: 'Role' },
    { id: 'owner-profile', label: 'Profile' },
    { id: 'complete', label: 'Done' },
  ];
  const stepsProvider: { id: OnboardingStep; label: string }[] = [
    { id: 'role', label: 'Role' },
    { id: 'provider-profile', label: 'Profile' },
    { id: 'complete', label: 'Done' },
  ];

  const flow = step === 'provider-profile' ? stepsProvider : steps;
  const idx = flow.findIndex((s) => s.id === step);

  return (
    <div className="hidden sm:flex items-center gap-2">
      {flow.map((s, i) => {
        const active = i === idx;
        const done = i < idx;
        return (
          <div key={s.id} className="flex items-center">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition ${
                active
                  ? 'bg-navy text-white'
                  : done
                  ? 'bg-gold/15 text-gold-dark'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  active
                    ? 'bg-gold text-navy'
                    : done
                    ? 'bg-gold-dark text-white'
                    : 'bg-white text-gray-500 border border-gray-200'
                }`}
              >
                {done ? <Check size={10} strokeWidth={3} /> : i + 1}
              </span>
              <span className="text-xs font-semibold">{s.label}</span>
            </div>
            {i < flow.length - 1 && (
              <ChevronRight
                size={14}
                className="text-gray-300 mx-1 shrink-0"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
