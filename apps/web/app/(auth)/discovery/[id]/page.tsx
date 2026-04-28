'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe,
  Shield,
  BadgeCheck,
  Clock,
  Award,
  Wrench,
  Star,
  FileText,
  MessageSquare,
  Loader2,
  AlertTriangle,
  Calendar,
  User,
} from 'lucide-react';
import { discovery, ApiVendorDetail } from '../../../../lib/api';
import { getTradeImageLarge } from '../../../../lib/trade-images';

function tradeToSlug(trade: string): string {
  return trade
    .toLowerCase()
    .replace(/\s+&\s+/g, '-')
    .replace(/\s+/g, '-');
}

export default function VendorDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params.id as string;
  const type = searchParams.get('type') || 'professional';

  const [vendor, setVendor] = useState<ApiVendorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await discovery.getVendor(id, type);
        setVendor(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load vendor');
      } finally {
        setLoading(false);
      }
    }
    if (id) load();
  }, [id, type]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  if (error || !vendor) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center">
        <AlertTriangle className="text-red-400 mx-auto mb-4" size={40} />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Professional Not Found</h2>
        <p className="text-gray-500 mb-6">{error || 'This profile may have been removed.'}</p>
        <button
          onClick={() => router.push('/discovery')}
          className="inline-flex items-center gap-2 text-amber-600 hover:text-amber-700 font-medium"
        >
          <ArrowLeft size={16} />
          Back to Discovery
        </button>
      </div>
    );
  }

  const displayName = vendor.companyName || `${vendor.firstName} ${vendor.lastName}`;
  const contactName = vendor.firstName && vendor.lastName ? `${vendor.firstName} ${vendor.lastName}` : null;
  const tradeSlug = vendor.tradeName?.slug || (vendor.styleOfWork.length > 0 ? tradeToSlug(vendor.styleOfWork[0]) : 'default');
  const heroImage = getTradeImageLarge(tradeSlug);
  const isVerified = vendor.licenseStatus === 'ACTIVE';
  const address = vendor.address;
  const addressStr = address
    ? [address.street, address.city, address.state, address.zipCode].filter(Boolean).join(', ')
    : null;

  const providerTypeLabel =
    vendor.providerType === 'professional'
      ? 'Professional'
      : vendor.providerType === 'supplier'
        ? 'Supplier'
        : vendor.providerType === 'freight'
          ? 'Freight & Logistics'
          : 'Provider';

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => router.push('/discovery')}
        className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6 text-sm font-medium transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Discovery
      </button>

      {/* Hero Image */}
      <div className="relative h-56 md:h-72 rounded-2xl overflow-hidden mb-6">
        <img
          src={heroImage}
          alt={displayName}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="flex items-end justify-between">
            <div>
              <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-sm text-white text-xs font-medium rounded-full mb-2">
                {providerTypeLabel}
              </span>
              <h1 className="text-2xl md:text-3xl font-bold text-white">{displayName}</h1>
              {vendor.tradeName && (
                <p className="text-white/80 mt-1">{vendor.tradeName.name}</p>
              )}
            </div>
            {isVerified && (
              <div className="flex items-center gap-1.5 bg-green-500/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-sm font-medium">
                <BadgeCheck size={16} />
                Verified
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* About */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 size={18} className="text-amber-500" />
              About
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {vendor.yearsInBusiness != null && (
                <div className="flex items-start gap-3">
                  <Clock size={16} className="text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Years in Business</p>
                    <p className="text-sm font-medium text-gray-900">{vendor.yearsInBusiness} years</p>
                  </div>
                </div>
              )}
              {vendor.yearsInProfession != null && (
                <div className="flex items-start gap-3">
                  <Award size={16} className="text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Years in Profession</p>
                    <p className="text-sm font-medium text-gray-900">{vendor.yearsInProfession} years</p>
                  </div>
                </div>
              )}
              {vendor.tradeCategory && (
                <div className="flex items-start gap-3">
                  <Wrench size={16} className="text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Category</p>
                    <p className="text-sm font-medium text-gray-900">{vendor.tradeCategory.label}</p>
                  </div>
                </div>
              )}
              {vendor.memberSince && (
                <div className="flex items-start gap-3">
                  <Calendar size={16} className="text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Member Since</p>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(vendor.memberSince).toLocaleDateString('en-US', {
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Specialties / Services */}
          {vendor.styleOfWork.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Wrench size={18} className="text-amber-500" />
                {vendor.providerType === 'supplier' ? 'Materials & Products' : 'Specialties & Services'}
              </h2>
              <div className="flex flex-wrap gap-2">
                {vendor.styleOfWork.map((item, i) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 bg-amber-50 text-amber-700 text-sm rounded-full border border-amber-200 capitalize"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* License & Insurance */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Shield size={18} className="text-amber-500" />
              License & Insurance
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">License Status</p>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                    vendor.licenseStatus === 'ACTIVE'
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : vendor.licenseStatus === 'EXPIRED'
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : vendor.licenseStatus === 'PENDING'
                          ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                          : 'bg-gray-100 text-gray-500 border border-gray-200'
                  }`}
                >
                  {vendor.licenseStatus === 'ACTIVE' && <BadgeCheck size={12} />}
                  {vendor.licenseStatus || 'N/A'}
                </span>
              </div>
              {vendor.licenseNumber && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">License Number</p>
                  <p className="text-sm font-medium text-gray-900">{vendor.licenseNumber}</p>
                </div>
              )}
            </div>
          </div>

          {/* Awards */}
          {vendor.awards.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Award size={18} className="text-amber-500" />
                Awards & Certifications
              </h2>
              <div className="flex flex-wrap gap-2">
                {vendor.awards.map((award, i) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 bg-purple-50 text-purple-700 text-sm rounded-full border border-purple-200"
                  >
                    {award}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contact Card */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User size={18} className="text-amber-500" />
              Contact
            </h2>
            <div className="space-y-3">
              {contactName && (
                <div className="flex items-center gap-3">
                  <User size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-700">{contactName}</span>
                </div>
              )}
              {vendor.phone && (
                <div className="flex items-center gap-3">
                  <Phone size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-700">{vendor.phone}</span>
                </div>
              )}
              {vendor.email && (
                <div className="flex items-center gap-3">
                  <Mail size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-700 break-all">{vendor.email}</span>
                </div>
              )}
              {vendor.website && (
                <div className="flex items-center gap-3">
                  <Globe size={16} className="text-gray-400" />
                  <a
                    href={vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-amber-600 hover:text-amber-700 underline break-all"
                  >
                    {vendor.website}
                  </a>
                </div>
              )}
              {addressStr && (
                <div className="flex items-start gap-3">
                  <MapPin size={16} className="text-gray-400 mt-0.5" />
                  <span className="text-sm text-gray-700">{addressStr}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-6 space-y-3">
              <button
                onClick={() => alert('Messaging coming in Phase 2!')}
                className="w-full flex items-center justify-center gap-2 bg-amber-500 text-white font-semibold py-3 rounded-xl hover:bg-amber-600 transition-colors text-sm"
              >
                <MessageSquare size={16} />
                Send Message
              </button>
              <button
                onClick={() => alert('Quote requests coming in Phase 2!')}
                className="w-full flex items-center justify-center gap-2 border border-amber-500 text-amber-600 font-semibold py-3 rounded-xl hover:bg-amber-50 transition-colors text-sm"
              >
                <FileText size={16} />
                Request Quote
              </button>
            </div>
          </div>

          {/* Reviews placeholder */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Star size={18} className="text-amber-500" />
              Reviews
            </h2>
            <div className="text-center py-6">
              <Star size={32} className="text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No reviews yet</p>
              <p className="text-xs text-gray-400 mt-1">Reviews will be available in Phase 2</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
