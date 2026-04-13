'use client';

import { BarChart3, Clock, Zap, Plus, Users, Sparkles, Loader2, Building2, Search, FileText, Settings } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '../../../lib/auth-context';
import { projects as projectsApi, ApiProject } from '../../../lib/api';

const STATUS_COLORS: Record<string, string> = {
  DISCOVERY: 'bg-amber-50 text-amber-700 border-amber-200',
  BIDDING: 'bg-blue-50 text-blue-700 border-blue-200',
  CONTRACTING: 'bg-purple-50 text-purple-700 border-purple-200',
  EXECUTION: 'bg-green-50 text-green-700 border-green-200',
  CLOSING: 'bg-orange-50 text-orange-700 border-orange-200',
  ARCHIVED: 'bg-gray-100 text-gray-500 border-gray-200',
};

const STATUS_LABELS: Record<string, string> = {
  DISCOVERY: 'Discovery',
  BIDDING: 'Bidding',
  CONTRACTING: 'Contracting',
  EXECUTION: 'In Progress',
  CLOSING: 'Closing',
  ARCHIVED: 'Archived',
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [projectList, setProjectList] = useState<ApiProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    projectsApi
      .list()
      .then(setProjectList)
      .catch(() => setProjectList([]))
      .finally(() => setLoading(false));
  }, []);

  const activeCount = projectList.filter((p) => !p.deletedAt && p.status !== 'ARCHIVED').length;
  const scopeCount = projectList.filter((p) => p.scopeDocument?.status === 'COMPLETE' || p.scopeDocument?.status === 'FINALIZED').length;
  const recentProjects = projectList.slice(0, 5);
  const displayName = user?.name?.split(' ')[0] || 'there';

  const stats = [
    { icon: BarChart3, label: 'Active Projects', value: String(activeCount), iconBg: 'bg-amber-100', iconColor: 'text-amber-600' },
    { icon: Clock, label: 'Total Projects', value: String(projectList.length), iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
    { icon: Zap, label: 'AI Scopes Done', value: String(scopeCount), iconBg: 'bg-purple-100', iconColor: 'text-purple-600' },
  ];

  // PROVIDER dashboard
  if (user?.role === 'PROVIDER') {
    const providerStats = [
      { icon: Building2, label: 'My Profile', value: user.name || 'Incomplete', iconBg: 'bg-amber-100', iconColor: 'text-amber-600' },
      { icon: Search, label: 'Available Opportunities', value: '0', iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
      { icon: FileText, label: 'Bids Submitted', value: '0', iconBg: 'bg-purple-100', iconColor: 'text-purple-600' },
    ];

    return (
      <div className="p-8 space-y-8">
        {/* Welcome Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back, {displayName}</h1>
          <p className="text-gray-500">Here&apos;s your provider dashboard</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {providerStats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-lg ${stat.iconBg}`}>
                    <Icon className={stat.iconColor} size={24} />
                  </div>
                </div>
                <p className="text-gray-500 text-sm mb-1">{stat.label}</p>
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
              </div>
            );
          })}
        </div>

        {/* Recent Activity */}
        <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Recent Activity</h2>
          <div className="text-center py-8">
            <p className="text-gray-500">No recent activity</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            href="/profile"
            className="bg-amber-500 text-white font-semibold p-6 rounded-2xl hover:bg-amber-600 transition-colors flex items-center gap-3 shadow-sm"
          >
            <Building2 size={24} />
            <span>View Profile</span>
          </Link>
          <Link
            href="/opportunities"
            className="bg-white border border-gray-200 text-gray-900 font-semibold p-6 rounded-2xl hover:border-amber-300 hover:shadow-md transition-all flex items-center gap-3"
          >
            <Search size={24} className="text-gray-500" />
            <span>Browse Opportunities</span>
          </Link>
          <Link
            href="/profile"
            className="bg-white border border-gray-200 text-gray-900 font-semibold p-6 rounded-2xl hover:border-amber-300 hover:shadow-md transition-all flex items-center gap-3"
          >
            <Settings size={24} className="text-gray-500" />
            <span>Update Trades</span>
          </Link>
        </div>
      </div>
    );
  }

  // OWNER dashboard (default)
  return (
    <div className="p-8 space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back, {displayName}</h1>
        <p className="text-gray-500">Here&apos;s what&apos;s happening with your projects</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-lg ${stat.iconBg}`}>
                  <Icon className={stat.iconColor} size={24} />
                </div>
              </div>
              <p className="text-gray-500 text-sm mb-1">{stat.label}</p>
              <p className="text-3xl font-bold text-gray-900">
                {loading ? <Loader2 className="animate-spin text-amber-500" size={24} /> : stat.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Recent Projects */}
      <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Recent Projects</h2>
          <Link
            href="/projects"
            className="text-amber-600 hover:text-amber-700 text-sm font-medium transition-colors"
          >
            View all
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-amber-500" size={24} />
          </div>
        ) : recentProjects.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-2">No projects yet</p>
            <Link href="/projects" className="text-amber-600 text-sm hover:text-amber-700">
              Create your first project
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {recentProjects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="block p-4 bg-white border border-gray-200 rounded-lg hover:border-amber-300 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-amber-600 transition-colors">
                      {project.title}
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(project.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[project.status] || STATUS_COLORS.DISCOVERY}`}
                  >
                    {STATUS_LABELS[project.status] || project.status}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{project.type}</p>
                {project.scopeDocument && (
                  <div className="mt-3 w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full"
                      style={{ width: `${project.scopeDocument.completenessPercent}%` }}
                    ></div>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/projects"
          className="bg-amber-500 text-white font-semibold p-6 rounded-2xl hover:bg-amber-600 transition-colors flex items-center gap-3 shadow-sm"
        >
          <Plus size={24} />
          <span>New Project</span>
        </Link>
        <Link
          href="/discovery"
          className="bg-white border border-gray-200 text-gray-900 font-semibold p-6 rounded-2xl hover:border-amber-300 hover:shadow-md transition-all flex items-center gap-3"
        >
          <Users size={24} className="text-gray-500" />
          <span>Find Providers</span>
        </Link>
        {recentProjects[0] && (
          <Link
            href={`/projects/${recentProjects[0].id}/scope`}
            className="bg-white border border-gray-200 text-gray-900 font-semibold p-6 rounded-2xl hover:border-amber-300 hover:shadow-md transition-all flex items-center gap-3"
          >
            <Sparkles size={24} className="text-gray-500" />
            <span>AI Scope</span>
          </Link>
        )}
      </div>
    </div>
  );
}
