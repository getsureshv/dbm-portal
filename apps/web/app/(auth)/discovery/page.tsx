'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Star, MapPin, Filter, X, Loader2 } from 'lucide-react';
import { discovery, ApiVendor } from '../../../lib/api';

const PROVIDER_TYPES = [
  { label: 'All Types', value: '' },
  { label: 'Professional', value: 'professional' },
  { label: 'Supplier', value: 'supplier' },
  { label: 'Freight', value: 'freight' },
];

const TRADES = [
  'All Trades',
  'General Contractor',
  'Electrician',
  'Plumber',
  'HVAC',
  'Roofer',
  'Painter',
  'Flooring Contractor',
  'Concrete',
];

export default function DiscoveryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedTrade, setSelectedTrade] = useState('All Trades');
  const [zipCode, setZipCode] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [vendors, setVendors] = useState<ApiVendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [total, setTotal] = useState(0);

  const performSearch = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (selectedType) params.type = selectedType;
      if (selectedTrade !== 'All Trades') params.category = selectedTrade.toLowerCase().replace(/\s+/g, '-');
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
  }, [selectedType, selectedTrade, zipCode, searchQuery]);

  // Initial load
  useEffect(() => {
    performSearch();
  }, [performSearch]);

  const clearFilters = () => {
    setSelectedType('');
    setSelectedTrade('All Trades');
    setZipCode('');
    setSearchQuery('');
  };

  const hasActiveFilters = selectedType !== '' || selectedTrade !== 'All Trades' || zipCode !== '';

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Find Providers</h1>
        <p className="text-white/60">Discover and connect with trusted construction professionals</p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-3 text-white/40" size={20} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && performSearch()}
          placeholder="Search by name or trade..."
          className="w-full bg-white/5 border border-white/10 rounded-lg pl-12 pr-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-gold/50 transition-colors"
        />
      </div>

      {/* Filter and Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Filters - Desktop */}
        <div className="hidden lg:block lg:col-span-1">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6 sticky top-8">
            <h2 className="text-lg font-bold text-white">Filters</h2>

            {/* Provider Type */}
            <div>
              <h3 className="font-semibold text-white mb-3 text-sm">Provider Type</h3>
              <div className="space-y-2">
                {PROVIDER_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setSelectedType(type.value)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${
                      selectedType === type.value
                        ? 'bg-gold/20 text-gold border border-gold/30'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Trade Category */}
            <div>
              <h3 className="font-semibold text-white mb-3 text-sm">Trade</h3>
              <div className="space-y-2">
                {TRADES.map((trade) => (
                  <button
                    key={trade}
                    onClick={() => setSelectedTrade(trade)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${
                      selectedTrade === trade
                        ? 'bg-gold/20 text-gold border border-gold/30'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {trade}
                  </button>
                ))}
              </div>
            </div>

            {/* Zip Code */}
            <div>
              <h3 className="font-semibold text-white mb-3 text-sm">Zip Code</h3>
              <input
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="e.g. 75019"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/40 focus:outline-none focus:border-gold/50"
              />
            </div>

            {/* Search Button */}
            <button
              onClick={performSearch}
              disabled={loading}
              className="w-full bg-gold text-navy font-semibold py-2 rounded-lg hover:bg-gold/90 disabled:opacity-50 transition-colors text-sm"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="w-full text-center px-3 py-2 border border-white/20 text-white/70 rounded-lg hover:text-white transition-colors text-sm"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Mobile Filter Button */}
        <div className="lg:hidden mb-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="w-full flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-white px-4 py-2.5 rounded-lg hover:border-white/20 transition-colors"
          >
            <Filter size={18} />
            Filters
          </button>
        </div>

        {/* Mobile Filters Modal */}
        {showFilters && (
          <div className="lg:hidden col-span-1 bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6 mb-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Filters</h2>
              <button onClick={() => setShowFilters(false)} className="text-white/60 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-3 text-sm">Provider Type</h3>
              <div className="space-y-2">
                {PROVIDER_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setSelectedType(type.value)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${
                      selectedType === type.value
                        ? 'bg-gold/20 text-gold border border-gold/30'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-3 text-sm">Zip Code</h3>
              <input
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="e.g. 75019"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/40 focus:outline-none focus:border-gold/50"
              />
            </div>

            <button
              onClick={() => { performSearch(); setShowFilters(false); }}
              disabled={loading}
              className="w-full bg-gold text-navy font-semibold py-2 rounded-lg hover:bg-gold/90 disabled:opacity-50 transition-colors text-sm"
            >
              Search
            </button>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="w-full text-center px-3 py-2 border border-white/20 text-white/70 rounded-lg hover:text-white transition-colors text-sm"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

        {/* Provider Grid */}
        <div className="lg:col-span-3">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-gold" size={32} />
            </div>
          ) : (
            <>
              {searched && (
                <p className="text-white/40 text-sm mb-4">{total} provider{total !== 1 ? 's' : ''} found</p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {vendors.map((vendor) => (
                  <div
                    key={vendor.id}
                    className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-gold/30 hover:bg-gold/5 transition-all group"
                  >
                    {/* Image Placeholder */}
                    <div className="h-40 bg-gradient-to-br from-gold/20 to-white/5 rounded-lg mb-4 flex items-center justify-center border border-white/10">
                      <span className="text-white/40 text-sm font-medium capitalize">{vendor.providerType}</span>
                    </div>

                    {/* Provider Info */}
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-white group-hover:text-gold transition-colors">
                            {vendor.name}
                          </h3>
                          {vendor.licenseStatus === 'ACTIVE' && (
                            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full border border-green-500/30">
                              Licensed
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-white/60">
                          {vendor.trades.length > 0 ? vendor.trades.join(', ') : vendor.providerType}
                        </p>
                      </div>

                      {/* Rating */}
                      {vendor.rating !== null && (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                size={14}
                                className={
                                  i < Math.floor(vendor.rating!)
                                    ? 'text-gold fill-gold'
                                    : 'text-white/20'
                                }
                              />
                            ))}
                          </div>
                          <span className="text-sm font-medium text-white">{vendor.rating}</span>
                          <span className="text-xs text-white/60">({vendor.reviewCount})</span>
                        </div>
                      )}

                      {/* Location */}
                      {vendor.location && (
                        <div className="flex items-center gap-2 text-white/60">
                          <MapPin size={14} />
                          <span className="text-sm">{vendor.location.zip}</span>
                        </div>
                      )}

                      {/* Years */}
                      {vendor.yearsInBusiness !== null && (
                        <p className="text-xs text-white/40">
                          {vendor.yearsInBusiness} years in business
                        </p>
                      )}

                      {/* Action Button */}
                      <button className="w-full bg-gold text-navy font-semibold py-2 rounded-lg hover:bg-gold/90 transition-colors">
                        View Profile
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {vendors.length === 0 && searched && (
                <div className="text-center py-12">
                  <p className="text-white/60 text-lg">No providers found</p>
                  <p className="text-white/40 text-sm mt-2">Try adjusting your filters</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
