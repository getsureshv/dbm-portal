'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Star,
  MapPin,
  Shield,
  MessageSquare,
  FileText,
  BadgeCheck,
  Clock,
  Filter,
  X,
  Loader2,
  SlidersHorizontal,
  ChevronDown,
} from 'lucide-react';
import { discovery, ApiVendor } from '../../../lib/api';

const PROVIDER_TYPES = [
  { label: 'All', value: '' },
  { label: 'Professional', value: 'professional' },
  { label: 'Supplier', value: 'supplier' },
  { label: 'Freight', value: 'freight' },
];

const CATEGORY_PILLS = [
  'All',
  'General Contractors',
  'Kitchen & Bath',
  'Electricians',
  'Plumbers',
  'HVAC',
  'Roofers',
  'Painters',
  'Flooring',
  'Landscaping',
];

const LICENSE_OPTIONS = [
  { label: 'Any', value: '' },
  { label: 'Verified', value: 'ACTIVE' },
  { label: 'Pending', value: 'PENDING' },
];

const YEARS_OPTIONS = [
  { label: 'Any', value: 0 },
  { label: '5+ years', value: 5 },
  { label: '10+ years', value: 10 },
  { label: '15+ years', value: 15 },
];

// Generate gradient colors from vendor name for the portfolio placeholder
function nameToGradient(name: string): string {
  const gradients = [
    'from-blue-600/40 to-indigo-800/40',
    'from-emerald-600/40 to-teal-800/40',
    'from-amber-600/40 to-orange-800/40',
    'from-rose-600/40 to-pink-800/40',
    'from-violet-600/40 to-purple-800/40',
    'from-cyan-600/40 to-sky-800/40',
    'from-lime-600/40 to-green-800/40',
    'from-fuchsia-600/40 to-pink-800/40',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return gradients[Math.abs(hash) % gradients.length];
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

// Star rating component
function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[...Array(5)].map((_, i) => {
        const filled = i < Math.floor(rating);
        const half = !filled && i < rating;
        return (
          <Star
            key={i}
            size={size}
            className={
              filled
                ? 'text-gold fill-gold'
                : half
                  ? 'text-gold fill-gold/50'
                  : 'text-white/20'
            }
          />
        );
      })}
    </div>
  );
}

// Provider listing card (horizontal row like Houzz)
function ProviderCard({ vendor }: { vendor: ApiVendor }) {
  const gradient = nameToGradient(vendor.name);
  const initials = getInitials(vendor.name);
  const isVerified = vendor.licenseStatus === 'ACTIVE';

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl hover:border-gold/30 hover:bg-white/[0.07] transition-all duration-200 group">
      <div className="flex flex-col sm:flex-row">
        {/* Left: Portfolio image placeholder */}
        <div className="sm:w-48 md:w-56 lg:w-64 flex-shrink-0">
          <div
            className={`h-44 sm:h-full bg-gradient-to-br ${gradient} rounded-t-2xl sm:rounded-l-2xl sm:rounded-tr-none flex items-center justify-center relative overflow-hidden`}
          >
            <span className="text-3xl font-bold text-white/60 select-none">
              {initials}
            </span>
            {/* Subtle overlay pattern */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_70%,rgba(255,255,255,0.05)_0%,transparent_60%)]" />
          </div>
        </div>

        {/* Center + Right container */}
        <div className="flex-1 flex flex-col md:flex-row p-5 gap-4">
          {/* Center: Provider details */}
          <div className="flex-1 min-w-0 space-y-2.5">
            {/* Company name */}
            <h3 className="text-lg font-semibold text-white group-hover:text-gold transition-colors truncate">
              {vendor.name}
            </h3>

            {/* Rating row */}
            {vendor.rating !== null && (
              <div className="flex items-center gap-2 flex-wrap">
                <StarRating rating={vendor.rating} />
                <span className="text-sm font-semibold text-white">
                  {vendor.rating.toFixed(1)}
                </span>
                <span className="text-sm text-white/50">
                  &middot; {vendor.reviewCount} Review{vendor.reviewCount !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {/* Verified badge */}
            {isVerified && (
              <div className="flex items-center gap-1.5">
                <BadgeCheck size={16} className="text-emerald-400" />
                <span className="text-sm text-emerald-400 font-medium">
                  Verified License
                </span>
              </div>
            )}

            {/* Specialty / Trades */}
            {vendor.trades.length > 0 && (
              <p className="text-sm text-white/60 leading-relaxed">
                <span className="text-white/40">Specialty:</span>{' '}
                {vendor.trades.join(', ')}
              </p>
            )}

            {/* Location */}
            {vendor.location && (
              <div className="flex items-center gap-1.5 text-white/50">
                <MapPin size={14} className="flex-shrink-0" />
                <span className="text-sm">{vendor.location.zip}</span>
              </div>
            )}

            {/* Years in business */}
            {vendor.yearsInBusiness !== null && (
              <div className="flex items-center gap-1.5 text-white/50">
                <Clock size={14} className="flex-shrink-0" />
                <span className="text-sm">
                  {vendor.yearsInBusiness} year{vendor.yearsInBusiness !== 1 ? 's' : ''} in business
                </span>
              </div>
            )}
          </div>

          {/* Right: Action buttons */}
          <div className="flex flex-row md:flex-col gap-2 md:justify-center md:items-end flex-shrink-0 md:w-40">
            <button className="flex-1 md:w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gold/40 text-gold rounded-xl hover:bg-gold/10 transition-colors text-sm font-medium">
              <MessageSquare size={15} />
              <span>Send Message</span>
            </button>
            <button className="flex-1 md:w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gold/40 text-gold rounded-xl hover:bg-gold/10 transition-colors text-sm font-medium">
              <FileText size={15} />
              <span>Request Quote</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DiscoveryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [zipCode, setZipCode] = useState('');
  const [licenseFilter, setLicenseFilter] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [minYears, setMinYears] = useState(0);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [vendors, setVendors] = useState<ApiVendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [total, setTotal] = useState(0);

  const performSearch = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (selectedType) params.type = selectedType;
      if (selectedCategory !== 'All')
        params.category = selectedCategory.toLowerCase().replace(/\s+&\s+/g, '-').replace(/\s+/g, '-');
      if (zipCode) params.zip = zipCode;
      if (searchQuery) params.query = searchQuery;

      // Default to professional if no type set
      if (!params.type) params.type = 'professional';

      const result = await discovery.search(params);
      setVendors(result.vendors);
      setTotal(result.total);
      setSearched(true);
    } catch {
      setVendors([]);
      setTotal(0);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, [selectedType, selectedCategory, zipCode, searchQuery]);

  // Initial load
  useEffect(() => {
    performSearch();
  }, [performSearch]);

  const clearFilters = () => {
    setSelectedType('');
    setSelectedCategory('All');
    setZipCode('');
    setSearchQuery('');
    setLicenseFilter('');
    setMinRating(0);
    setMinYears(0);
  };

  const hasActiveFilters =
    selectedType !== '' ||
    selectedCategory !== 'All' ||
    zipCode !== '' ||
    licenseFilter !== '' ||
    minRating > 0 ||
    minYears > 0;

  // Client-side filtering for license, rating, years (API may not support all)
  const filteredVendors = vendors.filter((v) => {
    if (licenseFilter && v.licenseStatus !== licenseFilter) return false;
    if (minRating > 0 && (v.rating === null || v.rating < minRating)) return false;
    if (minYears > 0 && (v.yearsInBusiness === null || v.yearsInBusiness < minYears))
      return false;
    return true;
  });

  return (
    <div className="min-h-screen">
      {/* Hero header */}
      <div className="px-6 md:px-8 pt-8 pb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-1">
          Home Improvement Pros Near You
        </h1>
        <p className="text-white/50 text-base">
          Browse top-rated professionals, read reviews, and request quotes
        </p>
      </div>

      {/* Search bar row */}
      <div className="px-6 md:px-8 pb-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && performSearch()}
              placeholder="Search by name, trade, or keyword..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-all text-sm"
            />
          </div>
          <div className="relative w-full sm:w-40">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
            <input
              type="text"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && performSearch()}
              placeholder="Zip Code"
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-all text-sm"
            />
          </div>
          <button
            onClick={performSearch}
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-gold text-navy font-semibold px-6 py-3 rounded-xl hover:bg-gold-dark disabled:opacity-50 transition-colors text-sm"
          >
            <Search size={16} />
            Search
          </button>
        </div>
      </div>

      {/* Category pills */}
      <div className="px-6 md:px-8 pb-5">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {CATEGORY_PILLS.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-gold text-navy'
                  : 'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main content: filter sidebar + results */}
      <div className="px-6 md:px-8 pb-8">
        <div className="flex gap-8">
          {/* Filter sidebar - desktop */}
          <div className="hidden lg:block w-64 flex-shrink-0">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-6 sticky top-8">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <SlidersHorizontal size={16} />
                  Filters
                </h2>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-xs text-gold hover:text-gold-dark transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Provider Type */}
              <div>
                <h3 className="font-medium text-white/80 mb-2.5 text-sm">Provider Type</h3>
                <div className="space-y-1">
                  {PROVIDER_TYPES.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setSelectedType(type.value)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${
                        selectedType === type.value
                          ? 'bg-gold/15 text-gold border border-gold/30'
                          : 'text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* License Status */}
              <div>
                <h3 className="font-medium text-white/80 mb-2.5 text-sm">License Status</h3>
                <div className="space-y-1">
                  {LICENSE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setLicenseFilter(opt.value)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${
                        licenseFilter === opt.value
                          ? 'bg-gold/15 text-gold border border-gold/30'
                          : 'text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Min Rating */}
              <div>
                <h3 className="font-medium text-white/80 mb-2.5 text-sm">Minimum Rating</h3>
                <div className="space-y-1">
                  {[0, 3, 3.5, 4, 4.5].map((r) => (
                    <button
                      key={r}
                      onClick={() => setMinRating(r)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm flex items-center gap-2 ${
                        minRating === r
                          ? 'bg-gold/15 text-gold border border-gold/30'
                          : 'text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {r === 0 ? (
                        'Any'
                      ) : (
                        <>
                          <StarRating rating={r} size={12} />
                          <span>{r}+</span>
                        </>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Years Experience */}
              <div>
                <h3 className="font-medium text-white/80 mb-2.5 text-sm">Years Experience</h3>
                <div className="space-y-1">
                  {YEARS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setMinYears(opt.value)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${
                        minYears === opt.value
                          ? 'bg-gold/15 text-gold border border-gold/30'
                          : 'text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search button */}
              <button
                onClick={performSearch}
                disabled={loading}
                className="w-full bg-gold text-navy font-semibold py-2.5 rounded-xl hover:bg-gold-dark disabled:opacity-50 transition-colors text-sm"
              >
                {loading ? 'Searching...' : 'Apply Filters'}
              </button>
            </div>
          </div>

          {/* Mobile filter toggle */}
          <div className="lg:hidden fixed bottom-6 right-6 z-50">
            <button
              onClick={() => setShowMobileFilters(true)}
              className="flex items-center gap-2 bg-gold text-navy font-semibold px-5 py-3 rounded-full shadow-lg shadow-gold/20 hover:bg-gold-dark transition-colors"
            >
              <Filter size={18} />
              Filters
              {hasActiveFilters && (
                <span className="bg-navy text-gold text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  !
                </span>
              )}
            </button>
          </div>

          {/* Mobile filters drawer */}
          {showMobileFilters && (
            <div className="lg:hidden fixed inset-0 z-50 flex">
              {/* Backdrop */}
              <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setShowMobileFilters(false)}
              />
              {/* Drawer */}
              <div className="relative ml-auto w-full max-w-sm bg-navy border-l border-white/10 h-full overflow-y-auto p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <SlidersHorizontal size={18} />
                    Filters
                  </h2>
                  <button
                    onClick={() => setShowMobileFilters(false)}
                    className="text-white/60 hover:text-white p-1"
                  >
                    <X size={22} />
                  </button>
                </div>

                {/* Provider Type */}
                <div>
                  <h3 className="font-medium text-white/80 mb-2.5 text-sm">Provider Type</h3>
                  <div className="space-y-1">
                    {PROVIDER_TYPES.map((type) => (
                      <button
                        key={type.value}
                        onClick={() => setSelectedType(type.value)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${
                          selectedType === type.value
                            ? 'bg-gold/15 text-gold border border-gold/30'
                            : 'text-white/60 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* License Status */}
                <div>
                  <h3 className="font-medium text-white/80 mb-2.5 text-sm">License Status</h3>
                  <div className="space-y-1">
                    {LICENSE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setLicenseFilter(opt.value)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${
                          licenseFilter === opt.value
                            ? 'bg-gold/15 text-gold border border-gold/30'
                            : 'text-white/60 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Min Rating */}
                <div>
                  <h3 className="font-medium text-white/80 mb-2.5 text-sm">Minimum Rating</h3>
                  <div className="space-y-1">
                    {[0, 3, 3.5, 4, 4.5].map((r) => (
                      <button
                        key={r}
                        onClick={() => setMinRating(r)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm flex items-center gap-2 ${
                          minRating === r
                            ? 'bg-gold/15 text-gold border border-gold/30'
                            : 'text-white/60 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {r === 0 ? (
                          'Any'
                        ) : (
                          <>
                            <StarRating rating={r} size={12} />
                            <span>{r}+</span>
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Years Experience */}
                <div>
                  <h3 className="font-medium text-white/80 mb-2.5 text-sm">Years Experience</h3>
                  <div className="space-y-1">
                    {YEARS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setMinYears(opt.value)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${
                          minYears === opt.value
                            ? 'bg-gold/15 text-gold border border-gold/30'
                            : 'text-white/60 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Zip Code */}
                <div>
                  <h3 className="font-medium text-white/80 mb-2.5 text-sm">Zip Code</h3>
                  <input
                    type="text"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    placeholder="e.g. 95128"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/40 focus:outline-none focus:border-gold/50"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      performSearch();
                      setShowMobileFilters(false);
                    }}
                    disabled={loading}
                    className="flex-1 bg-gold text-navy font-semibold py-2.5 rounded-xl hover:bg-gold-dark disabled:opacity-50 transition-colors text-sm"
                  >
                    Apply
                  </button>
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="px-4 py-2.5 border border-white/20 text-white/70 rounded-xl hover:text-white transition-colors text-sm"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Results area */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="animate-spin text-gold" size={36} />
                <p className="text-white/40 text-sm">Finding professionals near you...</p>
              </div>
            ) : (
              <>
                {/* Results count */}
                {searched && (
                  <p className="text-white/50 text-sm mb-5">
                    <span className="text-white font-medium">{filteredVendors.length}</span>{' '}
                    professional{filteredVendors.length !== 1 ? 's' : ''} found
                    {zipCode ? ` near ${zipCode}` : ' near you'}
                  </p>
                )}

                {/* Provider listing cards */}
                <div className="space-y-4">
                  {filteredVendors.map((vendor) => (
                    <ProviderCard key={vendor.id} vendor={vendor} />
                  ))}
                </div>

                {/* Empty state */}
                {filteredVendors.length === 0 && searched && (
                  <div className="text-center py-20">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Search size={28} className="text-white/20" />
                    </div>
                    <p className="text-white/60 text-lg font-medium">No professionals found</p>
                    <p className="text-white/40 text-sm mt-2 max-w-sm mx-auto">
                      Try broadening your search criteria or adjusting the filters to see more results.
                    </p>
                    {hasActiveFilters && (
                      <button
                        onClick={clearFilters}
                        className="mt-4 px-5 py-2 border border-gold/40 text-gold rounded-xl hover:bg-gold/10 transition-colors text-sm font-medium"
                      >
                        Clear all filters
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
