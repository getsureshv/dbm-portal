'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FileText, Users, BookOpen, Calendar, MapPin, Sparkles, Upload, ChevronRight, ChevronDown, Loader2, AlertCircle, Pencil } from 'lucide-react';
import { useAuth } from '../../../../lib/auth-context';
import { projects as projectsApi, ApiProject } from '../../../../lib/api';

type TabType = 'overview' | 'documents' | 'scope' | 'team';

const STATUS_COLORS: Record<string, string> = {
  DISCOVERY: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  BIDDING: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  EXECUTION: 'bg-green-500/20 text-green-400 border-green-500/30',
};

const STATUS_LABELS: Record<string, string> = {
  DISCOVERY: 'Discovery',
  BIDDING: 'Bidding',
  CONTRACTING: 'Contracting',
  EXECUTION: 'In Progress',
  CLOSING: 'Closing',
  ARCHIVED: 'Archived',
};

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [project, setProject] = useState<ApiProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    projectsApi
      .get(params.id)
      .then(setProject)
      .catch((err) => setError(err.message || 'Failed to load project'))
      .finally(() => setLoading(false));
  }, [params.id]);

  const TABS = [
    { id: 'overview', label: 'Overview', icon: BookOpen },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'scope', label: 'Scope', icon: BookOpen },
    { id: 'team', label: 'Team', icon: Users },
  ] as const;

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="animate-spin text-gold" size={32} />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-8">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 flex items-center gap-3 text-red-400">
          <AlertCircle size={20} />
          <span>{error || 'Project not found'}</span>
        </div>
      </div>
    );
  }

  const statusLabel = STATUS_LABELS[project.status] || project.status;
  const statusColor = STATUS_COLORS[project.status] || 'bg-white/10 text-white/60 border-white/20';

  return (
    <div className="p-8 space-y-8">
      {/* Project Header */}
      <div className="bg-gradient-to-r from-gold/20 to-white/5 border border-gold/20 rounded-2xl p-8">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">{project.title}</h1>
            <p className="text-white/60">Zip: {project.zipCode}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`px-4 py-2 rounded-full text-sm font-medium border ${statusColor}`}>
              {statusLabel}
            </span>
          </div>
        </div>

        {/* Project Meta */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6 pt-6 border-t border-white/10">
          <div>
            <p className="text-white/60 text-sm mb-1">Type</p>
            <p className="font-semibold text-white">{project.type}</p>
          </div>
          <div>
            <p className="text-white/60 text-sm mb-1">Status</p>
            <p className="font-semibold text-white">{statusLabel}</p>
          </div>
          <div>
            <p className="text-white/60 text-sm mb-1">Scope Mode</p>
            <p className="font-semibold text-white">
              {project.scopeCreationMode === 'AI_ASSISTED' ? 'AI Assisted' : 'Manual Upload'}
            </p>
          </div>
          <div>
            <p className="text-white/60 text-sm mb-1">Created</p>
            <p className="font-semibold text-white">
              {new Date(project.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/10 flex gap-8">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`pb-4 font-medium transition-colors flex items-center gap-2 ${
                isActive
                  ? 'text-gold border-b-2 border-gold'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
              <h2 className="text-xl font-bold text-white mb-4">Project Details</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-white/60 text-sm mb-1">Location</p>
                  <div className="flex items-center gap-2 text-white">
                    <MapPin size={16} />
                    <span>{project.zipCode}</span>
                  </div>
                </div>
                <div>
                  <p className="text-white/60 text-sm mb-1">Created</p>
                  <div className="flex items-center gap-2 text-white">
                    <Calendar size={16} />
                    <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {project.description && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
                <h2 className="text-xl font-bold text-white mb-4">Description</h2>
                <p className="text-white/80 leading-relaxed">{project.description}</p>
              </div>
            )}

            {/* Scope Document Preview */}
            {project.scopeDocument && project.scopeDocument.projectScope && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
                <h2 className="text-xl font-bold text-white mb-4">Scope Summary</h2>
                <p className="text-white/80 leading-relaxed">{project.scopeDocument.projectScope}</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-gold/10 border border-gold/30 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="text-gold" size={20} />
                <h3 className="font-semibold text-white">AI Scope Architect</h3>
              </div>
              <p className="text-sm text-white/70 mb-2">
                {project.scopeDocument
                  ? `Scope is ${project.scopeDocument.completenessPercent}% complete`
                  : 'Generate detailed scope of work with AI assistance'}
              </p>
              {project.scopeDocument && project.scopeDocument.completenessPercent > 0 && (
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-4">
                  <div
                    className="h-full bg-gradient-to-r from-gold to-gold/70"
                    style={{ width: `${project.scopeDocument.completenessPercent}%` }}
                  />
                </div>
              )}
              <Link
                href={`/projects/${params.id}/scope`}
                className="block w-full text-center bg-gold text-navy font-semibold py-2 rounded-lg hover:bg-gold/90 transition-colors"
              >
                Open AI Scope
              </Link>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="font-semibold text-white mb-4">Project Owner</h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center">
                  <span className="text-gold font-semibold text-sm">
                    {user?.name
                      ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
                      : '?'}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-white">{user?.name || 'Unknown'}</p>
                  <p className="text-xs text-white/60">{user?.email}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          <h2 className="text-xl font-bold text-white mb-6">Project Documents</h2>
          <div className="border-2 border-dashed border-white/20 rounded-xl p-12 text-center hover:border-gold/50 transition-colors cursor-pointer">
            <Upload className="w-12 h-12 text-white/40 mx-auto mb-4" />
            <h3 className="font-semibold text-white mb-1">Upload Documents</h3>
            <p className="text-sm text-white/60">Drag and drop files or click to upload</p>
            <p className="text-xs text-white/40 mt-2">Supported: PDF, Images, Documents</p>
          </div>
          {project.documents.length > 0 && (
            <div className="mt-8 space-y-3">
              {project.documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-lg">
                  <FileText size={20} className="text-gold" />
                  <div className="flex-1">
                    <p className="font-medium text-white">{doc.filename}</p>
                    <p className="text-xs text-white/60">
                      {doc.category} &middot; {new Date(doc.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {project.documents.length === 0 && (
            <p className="text-center text-white/40 mt-6 text-sm">No documents uploaded yet</p>
          )}
        </div>
      )}

      {activeTab === 'scope' && (
        <div className="space-y-6">
          {/* Completeness + Actions */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Sparkles className="text-gold" size={22} />
                <div>
                  <h2 className="text-xl font-bold text-white">Scope of Work</h2>
                  <p className="text-white/50 text-sm">
                    {project.scopeDocument
                      ? `${project.scopeDocument.completenessPercent}% complete — ${project.scopeDocument.status.replace('_', ' ')}`
                      : 'Not started'}
                  </p>
                </div>
              </div>
              <Link
                href={`/projects/${params.id}/scope`}
                className="inline-flex items-center gap-2 bg-gold text-navy font-semibold px-5 py-2 rounded-lg hover:bg-gold/90 transition-colors text-sm"
              >
                <Sparkles size={16} />
                {project.scopeDocument && project.scopeDocument.completenessPercent > 0
                  ? 'Continue Interview'
                  : 'Start AI Scope'}
                <ChevronRight size={16} />
              </Link>
            </div>
            {project.scopeDocument && (
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-gold to-gold/70 transition-all"
                  style={{ width: `${project.scopeDocument.completenessPercent}%` }}
                />
              </div>
            )}
          </div>

          {/* Scope Fields */}
          {project.scopeDocument && project.scopeDocument.completenessPercent > 0 ? (
            <div className="space-y-4">
              {[
                { key: 'projectScope', label: 'Project Scope', value: project.scopeDocument.projectScope },
                { key: 'dimensions', label: 'Dimensions & Specifications', value: project.scopeDocument.dimensions },
                { key: 'materialGrade', label: 'Materials & Grade', value: project.scopeDocument.materialGrade },
                { key: 'timeline', label: 'Timeline', value: project.scopeDocument.timeline },
                { key: 'milestones', label: 'Milestones', value: project.scopeDocument.milestones },
                { key: 'specialConditions', label: 'Special Conditions', value: project.scopeDocument.specialConditions },
                { key: 'preferredStartDate', label: 'Preferred Start Date', value: project.scopeDocument.preferredStartDate },
                { key: 'siteConstraints', label: 'Site Constraints', value: project.scopeDocument.siteConstraints },
                { key: 'aestheticPreferences', label: 'Aesthetic Preferences', value: project.scopeDocument.aestheticPreferences },
              ]
                .filter((s) => s.value)
                .map((section) => {
                  const isExpanded = expandedSections.has(section.key);
                  const needsTruncation = (section.value?.length || 0) > 120;

                  return (
                    <div
                      key={section.key}
                      className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-colors"
                    >
                      {/* Clickable Header */}
                      <button
                        onClick={() =>
                          setExpandedSections((prev) => {
                            const next = new Set(prev);
                            if (next.has(section.key)) {
                              next.delete(section.key);
                            } else {
                              next.add(section.key);
                            }
                            return next;
                          })
                        }
                        className="w-full flex items-center justify-between p-6 pb-0 text-left group"
                      >
                        <h3 className="text-sm font-semibold text-gold uppercase tracking-wide">
                          {section.label}
                        </h3>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/projects/${params.id}/scope`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-white/30 hover:text-gold transition-colors opacity-0 group-hover:opacity-100"
                            title="Edit in AI Scope Architect"
                          >
                            <Pencil size={14} />
                          </Link>
                          {needsTruncation && (
                            <ChevronDown
                              size={16}
                              className={`text-white/40 transition-transform duration-200 ${
                                isExpanded ? 'rotate-180' : ''
                              }`}
                            />
                          )}
                        </div>
                      </button>

                      {/* Content */}
                      <div className="p-6 pt-3">
                        <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">
                          {isExpanded || !needsTruncation
                            ? section.value
                            : section.value?.slice(0, 120) + '...'}
                        </p>
                        {needsTruncation && !isExpanded && (
                          <button
                            onClick={() =>
                              setExpandedSections((prev) => new Set(prev).add(section.key))
                            }
                            className="text-gold/70 hover:text-gold text-xs mt-2 transition-colors"
                          >
                            Show more
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

              {/* Expand All / Collapse All */}
              {[
                project.scopeDocument.projectScope,
                project.scopeDocument.dimensions,
                project.scopeDocument.materialGrade,
                project.scopeDocument.timeline,
                project.scopeDocument.milestones,
                project.scopeDocument.specialConditions,
                project.scopeDocument.preferredStartDate,
                project.scopeDocument.siteConstraints,
                project.scopeDocument.aestheticPreferences,
              ].filter(Boolean).length > 2 && (
                <div className="flex justify-center pt-2">
                  <button
                    onClick={() => {
                      const allKeys = [
                        'projectScope', 'dimensions', 'materialGrade', 'timeline',
                        'milestones', 'specialConditions', 'preferredStartDate',
                        'siteConstraints', 'aestheticPreferences',
                      ];
                      if (expandedSections.size > 0) {
                        setExpandedSections(new Set());
                      } else {
                        setExpandedSections(new Set(allKeys));
                      }
                    }}
                    className="text-sm text-white/40 hover:text-gold transition-colors"
                  >
                    {expandedSections.size > 0 ? 'Collapse all' : 'Expand all sections'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white/5 border border-dashed border-white/20 rounded-2xl p-12 text-center">
              <Sparkles className="text-gold/30 mx-auto mb-4" size={40} />
              <h3 className="font-semibold text-white/60 mb-2">No scope data yet</h3>
              <p className="text-sm text-white/40 max-w-md mx-auto">
                Use the AI Scope Architect to interview about your project and
                automatically generate a detailed scope of work.
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'team' && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          <h2 className="text-xl font-bold text-white mb-6">Team Members</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center">
                  <span className="text-gold font-semibold text-sm">
                    {user?.name
                      ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
                      : '?'}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-white">{user?.name || 'Unknown'}</p>
                  <p className="text-xs text-white/60">{user?.email}</p>
                </div>
              </div>
              <span className="text-xs text-gold font-medium">Owner</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
