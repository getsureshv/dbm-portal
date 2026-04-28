'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  User,
  Sparkles,
  FileText,
  Ruler,
  Palette,
  Clock,
  Flag,
  AlertTriangle,
  Mountain,
  Loader2,
  Send,
  CheckCircle2,
} from 'lucide-react';
import { opportunities as opportunitiesApi, ApiOpportunityDetail } from '../../../../lib/api';

const SCOPE_SECTIONS = [
  { key: 'projectScope', label: 'Project Scope', icon: FileText, color: 'blue' },
  { key: 'dimensions', label: 'Dimensions & Size', icon: Ruler, color: 'emerald' },
  { key: 'materialGrade', label: 'Material Grade', icon: Palette, color: 'purple' },
  { key: 'timeline', label: 'Timeline', icon: Clock, color: 'amber' },
  { key: 'milestones', label: 'Milestones', icon: Flag, color: 'indigo' },
  { key: 'specialConditions', label: 'Special Conditions', icon: AlertTriangle, color: 'rose' },
  { key: 'siteConstraints', label: 'Site Constraints', icon: Mountain, color: 'slate' },
  { key: 'aestheticPreferences', label: 'Aesthetic Preferences', icon: Palette, color: 'pink' },
] as const;

const TYPE_LABELS: Record<string, string> = {
  RESIDENTIAL: 'Residential',
  COMMERCIAL: 'Commercial',
  NEW_BUILD: 'New Build',
};

const TYPE_COLORS: Record<string, string> = {
  RESIDENTIAL: 'bg-blue-50 text-blue-700 border-blue-200',
  COMMERCIAL: 'bg-purple-50 text-purple-700 border-purple-200',
  NEW_BUILD: 'bg-green-50 text-green-700 border-green-200',
};

const COLOR_MAP: Record<string, { bg: string; text: string; icon: string }> = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', icon: 'text-blue-500' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: 'text-emerald-500' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', icon: 'text-purple-500' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', icon: 'text-amber-500' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', icon: 'text-indigo-500' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-700', icon: 'text-rose-500' },
  slate: { bg: 'bg-slate-50', text: 'text-slate-700', icon: 'text-slate-500' },
  pink: { bg: 'bg-pink-50', text: 'text-pink-700', icon: 'text-pink-500' },
};

export default function OpportunityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [project, setProject] = useState<ApiOpportunityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await opportunitiesApi.get(id);
        setProject(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load opportunity');
      } finally {
        setLoading(false);
      }
    }
    if (id) load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="text-red-400" size={28} />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Opportunity Not Found</h2>
        <p className="text-gray-500 mb-6">{error || 'This opportunity may have been removed.'}</p>
        <button
          onClick={() => router.push('/opportunities')}
          className="inline-flex items-center gap-2 text-amber-600 hover:text-amber-700 font-medium"
        >
          <ArrowLeft size={16} />
          Back to Opportunities
        </button>
      </div>
    );
  }

  const scope = project.scopeDocument;
  const progress = scope?.completenessPercent ?? 0;
  const typeLabel = TYPE_LABELS[project.type] || project.type;
  const typeColor = TYPE_COLORS[project.type] || 'bg-gray-100 text-gray-600 border-gray-200';

  // Count filled scope sections
  const filledSections = SCOPE_SECTIONS.filter(
    (s) => scope && scope[s.key as keyof typeof scope],
  ).length;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => router.push('/opportunities')}
        className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6 text-sm font-medium transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Opportunities
      </button>

      {/* Header Card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm mb-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{project.title}</h1>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1.5">
                <User size={14} />
                {project.owner?.name || 'Owner'}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin size={14} />
                {project.zipCode}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar size={14} />
                Posted {new Date(project.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          <span className={`px-4 py-1.5 rounded-full text-sm font-medium border ${typeColor}`}>
            {typeLabel}
          </span>
        </div>

        {/* Progress */}
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-amber-500" />
              <span className="text-sm font-medium text-gray-700">
                Scope Completeness
              </span>
            </div>
            <span className="text-sm font-bold text-gray-900">{progress}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {filledSections} of {SCOPE_SECTIONS.length} scope sections defined
          </p>
        </div>
      </div>

      {/* Scope Sections */}
      <div className="space-y-4 mb-8">
        <h2 className="text-lg font-bold text-gray-900">Scope of Work</h2>

        {scope && filledSections > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SCOPE_SECTIONS.map((section) => {
              const value = scope[section.key as keyof typeof scope];
              if (!value || typeof value !== 'string') return null;

              const colors = COLOR_MAP[section.color];
              const Icon = section.icon;

              return (
                <div
                  key={section.key}
                  className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm"
                >
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className={`w-8 h-8 ${colors.bg} rounded-lg flex items-center justify-center`}>
                      <Icon size={16} className={colors.icon} />
                    </div>
                    <h3 className="font-semibold text-gray-900 text-sm">
                      {section.label}
                    </h3>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                    {value}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
            <FileText className="text-gray-300 mx-auto mb-3" size={32} />
            <p className="text-gray-500 text-sm">
              The owner hasn&apos;t defined the scope of work yet.
            </p>
          </div>
        )}
      </div>

      {/* Key Details */}
      {scope?.preferredStartDate && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={16} className="text-amber-500" />
            <h3 className="font-semibold text-gray-900 text-sm">
              Preferred Start Date
            </h3>
          </div>
          <p className="text-sm text-gray-600">{scope.preferredStartDate}</p>
        </div>
      )}

      {/* Express Interest CTA */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-8 text-center">
        <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Send className="text-amber-600" size={24} />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">
          Interested in this project?
        </h3>
        <p className="text-sm text-gray-500 mb-5 max-w-md mx-auto">
          Express your interest and the project owner will be able to review your profile and invite you to bid.
        </p>
        <button
          className="inline-flex items-center gap-2 bg-amber-500 text-white px-8 py-3 rounded-xl font-semibold hover:bg-amber-600 transition-colors shadow-sm"
          onClick={() => {
            // TODO: Implement express interest API
            alert('Express Interest feature coming soon!');
          }}
        >
          <CheckCircle2 size={18} />
          Express Interest
        </button>
        <p className="text-xs text-gray-400 mt-3">
          Bidding features are coming in Phase 2
        </p>
      </div>
    </div>
  );
}
