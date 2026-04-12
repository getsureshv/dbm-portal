'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ChevronRight, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../../lib/auth-context';
import { onboarding } from '../../../lib/api';

type OnboardingStep = 'role' | 'owner-step1' | 'provider-step1' | 'provider-step2' | 'provider-step3' | 'complete';

const PROVIDER_TYPES = [
  { id: 'PROFESSIONAL', label: 'Professional Services', description: 'General contractors, architects, engineers' },
  { id: 'SUPPLIER', label: 'Supplier', description: 'Materials and equipment suppliers' },
  { id: 'FREIGHT', label: 'Freight/Logistics', description: 'Transportation and logistics' },
];

const TRADES = [
  'Electrical', 'Plumbing', 'HVAC', 'Carpentry', 'Masonry',
  'Roofing', 'Concrete', 'Painting', 'Flooring', 'Landscaping',
];

export default function OnboardingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const roleParam = searchParams.get('role');

  const [step, setStep] = useState<OnboardingStep>('role');
  const [role, setRole] = useState<'owner' | 'provider' | null>(
    roleParam === 'owner' || roleParam === 'provider' ? roleParam : null,
  );
  const [providerStep, setProviderStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form data
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [providerType, setProviderType] = useState('');
  const [company, setCompany] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [contactEmail, setContactEmail] = useState(user?.email || '');
  const [selectedTrades, setSelectedTrades] = useState<string[]>([]);

  // If user already completed onboarding, redirect to dashboard
  useEffect(() => {
    if (user?.onboardingComplete) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  useEffect(() => {
    if (roleParam === 'owner') {
      setRole('owner');
      setStep('owner-step1');
    } else if (roleParam === 'provider') {
      setRole('provider');
      setStep('provider-step1');
    }
  }, [roleParam]);

  const toggleTrade = (trade: string) => {
    setSelectedTrades((prev) =>
      prev.includes(trade) ? prev.filter((t) => t !== trade) : [...prev, trade],
    );
  };

  const getProgressPercentage = () => {
    if (role === 'owner') return 100;
    if (providerStep === 1) return 33;
    if (providerStep === 2) return 66;
    if (providerStep === 3) return 100;
    return 0;
  };

  const handleRoleSelect = async (selectedRole: 'owner' | 'provider') => {
    setSubmitting(true);
    setError(null);
    try {
      if (selectedRole === 'owner') {
        await onboarding.setRole({ role: 'OWNER' });
        setRole('owner');
        setStep('owner-step1');
      } else {
        setRole('provider');
        setStep('provider-step1');
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
      // If role wasn't set yet (came from URL param), set it now
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

  const handleProviderStep1Submit = async () => {
    if (!providerType) return;
    setSubmitting(true);
    setError(null);
    try {
      // Set role + providerType on the backend
      if (!user?.role) {
        await onboarding.setRole({
          role: 'PROVIDER',
          providerType: providerType as 'PROFESSIONAL' | 'SUPPLIER' | 'FREIGHT',
        });
      }
      setProviderStep(2);
      setStep('provider-step2');
    } catch (err: any) {
      setError(err.message || 'Failed to set role');
    } finally {
      setSubmitting(false);
    }
  };

  const handleProviderStep2Submit = () => {
    if (company && selectedTrades.length > 0) {
      setProviderStep(3);
      setStep('provider-step3');
    }
  };

  const handleProviderStep3Submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const profileData: Record<string, unknown> = { companyName: company };

      if (providerType === 'PROFESSIONAL') {
        Object.assign(profileData, {
          firstName: firstName || company,
          lastName: lastName || 'N/A',
          contactNumber1: phone || '(555) 000-0000',
          email: contactEmail,
          tradeNameSlug: selectedTrades[0]?.toLowerCase() || 'general-contractor',
        });
      } else if (providerType === 'SUPPLIER') {
        Object.assign(profileData, {
          contactPerson: `${firstName} ${lastName}`.trim() || company,
          email: contactEmail,
          phone: phone || '(555) 000-0000',
        });
      } else if (providerType === 'FREIGHT') {
        Object.assign(profileData, {
          contactPerson: `${firstName} ${lastName}`.trim() || company,
          phone: phone || '(555) 000-0000',
          email: contactEmail,
        });
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy via-navy-dark to-navy-light p-8">
      <div className="max-w-2xl mx-auto">
        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Progress Indicator */}
        {role === 'provider' && step !== 'complete' && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold text-white">Setup Your Profile</h1>
              <span className="text-sm text-white/60">Step {providerStep} of 3</span>
            </div>
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-gold to-gold/70 transition-all duration-300"
                style={{ width: `${getProgressPercentage()}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Role Selection */}
        {step === 'role' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-2">What&apos;s your role?</h2>
            <p className="text-white/60 mb-8">We&apos;ll customize your experience based on your needs</p>
            <div className="space-y-4">
              <button
                onClick={() => handleRoleSelect('owner')}
                disabled={submitting}
                className="w-full p-6 border-2 border-white/20 rounded-xl hover:border-gold/50 hover:bg-gold/5 transition-all text-left disabled:opacity-50"
              >
                <h3 className="text-lg font-semibold text-white mb-2">I am an Owner</h3>
                <p className="text-white/60 text-sm">For Homeowners and Developers looking for expert teams</p>
              </button>
              <button
                onClick={() => handleRoleSelect('provider')}
                disabled={submitting}
                className="w-full p-6 border-2 border-white/20 rounded-xl hover:border-gold/50 hover:bg-gold/5 transition-all text-left disabled:opacity-50"
              >
                <h3 className="text-lg font-semibold text-white mb-2">I am a Provider</h3>
                <p className="text-white/60 text-sm">For Architects, Contractors, and Material Suppliers</p>
              </button>
            </div>
          </div>
        )}

        {/* Owner Flow — Zero Friction: Name + Phone only */}
        {step === 'owner-step1' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-8">Tell us about you</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/40 focus:outline-none focus:border-gold/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/40 focus:outline-none focus:border-gold/50"
                />
              </div>
              <button
                onClick={handleOwnerSubmit}
                disabled={!name || !phone || submitting}
                className="w-full bg-gold text-navy font-semibold py-2.5 rounded-lg hover:bg-gold/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="animate-spin" size={18} /> : <ChevronRight size={18} />}
                {submitting ? 'Saving...' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {/* Provider Step 1: Type */}
        {step === 'provider-step1' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-2">What type of provider are you?</h2>
            <p className="text-white/60 mb-8">Choose the category that best fits your business</p>
            <div className="space-y-4">
              {PROVIDER_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setProviderType(type.id)}
                  className={`w-full p-4 rounded-lg border transition-all text-left ${
                    providerType === type.id
                      ? 'border-gold/50 bg-gold/10'
                      : 'border-white/20 hover:border-white/30'
                  }`}
                >
                  <h3 className="font-semibold text-white">{type.label}</h3>
                  <p className="text-sm text-white/60 mt-1">{type.description}</p>
                </button>
              ))}
              <button
                onClick={handleProviderStep1Submit}
                disabled={!providerType || submitting}
                className="w-full bg-gold text-navy font-semibold py-2.5 rounded-lg hover:bg-gold/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 mt-6"
              >
                {submitting ? <Loader2 className="animate-spin" size={18} /> : <ChevronRight size={18} />}
                {submitting ? 'Saving...' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {/* Provider Step 2: Company + Trades */}
        {step === 'provider-step2' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-8">Company Details</h2>
            <div className="space-y-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">Company Name</label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Your Company Name"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/40 focus:outline-none focus:border-gold/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/40 focus:outline-none focus:border-gold/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/40 focus:outline-none focus:border-gold/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">Contact Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/40 focus:outline-none focus:border-gold/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-3">Areas of Expertise</label>
                <div className="grid grid-cols-2 gap-2">
                  {TRADES.map((trade) => (
                    <button
                      key={trade}
                      onClick={() => toggleTrade(trade)}
                      className={`p-3 rounded-lg border transition-all text-sm font-medium ${
                        selectedTrades.includes(trade)
                          ? 'border-gold/50 bg-gold/10 text-gold'
                          : 'border-white/20 text-white/60 hover:border-white/30'
                      }`}
                    >
                      {trade}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={handleProviderStep2Submit}
              disabled={!company || selectedTrades.length === 0}
              className="w-full bg-gold text-navy font-semibold py-2.5 rounded-lg hover:bg-gold/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              Continue <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* Provider Step 3: Review */}
        {step === 'provider-step3' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-8">Review Your Information</h2>
            <div className="space-y-4 mb-8 bg-white/5 rounded-lg p-6">
              <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <span className="text-white/60">Provider Type:</span>
                <span className="text-white font-medium">
                  {PROVIDER_TYPES.find((t) => t.id === providerType)?.label}
                </span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <span className="text-white/60">Company:</span>
                <span className="text-white font-medium">{company}</span>
              </div>
              {firstName && (
                <div className="flex justify-between items-center pb-4 border-b border-white/10">
                  <span className="text-white/60">Contact:</span>
                  <span className="text-white font-medium">{firstName} {lastName}</span>
                </div>
              )}
              <div className="flex justify-between items-start">
                <span className="text-white/60">Expertise:</span>
                <div className="flex flex-wrap gap-2 justify-end">
                  {selectedTrades.map((trade) => (
                    <span key={trade} className="px-3 py-1 bg-gold/10 text-gold text-sm rounded-full">
                      {trade}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={handleProviderStep3Submit}
              disabled={submitting}
              className="w-full bg-gold text-navy font-semibold py-2.5 rounded-lg hover:bg-gold/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
              {submitting ? 'Creating profile...' : 'Complete Setup'}
            </button>
          </div>
        )}

        {/* Completion */}
        {step === 'complete' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
            <div className="mb-6">
              <div className="w-16 h-16 mx-auto bg-gold/20 rounded-full flex items-center justify-center mb-4">
                <Check className="text-gold" size={32} />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">All Set!</h2>
            <p className="text-white/60 mb-8">Your profile is ready. Let&apos;s get started.</p>
            <a
              href="/dashboard"
              className="inline-block bg-gold text-navy font-semibold px-8 py-2.5 rounded-lg hover:bg-gold/90 transition-colors"
            >
              Go to Dashboard
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
