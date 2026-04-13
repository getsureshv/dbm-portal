'use client';

import { Search, SlidersHorizontal, HardHat, MapPin, Calendar, FileText, Sparkles, Loader2, ChevronRight } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { opportunities as opportunitiesApi, ApiOpportunity } from '../../../lib/api';

const PROJECT_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'RESIDENTIAL', label: 'Residential' },
  { value: 'COMMERCIAL', label: 'Commercial' },
  { value: 'NEW_BUILD', label: 'New Build' },
];

const TYPE_COLORS: Record<string, string> = {
  RESIDENTIAL: 'bg-blue-50 text-blue-700 border-blue-200',
  COMMERCIAL: 'bg-purple-50 text-purple-700 border-purple-200',
  NEW_BUILD: 'bg-green-50 text-green-700 border-green-200',
};

const TYPE_LABELS: Record<string, string> = {
  RESIDENTIAL: 'Residential',
  COMMERCIAL: 'Commercial',
  NEW_BUILD: 'New Build',
};

export default function OpportunitiesPage() {
  const [projectType, setProjectType] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [projects, setProjects] = useState<ApiOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOpportunities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: { type?: string; zipCode?: string } = {};
      if (projectType) params.type = projectType;
      if (zipCode.length === 5) params.zipCode = zipCode;
      const data = await opportunitiesApi.list(params);
      setProjects(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load opportunities');
    } finally {
      setLoading(false);
    }
  }, [projectType, zipCode]);

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Available Opportunities</h1>
        <p className="text-gray-500">Browse projects posted by owners — express interest and submit bids</p>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <SlidersHorizontal className="text-amber-600" size={20} />
          <h2 className="text-gray-900 font-semibold">Filters</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Project Type */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Project Type</label>
            <select
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-amber-500 transition-colors appearance-none"
            >
              {PROJECT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Zip Code */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Zip Code</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="Enter zip code"
                maxLength={5}
                className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          {/* Search Button */}
          <div className="flex items-end">
            <button
              onClick={fetchOpportunities}
              className="w-full bg-amber-500 text-white font-semibold py-2.5 rounded-lg hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
            >
              <Search size={16} />
              Search
            </button>
          </div>
        </div>
      </div>

      {/* Results Count */}
      {!loading && !error && (
        <p className="text-sm text-gray-500">
          {projects.length} {projects.length === 1 ? 'opportunity' : 'opportunities'} found
        </p>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-amber-600" size={32} />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchOpportunities}
            className="mt-3 text-sm text-amber-600 hover:text-amber-700 transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {/* Project Cards */}
      {!loading && !error && projects.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {projects.map((project) => {
            const typeColor = TYPE_COLORS[project.type] || 'bg-gray-100 text-gray-500 border-gray-200';
            const typeLabel = TYPE_LABELS[project.type] || project.type;
            const scope = project.scopeDocument;
            const hasScope = scope && scope.completenessPercent > 0;

            return (
              <div
                key={project.id}
                className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-md transition-all group shadow-sm"
              >
                {/* Top Row: Title + Type Badge */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-gray-900 truncate group-hover:text-amber-600 transition-colors">
                      {project.title}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Posted by {project.owner?.name || 'Owner'}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ml-3 whitespace-nowrap ${typeColor}`}>
                    {typeLabel}
                  </span>
                </div>

                {/* Scope Summary */}
                {hasScope && scope.projectScope && (
                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {scope.projectScope}
                    </p>
                  </div>
                )}

                {/* Meta Row */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 mb-4">
                  <span className="flex items-center gap-1">
                    <MapPin size={12} />
                    {project.zipCode}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {new Date(project.createdAt).toLocaleDateString()}
                  </span>
                  {hasScope && (
                    <span className="flex items-center gap-1">
                      <Sparkles size={12} className="text-amber-600" />
                      Scope {scope.completenessPercent}% complete
                    </span>
                  )}
                  {scope?.timeline && (
                    <span className="flex items-center gap-1">
                      <FileText size={12} />
                      {scope.timeline.length > 40 ? scope.timeline.slice(0, 40) + '...' : scope.timeline}
                    </span>
                  )}
                </div>

                {/* Scope Progress Bar */}
                {hasScope && (
                  <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden mb-4">
                    <div
                      className="h-full bg-amber-500 transition-all"
                      style={{ width: `${scope.completenessPercent}%` }}
                    />
                  </div>
                )}

                {/* Action */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <span className="text-xs text-gray-400 uppercase tracking-wide">
                    {project.status}
                  </span>
                  <button className="inline-flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700 font-medium transition-colors">
                    View Details
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && projects.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 shadow-sm">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="p-4 bg-gray-100 rounded-full mb-6">
              <HardHat className="text-amber-400" size={48} />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No opportunities match your filters</h3>
            <p className="text-gray-500 max-w-md">
              {zipCode
                ? `No projects found in zip code ${zipCode}. Try removing filters or searching a different area.`
                : 'No projects have been posted yet. Check back soon as owners create new projects.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
