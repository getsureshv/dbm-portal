'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageSquare,
  Search,
  Loader2,
  ArrowRight,
  Bot,
  Calendar,
  FileText,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../../lib/auth-context';
import { projects as projectsApi } from '../../../lib/api';
import type { ApiProject } from '../../../lib/api';

export default function ChatPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [projectList, setProjectList] = useState<ApiProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await projectsApi.list();
        setProjectList(data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = projectList.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase()),
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DISCOVERY':
        return 'bg-blue-100 text-blue-700';
      case 'BIDDING':
        return 'bg-amber-100 text-amber-700';
      case 'CONTRACTING':
        return 'bg-purple-100 text-purple-700';
      case 'EXECUTION':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getScopeProgress = (project: ApiProject) => {
    return project.scopeDocument?.completenessPercent ?? 0;
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
        <p className="text-gray-500 mt-1">
          AI Scope Architect conversations for your projects
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-3 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition-colors"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-amber-500" size={28} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="text-amber-500" size={28} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {search ? 'No matching projects' : 'No conversations yet'}
          </h3>
          <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
            {search
              ? 'Try a different search term.'
              : 'Create a project and start talking to the AI Scope Architect to build your scope of work.'}
          </p>
          {!search && user?.role === 'OWNER' && (
            <button
              onClick={() => router.push('/projects/new')}
              className="inline-flex items-center gap-2 bg-amber-500 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-amber-600 transition-colors"
            >
              <Sparkles size={16} />
              Create a Project
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((project) => {
            const progress = getScopeProgress(project);
            const hasScope = progress > 0;
            const scopeStatus = project.scopeDocument?.status ?? 'DRAFT';

            return (
              <button
                key={project.id}
                onClick={() => router.push(`/projects/${project.id}/scope`)}
                className="w-full bg-white border border-gray-200 rounded-xl p-5 hover:border-amber-300 hover:shadow-md transition-all text-left group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-amber-100 transition-colors">
                      <Bot className="text-amber-600" size={20} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {project.title}
                      </h3>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${getStatusColor(project.status)}`}
                        >
                          {project.status}
                        </span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Calendar size={12} />
                          {new Date(project.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                      {hasScope && (
                        <div className="flex items-center gap-2 mt-2.5">
                          <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">
                            {progress}% complete
                          </span>
                          {scopeStatus === 'COMPLETE' && (
                            <FileText size={12} className="text-green-500" />
                          )}
                        </div>
                      )}
                      {!hasScope && (
                        <p className="text-xs text-gray-400 mt-2">
                          Start a conversation to build your scope of work
                        </p>
                      )}
                    </div>
                  </div>
                  <ArrowRight
                    size={18}
                    className="text-gray-300 group-hover:text-amber-500 transition-colors flex-shrink-0 mt-2"
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Tip */}
      {filtered.length > 0 && (
        <div className="mt-8 bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
          <Sparkles className="text-amber-500 flex-shrink-0 mt-0.5" size={16} />
          <div>
            <p className="text-sm font-medium text-amber-800">
              AI Scope Architect
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              Click any project to continue your scope interview. The AI will
              guide you through defining your project requirements and generate a
              professional Scope of Work document.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
