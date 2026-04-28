'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, Users, BookOpen, Calendar, MapPin, Sparkles, Upload, ChevronRight, ChevronDown, Loader2, AlertCircle, Pencil, ScanLine, Eye, X, Check, Wand2, Trash2 } from 'lucide-react';
import { useAuth } from '../../../../lib/auth-context';
import { projects as projectsApi, uploads as uploadsApi, documents as documentsApi, ApiProject, ApiDocument } from '../../../../lib/api';

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

// ─── Documents Tab Component ───────────────────────────────

function DocumentsTab({ project, onProjectUpdate }: { project: ApiProject; onProjectUpdate: (p: ApiProject) => void }) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState<ApiDocument | null>(null);
  const [convertResult, setConvertResult] = useState<{
    docId: string;
    isScopeDocument: boolean;
    confidence: number;
    reason?: string;
    completenessPercent?: number;
    filledFields?: string[];
  } | null>(null);
  const [viewingDoc, setViewingDoc] = useState<ApiDocument | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useState<HTMLInputElement | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    try {
      // 1. Get presigned URL
      const { uploadUrl, key } = await uploadsApi.presign({
        kind: 'scopeDoc',
        contentType: file.type || 'application/pdf',
        contentLength: file.size,
      });

      // 2. Upload to S3
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/pdf' },
        body: file,
      });
      if (!putRes.ok) {
        const detail = await putRes.text().catch(() => '');
        throw new Error(
          `Upload to storage failed (${putRes.status}). ${detail.slice(0, 200)}`,
        );
      }

      // 3. Record document in DB
      const category = file.type?.startsWith('image/') ? 'PHOTO' : 'TECHNICAL';
      await projectsApi.addDocument(project.id, {
        s3Key: key,
        filename: file.name,
        category,
      });

      // 4. Refresh project
      const updated = await projectsApi.get(project.id);
      onProjectUpdate(updated);
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      // Reset file input
      if (e.target) e.target.value = '';
    }
  };

  const handleScan = async (doc: ApiDocument) => {
    setScanningId(doc.id);
    try {
      const result = await documentsApi.scan(doc.id);
      // Update document in project state
      const updatedDocs = project.documents.map((d) =>
        d.id === doc.id ? { ...d, extractedText: result.extractedText } : d,
      );
      onProjectUpdate({ ...project, documents: updatedDocs });
      // Open the result
      setViewingDoc({ ...doc, extractedText: result.extractedText });
    } catch (err: any) {
      setUploadError(err.message || 'Scan failed');
    } finally {
      setScanningId(null);
    }
  };

  const handleDeleteConfirmed = async (doc: ApiDocument) => {
    setDeletingId(doc.id);
    try {
      await documentsApi.delete(doc.id);
      const updated = await projectsApi.get(project.id);
      onProjectUpdate(updated);
      setConfirmDeleteDoc(null);
    } catch (err: any) {
      setUploadError(err.message || 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  const handleConvertToScope = async (doc: ApiDocument) => {
    setConvertingId(doc.id);
    setConvertResult(null);
    try {
      const result = await documentsApi.convertToScope(doc.id);
      setConvertResult({
        docId: doc.id,
        isScopeDocument: result.isScopeDocument,
        confidence: result.confidence,
        reason: result.reason,
        completenessPercent: result.scope?.completenessPercent,
        filledFields: result.scope?.filledFields,
      });
      if (result.isScopeDocument && result.scope) {
        // Refresh project so the scope tab reflects the new data
        const updated = await projectsApi.get(project.id);
        onProjectUpdate(updated);
      }
    } catch (err: any) {
      setUploadError(err.message || 'Convert to scope failed');
    } finally {
      setConvertingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Project Documents</h2>

        {uploadError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-600 text-sm">
            <AlertCircle size={16} />
            {uploadError}
            <button onClick={() => setUploadError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Upload area */}
        <label className="block border-2 border-dashed border-gray-300 rounded-xl p-10 text-center hover:border-amber-400 transition-colors cursor-pointer">
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />
          {uploading ? (
            <>
              <Loader2 className="w-10 h-10 text-amber-500 mx-auto mb-3 animate-spin" />
              <h3 className="font-semibold text-gray-900 mb-1">Uploading...</h3>
              <p className="text-sm text-gray-500">Please wait while your file is uploaded</p>
            </>
          ) : (
            <>
              <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-1">Upload Documents</h3>
              <p className="text-sm text-gray-500">Click to select a file — PDF, JPEG, or PNG</p>
              <p className="text-xs text-gray-400 mt-1">Max 25MB for documents, 5MB for images</p>
            </>
          )}
        </label>

        {/* Document list */}
        {project.documents.length > 0 && (
          <div className="mt-6 space-y-3">
            {project.documents.map((doc) => {
              const isScanning = scanningId === doc.id;
              const hasText = !!doc.extractedText;
              const isPdf = doc.filename.toLowerCase().endsWith('.pdf');
              const isImage = /\.(jpg|jpeg|png)$/i.test(doc.filename);
              const canScan = isPdf || isImage;

              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-gray-300 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    hasText ? 'bg-green-50' : 'bg-amber-50'
                  }`}>
                    <FileText size={18} className={hasText ? 'text-green-600' : 'text-amber-600'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{doc.filename}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500">{doc.category}</span>
                      <span className="text-xs text-gray-300">&middot;</span>
                      <span className="text-xs text-gray-500">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </span>
                      {hasText && (
                        <>
                          <span className="text-xs text-gray-300">&middot;</span>
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <Check size={10} />
                            Scanned
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {hasText && (
                      <button
                        onClick={() => setViewingDoc(doc)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-amber-600 hover:text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors"
                      >
                        <Eye size={14} />
                        View
                      </button>
                    )}
                    {hasText && (
                      <button
                        onClick={() => handleConvertToScope(doc)}
                        disabled={convertingId === doc.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50"
                        title="Use AI Scope Architect to populate the project scope from this document"
                      >
                        {convertingId === doc.id ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            Converting...
                          </>
                        ) : (
                          <>
                            <Wand2 size={14} />
                            Convert to Project Scope
                          </>
                        )}
                      </button>
                    )}
                    {canScan && (
                      <button
                        onClick={() => handleScan(doc)}
                        disabled={isScanning}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
                      >
                        {isScanning ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            Scanning...
                          </>
                        ) : (
                          <>
                            <ScanLine size={14} />
                            {hasText ? 'Re-scan' : 'AI Scan'}
                          </>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => setConfirmDeleteDoc(doc)}
                      disabled={deletingId === doc.id}
                      className="flex items-center justify-center w-8 h-8 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Delete document"
                      aria-label="Delete document"
                    >
                      {deletingId === doc.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {project.documents.length === 0 && (
          <p className="text-center text-gray-400 mt-6 text-sm">No documents uploaded yet</p>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDeleteDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => deletingId === null && setConfirmDeleteDoc(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <Trash2 size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Delete document?</h3>
                <p className="text-sm text-gray-500 mt-0.5 break-all">
                  {confirmDeleteDoc.filename}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-5">
              This permanently removes the file and any extracted text. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDeleteDoc(null)}
                disabled={deletingId !== null}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteConfirmed(confirmDeleteDoc)}
                disabled={deletingId !== null}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deletingId === confirmDeleteDoc.id ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert-to-Scope Result Modal */}
      {convertResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConvertResult(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="p-6">
              {convertResult.isScopeDocument ? (
                <>
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 bg-violet-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Wand2 size={20} className="text-violet-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Scope created from document</h3>
                      <p className="text-sm text-gray-500 mt-0.5">
                        AI confidence: {Math.round(convertResult.confidence * 100)}%
                      </p>
                    </div>
                  </div>
                  <div className="mb-4 p-3 bg-violet-50 border border-violet-100 rounded-lg">
                    <p className="text-sm text-violet-900 font-medium mb-1">
                      {convertResult.completenessPercent}% complete
                    </p>
                    <p className="text-xs text-violet-700">
                      Populated {convertResult.filledFields?.length ?? 0} of 9 scope fields:{' '}
                      {(convertResult.filledFields ?? []).join(', ') || 'none'}
                    </p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setConvertResult(null)}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => {
                        setConvertResult(null);
                        router.push(`/projects/${project.id}/scope`);
                      }}
                      className="px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
                    >
                      Open AI Scope Architect
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <AlertCircle size={20} className="text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Not a scope document</h3>
                      <p className="text-sm text-gray-500 mt-0.5">
                        AI confidence: {Math.round(convertResult.confidence * 100)}%
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 mb-4">
                    {convertResult.reason ||
                      'This file does not appear to describe a scope of work.'}
                  </p>
                  <div className="flex justify-end">
                    <button
                      onClick={() => setConvertResult(null)}
                      className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Extracted Text Viewer Modal */}
      {viewingDoc && viewingDoc.extractedText && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setViewingDoc(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center">
                  <ScanLine size={18} className="text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{viewingDoc.filename}</h3>
                  <p className="text-xs text-gray-500">AI-Extracted Content</p>
                </div>
              </div>
              <button
                onClick={() => setViewingDoc(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                {viewingDoc.extractedText}
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(viewingDoc.extractedText || '');
                }}
                className="flex items-center gap-2 px-4 py-2 text-sm text-amber-600 border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors"
              >
                Copy to Clipboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────

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
        <DocumentsTab project={project} onProjectUpdate={setProject} />
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
