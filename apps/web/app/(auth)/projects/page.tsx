'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Calendar, Loader2 } from 'lucide-react';
import { projects as projectsApi, ApiProject } from '../../../lib/api';

const FILTERS = ['All', 'Active', 'Archived'];

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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Projects</h1>
          <p className="text-gray-500">Manage all your construction projects</p>
        </div>
        <Link
          href="/projects/new"
          className="bg-amber-500 text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-2 shadow-sm"
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
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-300 hover:shadow-sm'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-amber-500" size={32} />
        </div>
      ) : (
        <>
          {/* Projects Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:border-amber-300 hover:shadow-lg transition-all group"
              >
                {/* Image Placeholder */}
                <div className="h-40 bg-gradient-to-br from-amber-50 to-gray-100 flex items-center justify-center border-b border-gray-200">
                  <span className="text-gray-400 text-sm font-medium">{project.type}</span>
                </div>

                {/* Content */}
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-gray-900 group-hover:text-amber-600 transition-colors leading-tight">
                      {project.title}
                    </h3>
                  </div>

                  <p className="text-sm text-gray-500 mb-4">{project.zipCode}</p>

                  <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
                    <Calendar size={14} />
                    {new Date(project.createdAt).toLocaleDateString()}
                  </div>

                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[project.status] || STATUS_COLORS.DISCOVERY}`}
                  >
                    {STATUS_LABELS[project.status] || project.status}
                  </span>

                  {project.scopeDocument && project.scopeDocument.completenessPercent > 0 && (
                    <div className="mt-3 w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full"
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
              <p className="text-gray-500 text-lg">No projects found</p>
              <Link
                href="/projects/new"
                className="text-amber-600 hover:text-amber-700 text-sm font-medium mt-2 inline-block transition-colors"
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
