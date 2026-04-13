'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FileText, Users, BookOpen, Calendar, MapPin, Sparkles, Upload, ChevronRight, ChevronDown, Loader2, AlertCircle, Pencil } from 'lucide-react';
import { useAuth } from '../../../../lib/auth-context';
import { projects as projectsApi, ApiProject } from '../../../../lib/api';

type TabType = 'overview' | 'documents' | 'scope' | 'team';

const STATUS_COLORS: Record<string, string> = {
  DISCOVERY: 'bg-amber-50 text-amber-700 border-amber-200',
  BIDDING: 'bg-blue-50 text-blue-700 border-blue-200',
  EXECUTION: 'bg-green-50 text-green-700 border-green-200',
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
        <Loader2 className="animate-spin text-amber-600" size={32} />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex items-center gap-3 text-red-600">
          <AlertCircle size={20} />
          <span>{error || 'Project not found'}</span>
        </div>
      </div>
    );
  }

  const statusLabel = STATUS_LABELS[project.status] || project.status;
  const statusColor = STATUS_COLORS[project.status] || 'bg-gray-50 text-gray-500 border-gray-200';

  return (
    <div className="p-8 space-y-8">
      {/* Project Header */}
      <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">{project.title}</h1>
            <p className="text-gray-500">Zip: {project.zipCode}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`px-4 py-2 rounded-full text-sm font-medium border ${statusColor}`}>
              {statusLabel}
            </span>
          </div>
        </div>

        {/* Project Meta */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6 pt-6 border-t border-gray-200">
          <div>
            <p className="text-gray-500 text-sm mb-1">Type</p>
            <p className="font-semibold text-gray-900">{project.type}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm mb-1">Status</p>
            <p className="font-semibold text-gray-900">{statusLabel}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm mb-1">Scope Mode</p>
            <p className="font-semibold text-gray-900">
              {project.scopeCreationMode === 'AI_ASSISTED' ? 'AI Assisted' : 'Manual Upload'}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-sm mb-1">Created</p>
            <p className="font-semibold text-gray-900">
              {new Date(project.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 flex gap-8">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`pb-4 font-medium transition-colors flex items-center gap-2 ${
                isActive
                  ? 'text-amber-600 border-b-2 border-amber-600'
                  : 'text-gray-500 hover:text-gray-900'
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
            <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Project Details</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-gray-500 text-sm mb-1">Location</p>
                  <div className="flex items-center gap-2 text-gray-900">
                    <MapPin size={16} />
                    <span>{project.zipCode}</span>
                  </div>
                </div>
                <div>
                  <p className="text-gray-500 text-sm mb-1">Created</p>
                  <div className="flex items-center gap-2 text-gray-900">
                    <Calendar size={16} />
                    <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {project.description && (
              <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Description</h2>
                <p className="text-gray-700 leading-relaxed">{project.description}</p>
              </div>
            )}

            {/* Scope Document Preview */}
            {project.scopeDocument && project.scopeDocument.projectScope && (
              <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Scope Summary</h2>
                <p className="text-gray-700 leading-relaxed">{project.scopeDocument.projectScope}</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="text-amber-600" size={20} />
                <h3 className="font-semibold text-gray-900">AI Scope Architect</h3>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                {project.scopeDocument
                  ? `Scope is ${project.scopeDocument.completenessPercent}% complete`
                  : 'Generate detailed scope of work with AI assistance'}
              </p>
              {project.scopeDocument && project.scopeDocument.completenessPercent > 0 && (
                <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden mb-4">
                  <div
                    className="h-full bg-amber-500"
                    style={{ width: `${project.scopeDocument.completenessPercent}%` }}
                  />
                </div>
              )}
              <Link
                href={`/projects/${params.id}/scope`}
                className="block w-full text-center bg-amber-500 text-white font-semibold py-2 rounded-lg hover:bg-amber-600 transition-colors"
              >
                Open AI Scope
              </Link>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4">Project Owner</h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
                  <span className="text-amber-600 font-semibold text-sm">
                    {user?.name
                      ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
                      : '?'}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{user?.name || 'Unknown'}</p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Project Documents</h2>
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-amber-400 transition-colors cursor-pointer">
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-900 mb-1">Upload Documents</h3>
            <p className="text-sm text-gray-500">Drag and drop files or click to upload</p>
            <p className="text-xs text-gray-400 mt-2">Supported: PDF, Images, Documents</p>
          </div>
          {project.documents.length > 0 && (
            <div className="mt-8 space-y-3">
              {project.documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                  <FileText size={20} className="text-amber-600" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{doc.filename}</p>
                    <p className="text-xs text-gray-500">
                      {doc.category} &middot; {new Date(doc.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {project.documents.length === 0 && (
            <p className="text-center text-gray-400 mt-6 text-sm">No documents uploaded yet</p>
          )}
        </div>
      )}

      {activeTab === 'scope' && (
        <div className="space-y-6">
          {/* Completeness + Actions */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Sparkles className="text-amber-600" size={22} />
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Scope of Work</h2>
                  <p className="text-gray-500 text-sm">
                    {project.scopeDocument
                      ? `${project.scopeDocument.completenessPercent}% complete — ${project.scopeDocument.status.replace('_', ' ')}`
                      : 'Not started'}
                  </p>
                </div>
              </div>
              <Link
                href={`/projects/${params.id}/scope`}
                className="inline-flex items-center gap-2 bg-amber-500 text-white font-semibold px-5 py-2 rounded-lg hover:bg-amber-600 transition-colors text-sm"
              >
                <Sparkles size={16} />
                {project.scopeDocument && project.scopeDocument.completenessPercent > 0
                  ? 'Continue Interview'
                  : 'Start AI Scope'}
                <ChevronRight size={16} />
              </Link>
            </div>
            {project.scopeDocument && (
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all"
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
                      className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md transition-all shadow-sm"
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
                        <h3 className="text-sm font-semibold text-amber-600 uppercase tracking-wide">
                          {section.label}
                        </h3>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/projects/${params.id}/scope`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-gray-300 hover:text-amber-600 transition-colors opacity-0 group-hover:opacity-100"
                            title="Edit in AI Scope Architect"
                          >
                            <Pencil size={14} />
                          </Link>
                          {needsTruncation && (
                            <ChevronDown
                              size={16}
                              className={`text-gray-400 transition-transform duration-200 ${
                                isExpanded ? 'rotate-180' : ''
                              }`}
                            />
                          )}
                        </div>
                      </button>

                      {/* Content */}
                      <div className="p-6 pt-3">
                        <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                          {isExpanded || !needsTruncation
                            ? section.value
                            : section.value?.slice(0, 120) + '...'}
                        </p>
                        {needsTruncation && !isExpanded && (
                          <button
                            onClick={() =>
                              setExpandedSections((prev) => new Set(prev).add(section.key))
                            }
                            className="text-amber-500 hover:text-amber-600 text-xs mt-2 transition-colors"
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
                    className="text-sm text-gray-400 hover:text-amber-600 transition-colors"
                  >
                    {expandedSections.size > 0 ? 'Collapse all' : 'Expand all sections'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center shadow-sm">
              <Sparkles className="text-amber-300 mx-auto mb-4" size={40} />
              <h3 className="font-semibold text-gray-500 mb-2">No scope data yet</h3>
              <p className="text-sm text-gray-400 max-w-md mx-auto">
                Use the AI Scope Architect to interview about your project and
                automatically generate a detailed scope of work.
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'team' && (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Team Members</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
                  <span className="text-amber-600 font-semibold text-sm">
                    {user?.name
                      ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
                      : '?'}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{user?.name || 'Unknown'}</p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                </div>
              </div>
              <span className="text-xs text-amber-600 font-medium">Owner</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
