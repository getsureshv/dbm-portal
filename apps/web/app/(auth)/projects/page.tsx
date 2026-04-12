'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Calendar, Loader2 } from 'lucide-react';
import { projects as projectsApi, ApiProject } from '../../../lib/api';

const FILTERS = ['All', 'Active', 'Archived'];

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

export default function ProjectsPage() {
  const [activeFilter, setActiveFilter] = useState('All');
  const [projectList, setProjectList] = useState<ApiProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    projectsApi
      .list()
      .then(setProjectList)
      .catch(() => setProjectList([]))
      .finally(() => setLoading(false));
  }, []);

  const filteredProjects = projectList.filter((project) => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Active') return project.status !== 'ARCHIVED';
    if (activeFilter === 'Archived') return project.status === 'ARCHIVED';
    return true;
  });

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Projects</h1>
          <p className="text-white/60">Manage all your construction projects</p>
        </div>
        <Link
          href="/projects/new"
          className="bg-gold text-navy font-semibold px-6 py-2.5 rounded-lg hover:bg-gold/90 transition-colors flex items-center gap-2"
        >
          <Plus size={20} />
          New Project
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="flex gap-2">
        {FILTERS.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
              activeFilter === filter
                ? 'bg-gold text-navy'
                : 'bg-white/5 border border-white/10 text-white hover:border-white/20'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-gold" size={32} />
        </div>
      ) : (
        <>
          {/* Projects Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-gold/30 hover:bg-gold/5 transition-all group"
              >
                {/* Image Placeholder */}
                <div className="h-40 bg-gradient-to-br from-gold/20 to-white/5 flex items-center justify-center border-b border-white/10">
                  <span className="text-white/40 text-sm font-medium">{project.type}</span>
                </div>

                {/* Content */}
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-white group-hover:text-gold transition-colors leading-tight">
                      {project.title}
                    </h3>
                  </div>

                  <p className="text-sm text-white/60 mb-4">{project.zipCode}</p>

                  <div className="flex items-center gap-2 text-xs text-white/40 mb-4">
                    <Calendar size={14} />
                    {new Date(project.createdAt).toLocaleDateString()}
                  </div>

                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[project.status] || STATUS_COLORS.DISCOVERY}`}
                  >
                    {STATUS_LABELS[project.status] || project.status}
                  </span>

                  {project.scopeDocument && project.scopeDocument.completenessPercent > 0 && (
                    <div className="mt-3 w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-gold to-gold/70"
                        style={{ width: `${project.scopeDocument.completenessPercent}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {filteredProjects.length === 0 && (
            <div className="text-center py-12">
              <p className="text-white/60 text-lg">No projects found</p>
              <Link
                href="/projects/new"
                className="text-gold hover:text-gold/80 text-sm font-medium mt-2 inline-block transition-colors"
              >
                Create your first project
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
