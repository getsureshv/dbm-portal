'use client';

import { Search, SlidersHorizontal, HardHat, MapPin } from 'lucide-react';
import { useState } from 'react';

const TRADE_CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'PLANNING_DESIGN', label: 'Planning & Design' },
  { value: 'CONTRACTORS', label: 'Contractors' },
  { value: 'SUPPLIERS', label: 'Suppliers' },
  { value: 'SERVICES', label: 'Services' },
];

const PROJECT_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'RESIDENTIAL', label: 'Residential' },
  { value: 'COMMERCIAL', label: 'Commercial' },
  { value: 'INDUSTRIAL', label: 'Industrial' },
  { value: 'RENOVATION', label: 'Renovation' },
];

export default function OpportunitiesPage() {
  const [tradeCategory, setTradeCategory] = useState('');
  const [projectType, setProjectType] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [radius, setRadius] = useState(25);

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Available Opportunities</h1>
        <p className="text-white/60">Browse projects posted by owners in your area</p>
      </div>

      {/* Filters Bar */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <SlidersHorizontal className="text-gold" size={20} />
          <h2 className="text-white font-semibold">Filters</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Trade Category */}
          <div>
            <label className="block text-xs text-white/60 mb-1.5">Trade Category</label>
            <select
              value={tradeCategory}
              onChange={(e) => setTradeCategory(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-gold/50 transition-colors appearance-none"
            >
              {TRADE_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value} className="bg-navy text-white">
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Project Type */}
          <div>
            <label className="block text-xs text-white/60 mb-1.5">Project Type</label>
            <select
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-gold/50 transition-colors appearance-none"
            >
              {PROJECT_TYPES.map((type) => (
                <option key={type.value} value={type.value} className="bg-navy text-white">
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Zip Code */}
          <div>
            <label className="block text-xs text-white/60 mb-1.5">Zip Code</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
              <input
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="Enter zip code"
                maxLength={5}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold/50 transition-colors"
              />
            </div>
          </div>

          {/* Radius */}
          <div>
            <label className="block text-xs text-white/60 mb-1.5">Radius: {radius} miles</label>
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full accent-gold mt-1.5"
            />
            <div className="flex justify-between text-xs text-white/40 mt-1">
              <span>5 mi</span>
              <span>100 mi</span>
            </div>
          </div>
        </div>
      </div>

      {/* Empty Results */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="p-4 bg-white/5 rounded-full mb-6">
            <HardHat className="text-gold/60" size={48} />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No opportunities match your filters yet</h3>
          <p className="text-white/60 max-w-md">
            As owners post projects, matching opportunities will appear here.
            Make sure your profile and trade categories are up to date so you get the best matches.
          </p>
        </div>
      </div>
    </div>
  );
}
