'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  User,
  Shield,
  Wrench,
  MapPin,
  Pencil,
  Save,
  X,
  Loader2,
  Globe,
  Phone,
  Mail,
  Award,
  Clock,
  AlertCircle,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../../lib/auth-context';
import { providers, discovery, ApiProviderProfile, ApiTradeCategory } from '../../../lib/api';

type EditingSection = 'company' | 'contact' | 'license' | 'trades' | 'areas' | null;

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ApiProviderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<EditingSection>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [tradeCategories, setTradeCategories] = useState<ApiTradeCategory[]>([]);

  const fetchProfile = useCallback(async () => {
    // Don't fetch if user hasn't completed onboarding (role not set)
    if (!user?.role) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const [data, trades] = await Promise.all([
        providers.getMe(),
        discovery.listTrades().catch(() => [] as ApiTradeCategory[]),
      ]);
      setProfile(data);
      setTradeCategories(trades);
    } catch (err: any) {
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const startEditing = (section: EditingSection) => {
    if (!profile) return;
    const p = profile.profile;

    if (section === 'company') {
      setFormData({
        companyName: p?.companyName || '',
        website: p?.website || '',
        yearsInBusiness: p?.yearsInBusiness ?? '',
      });
    } else if (section === 'contact') {
      if (profile.role === 'OWNER') {
        const nameParts = (profile.name || '').split(' ');
        setFormData({
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' ') || '',
          phone: profile.phone || '',
        });
      } else {
        setFormData({
          firstName: p?.firstName || '',
          lastName: p?.lastName || '',
          phone: p?.phone || '',
          email: p?.email || '',
        });
      }
    } else if (section === 'license') {
      setFormData({
        licenseNumber: p?.licenseNumber || '',
      });
    } else if (section === 'trades') {
      const currentTrades = p?.styleOfWork || p?.materialTypes || p?.serviceTypes || [];
      // Find the current category and trade IDs from the trade categories list
      let selectedCategoryId = '';
      let selectedTradeId = '';
      if (p?.tradeName?.name) {
        for (const cat of tradeCategories) {
          const found = cat.trades.find((t) => t.name === p.tradeName?.name);
          if (found) {
            selectedCategoryId = cat.id;
            selectedTradeId = found.id;
            break;
          }
        }
      } else if (p?.tradeCategory?.label) {
        const foundCat = tradeCategories.find((c) => c.label === p.tradeCategory?.label);
        if (foundCat) selectedCategoryId = foundCat.id;
      }
      setFormData({
        trades: currentTrades,
        newTrade: '',
        selectedCategoryId,
        selectedTradeId,
      });
    } else if (section === 'areas') {
      setFormData({
        address: p?.address || {},
      });
    }

    setEditingSection(section);
  };

  const cancelEditing = () => {
    setEditingSection(null);
    setFormData({});
  };

  const saveSection = async () => {
    if (!profile) return;
    setSaving(true);
    setError(null);

    try {
      const updateData: Record<string, unknown> = {};

      if (editingSection === 'company') {
        if (formData.companyName) updateData.companyName = formData.companyName;
        if (formData.website !== undefined) updateData.website = formData.website;
        if (formData.yearsInBusiness !== '')
          updateData.yearsInBusiness = Number(formData.yearsInBusiness);
      } else if (editingSection === 'contact') {
        if (formData.firstName) updateData.firstName = formData.firstName;
        if (formData.lastName) updateData.lastName = formData.lastName;
        if (formData.phone) updateData.phone = formData.phone;
        if (formData.email) updateData.email = formData.email;
      } else if (editingSection === 'license') {
        if (formData.licenseNumber !== undefined)
          updateData.licenseNumber = formData.licenseNumber;
      } else if (editingSection === 'trades') {
        updateData.trades = formData.trades;
        if (formData.selectedTradeId) updateData.tradeNameId = formData.selectedTradeId;
        if (formData.selectedCategoryId) updateData.tradeCategoryId = formData.selectedCategoryId;
      } else if (editingSection === 'areas') {
        updateData.address = formData.address;
      }

      const updated = await providers.updateMe(updateData);
      setProfile(updated);
      setEditingSection(null);
      setFormData({});
    } catch (err: any) {
      setError(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const updateFormField = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const addTrade = () => {
    const newTrade = (formData.newTrade as string || '').trim();
    if (!newTrade) return;
    const trades = [...(formData.trades as string[] || []), newTrade];
    setFormData((prev) => ({ ...prev, trades, newTrade: '' }));
  };

  const removeTrade = (index: number) => {
    const trades = [...(formData.trades as string[] || [])];
    trades.splice(index, 1);
    setFormData((prev) => ({ ...prev, trades }));
  };

  const providerTypeLabel = (type: string | null) => {
    switch (type) {
      case 'PROFESSIONAL':
        return 'Professional';
      case 'SUPPLIER':
        return 'Supplier';
      case 'FREIGHT':
        return 'Freight';
      default:
        return 'Provider';
    }
  };

  const SectionHeader = ({
    title,
    icon: Icon,
    section,
  }: {
    title: string;
    icon: LucideIcon;
    section: EditingSection;
  }) => (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon size={20} className="text-amber-600" />
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>
      {editingSection === section ? (
        <div className="flex items-center gap-2">
          <button
            onClick={cancelEditing}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <X size={14} />
            Cancel
          </button>
          <button
            onClick={saveSection}
            disabled={saving}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save
          </button>
        </div>
      ) : (
        <button
          onClick={() => startEditing(section)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-amber-600 hover:text-amber-700 border border-amber-200 hover:border-amber-300 rounded-lg transition-colors"
        >
          <Pencil size={14} />
          Edit
        </button>
      )}
    </div>
  );

  const FieldDisplay = ({
    label,
    value,
    icon: Icon,
  }: {
    label: string;
    value: string | number | null | undefined;
    icon?: LucideIcon;
  }) => (
    <div className="space-y-1">
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <div className="flex items-center gap-2">
        {Icon && <Icon size={14} className="text-gray-400" />}
        <p className="text-sm text-gray-800">{value || '---'}</p>
      </div>
    </div>
  );

  const InputField = ({
    label,
    field,
    type = 'text',
    placeholder,
  }: {
    label: string;
    field: string;
    type?: string;
    placeholder?: string;
  }) => (
    <div className="space-y-1">
      <label className="text-xs text-gray-500 uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={(formData[field] as string) || ''}
        onChange={(e) => updateFormField(field, type === 'number' ? e.target.value : e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-500 transition-colors"
      />
    </div>
  );

  // --- Loading state ---

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <Loader2 className="animate-spin text-amber-600" size={32} />
      </div>
    );
  }

  // --- Error state ---

  if (error && !profile) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 gap-4">
        <AlertCircle className="text-red-500" size={48} />
        <p className="text-gray-600 text-center">{error}</p>
        <button
          onClick={() => { setLoading(true); fetchProfile(); }}
          className="px-4 py-2 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!profile) return null;

  const p = profile.profile;
  const isOwner = profile.role === 'OWNER';
  const address = p?.address as Record<string, string> | null;
  const trades = p?.styleOfWork || p?.materialTypes || p?.serviceTypes || [];

  // --- OWNER simple profile ---

  if (isOwner) {
    return (
      <div className="p-8 max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
            <p className="text-gray-500 mt-1">Manage your account information</p>
          </div>
          <span className="px-3 py-1 bg-amber-50 text-amber-700 text-sm font-medium rounded-full border border-amber-200">
            Owner
          </span>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Contact Info */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <SectionHeader title="Contact Information" icon={User} section="contact" />
          {editingSection === 'contact' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="First Name" field="firstName" placeholder="First name" />
              <InputField label="Last Name" field="lastName" placeholder="Last name" />
              <InputField label="Phone" field="phone" placeholder="(555) 123-4567" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldDisplay label="Name" value={profile.name} icon={User} />
              <FieldDisplay label="Email" value={profile.email} icon={Mail} />
              <FieldDisplay label="Phone" value={profile.phone} icon={Phone} />
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- PROVIDER full profile ---

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Company Profile</h1>
          <p className="text-gray-500 mt-1">Manage your business information and services</p>
        </div>
        <span className="px-3 py-1 bg-amber-50 text-amber-700 text-sm font-medium rounded-full border border-amber-200">
          {providerTypeLabel(profile.providerType)}
        </span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Company Information */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <SectionHeader title="Company Information" icon={Building2} section="company" />
        {editingSection === 'company' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="Company Name" field="companyName" placeholder="Acme Construction" />
            <InputField label="Website" field="website" placeholder="https://example.com" />
            <InputField
              label="Years in Business"
              field="yearsInBusiness"
              type="number"
              placeholder="10"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FieldDisplay label="Company Name" value={p?.companyName} icon={Building2} />
            <FieldDisplay label="Website" value={p?.website} icon={Globe} />
            <FieldDisplay
              label="Years in Business"
              value={p?.yearsInBusiness != null ? `${p.yearsInBusiness} years` : null}
              icon={Clock}
            />
          </div>
        )}
      </div>

      {/* Contact Person */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <SectionHeader title="Contact Person" icon={User} section="contact" />
        {editingSection === 'contact' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="First Name" field="firstName" placeholder="John" />
            <InputField label="Last Name" field="lastName" placeholder="Doe" />
            <InputField label="Phone" field="phone" placeholder="(555) 123-4567" />
            <InputField label="Email" field="email" placeholder="john@example.com" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldDisplay
              label="Name"
              value={p ? `${p.firstName} ${p.lastName}` : null}
              icon={User}
            />
            <FieldDisplay label="Email" value={p?.email} icon={Mail} />
            <FieldDisplay label="Phone" value={p?.phone} icon={Phone} />
            <FieldDisplay label="Secondary Phone" value={p?.phone2} icon={Phone} />
          </div>
        )}
      </div>

      {/* License & Insurance */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <SectionHeader title="License & Insurance" icon={Shield} section="license" />
        {editingSection === 'license' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="License Number" field="licenseNumber" placeholder="LIC-12345" />
            <FieldDisplay label="License Status" value={p?.licenseStatus} />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldDisplay label="License Number" value={p?.licenseNumber} icon={Shield} />
            <div className="space-y-1">
              <p className="text-xs text-gray-500 uppercase tracking-wider">License Status</p>
              <span
                className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                  p?.licenseStatus === 'ACTIVE'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : p?.licenseStatus === 'EXPIRED'
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-gray-100 text-gray-500 border border-gray-200'
                }`}
              >
                {p?.licenseStatus || 'N/A'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Trades & Services */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <SectionHeader title="Trades & Services" icon={Wrench} section="trades" />
        {editingSection === 'trades' ? (
          <div className="space-y-5">
            {/* Trade Category Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs text-gray-500 uppercase tracking-wider">Trade Category</label>
              <select
                value={(formData.selectedCategoryId as string) || ''}
                onChange={(e) => {
                  updateFormField('selectedCategoryId', e.target.value);
                  updateFormField('selectedTradeId', ''); // reset trade when category changes
                }}
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-amber-500 transition-colors appearance-none"
              >
                <option value="">Select a category...</option>
                {tradeCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>
            </div>

            {/* Trade Name Dropdown — filtered by selected category */}
            <div className="space-y-1.5">
              <label className="text-xs text-gray-500 uppercase tracking-wider">Trade / Specialty</label>
              <select
                value={(formData.selectedTradeId as string) || ''}
                onChange={(e) => updateFormField('selectedTradeId', e.target.value)}
                disabled={!(formData.selectedCategoryId as string)}
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-amber-500 transition-colors appearance-none disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">Select a trade...</option>
                {tradeCategories
                  .find((c) => c.id === (formData.selectedCategoryId as string))
                  ?.trades.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
              </select>
            </div>

            {/* Style of Work / Services tags */}
            <div className="space-y-2">
              <label className="text-xs text-gray-500 uppercase tracking-wider">
                Services Offered
              </label>
              <div className="flex flex-wrap gap-2">
                {(formData.trades as string[] || []).map((trade, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 text-sm rounded-full border border-amber-200"
                  >
                    {trade}
                    <button
                      onClick={() => removeTrade(i)}
                      className="text-amber-400 hover:text-amber-700 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={(formData.newTrade as string) || ''}
                  onChange={(e) => updateFormField('newTrade', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTrade();
                    }
                  }}
                  placeholder="Add a service (e.g., residential, commercial)..."
                  className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-500 transition-colors"
                />
                <button
                  onClick={addTrade}
                  className="px-4 py-2 bg-amber-50 text-amber-700 text-sm font-medium rounded-lg border border-amber-200 hover:bg-amber-100 transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Trade Category & Name display */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldDisplay
                label="Trade Category"
                value={p?.tradeCategory?.label}
                icon={Award}
              />
              <FieldDisplay
                label="Trade / Specialty"
                value={p?.tradeName?.name}
                icon={Wrench}
              />
            </div>

            {/* Services */}
            {trades.length > 0 && (
              <div className="pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Services Offered</p>
                <div className="flex flex-wrap gap-2">
                  {trades.map((trade, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 bg-amber-50 text-amber-700 text-sm rounded-full border border-amber-200 capitalize"
                    >
                      {trade}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {trades.length === 0 && !p?.tradeCategory && !p?.tradeName && (
              <p className="text-sm text-gray-400 italic">No trades or services listed</p>
            )}
          </div>
        )}
      </div>

      {/* Service Areas */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <SectionHeader title="Service Areas" icon={MapPin} section="areas" />
        {editingSection === 'areas' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-gray-500 uppercase tracking-wider">Street</label>
              <input
                type="text"
                value={(formData.address as Record<string, string>)?.street || ''}
                onChange={(e) =>
                  updateFormField('address', {
                    ...(formData.address as Record<string, string>),
                    street: e.target.value,
                  })
                }
                placeholder="123 Main St"
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500 uppercase tracking-wider">City</label>
              <input
                type="text"
                value={(formData.address as Record<string, string>)?.city || ''}
                onChange={(e) =>
                  updateFormField('address', {
                    ...(formData.address as Record<string, string>),
                    city: e.target.value,
                  })
                }
                placeholder="Austin"
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500 uppercase tracking-wider">State</label>
              <input
                type="text"
                value={(formData.address as Record<string, string>)?.state || ''}
                onChange={(e) =>
                  updateFormField('address', {
                    ...(formData.address as Record<string, string>),
                    state: e.target.value,
                  })
                }
                placeholder="TX"
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500 uppercase tracking-wider">Zip Code</label>
              <input
                type="text"
                value={(formData.address as Record<string, string>)?.zipCode || ''}
                onChange={(e) =>
                  updateFormField('address', {
                    ...(formData.address as Record<string, string>),
                    zipCode: e.target.value,
                  })
                }
                placeholder="78701"
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldDisplay label="Street" value={address?.street} icon={MapPin} />
            <FieldDisplay label="City" value={address?.city} />
            <FieldDisplay label="State" value={address?.state} />
            <FieldDisplay label="Zip Code" value={address?.zipCode} />
          </div>
        )}
      </div>
    </div>
  );
}
