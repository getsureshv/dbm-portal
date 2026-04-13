'use client';

import { BarChart3, Clock, Zap, Plus, Users, Sparkles, Loader2, Building2, Search, FileText, Settings } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '../../../lib/auth-context';
import { projects as projectsApi, ApiProject } from '../../../lib/api';

const STATUS_COLORS: Record<string, string> = {
  DISCOVERY: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  BIDDING: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  CONTRACTING: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  EXECUTION: 'bg-green-500/20 text-green-400 border-green-500/30',
  CLOSING: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  ARCHIVED: 'bg-white/10 text-white/40 border-white/20',
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
    { icon: BarChart3, label: 'Active Projects', value: String(activeCount), color: 'from-gold to-gold/70' },
    { icon: Clock, label: 'Total Projects', value: String(projectList.length), color: 'from-blue-400 to-blue-600' },
    { icon: Zap, label: 'AI Scopes Done', value: String(scopeCount), color: 'from-purple-400 to-purple-600' },
  ];

  // PROVIDER dashboard
  if (user?.role === 'PROVIDER') {
    const providerStats = [
      { icon: Building2, label: 'My Profile', value: user.name || 'Incomplete', color: 'from-gold to-gold/70' },
      { icon: Search, label: 'Available Opportunities', value: '0', color: 'from-blue-400 to-blue-600' },
      { icon: FileText, label: 'Bids Submitted', value: '0', color: 'from-purple-400 to-purple-600' },
    ];

    return (
      <div className="p-8 space-y-8">
        {/* Welcome Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome back, {displayName}</h1>
          <p className="text-white/60">Here&apos;s your provider dashboard</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {providerStats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-lg bg-gradient-to-br ${stat.color} bg-opacity-20`}>
                    <Icon className="text-gold" size={24} />
                  </div>
                </div>
                <p className="text-white/60 text-sm mb-1">{stat.label}</p>
                <p className="text-3xl font-bold text-white">{stat.value}</p>
              </div>
            );
          })}
        </div>

        {/* Recent Activity */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          <h2 className="text-xl font-bold text-white mb-6">Recent Activity</h2>
          <div className="text-center py-8">
            <p className="text-white/60">No recent activity</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            href="/profile"
            className="bg-gold text-navy font-semibold p-6 rounded-2xl hover:bg-gold/90 transition-colors flex items-center gap-3 group"
          >
            <Building2 size={24} />
            <span>View Profile</span>
          </Link>
          <Link
            href="/opportunities"
            className="bg-white/5 border border-white/10 text-white font-semibold p-6 rounded-2xl hover:border-gold/30 hover:bg-gold/5 transition-colors flex items-center gap-3 group"
          >
            <Search size={24} />
            <span>Browse Opportunities</span>
          </Link>
          <Link
            href="/profile"
            className="bg-white/5 border border-white/10 text-white font-semibold p-6 rounded-2xl hover:border-gold/30 hover:bg-gold/5 transition-colors flex items-center gap-3 group"
          >
            <Settings size={24} />
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
        <h1 className="text-3xl font-bold text-white mb-2">Welcome back, {displayName}</h1>
        <p className="text-white/60">Here&apos;s what&apos;s happening with your projects</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-lg bg-gradient-to-br ${stat.color} bg-opacity-20`}>
                  <Icon className="text-gold" size={24} />
                </div>
              </div>
              <p className="text-white/60 text-sm mb-1">{stat.label}</p>
              <p className="text-3xl font-bold text-white">
                {loading ? <Loader2 className="animate-spin" size={24} /> : stat.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Recent Projects */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Recent Projects</h2>
          <Link
            href="/projects"
            className="text-gold hover:text-gold/80 text-sm font-medium transition-colors"
          >
            View all
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-gold" size={24} />
          </div>
        ) : recentProjects.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-white/60 mb-2">No projects yet</p>
            <Link href="/projects" className="text-gold text-sm hover:text-gold/80">
              Create your first project
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {recentProjects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="block p-4 bg-white/5 border border-white/10 rounded-lg hover:border-gold/30 hover:bg-gold/5 transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-white group-hover:text-gold transition-colors">
                      {project.title}
                    </h3>
                    <p className="text-xs text-white/40 mt-1">
                      {new Date(project.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[project.status] || STATUS_COLORS.DISCOVERY}`}
                  >
                    {STATUS_LABELS[project.status] || project.status}
                  </span>
                </div>
                <p className="text-sm text-white/60">{project.type}</p>
                {project.scopeDocument && (
                  <div className="mt-3 w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-gold to-gold/70"
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
          className="bg-gold text-navy font-semibold p-6 rounded-2xl hover:bg-gold/90 transition-colors flex items-center gap-3 group"
        >
          <Plus size={24} />
          <span>New Project</span>
        </Link>
        <Link
          href="/discovery"
          className="bg-white/5 border border-white/10 text-white font-semibold p-6 rounded-2xl hover:border-gold/30 hover:bg-gold/5 transition-colors flex items-center gap-3 group"
        >
          <Users size={24} />
          <span>Find Providers</span>
        </Link>
        {recentProjects[0] && (
          <Link
            href={`/projects/${recentProjects[0].id}/scope`}
            className="bg-white/5 border border-white/10 text-white font-semibold p-6 rounded-2xl hover:border-gold/30 hover:bg-gold/5 transition-colors flex items-center gap-3 group"
          >
            <Sparkles size={24} />
            <span>AI Scope</span>
          </Link>
        )}
      </div>
    </div>
  );
}
