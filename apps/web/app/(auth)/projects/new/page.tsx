'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { projects as projectsApi } from '../../../../lib/api';

const PROJECT_TYPES = [
  { value: 'RESIDENTIAL', label: 'Residential', description: 'Home renovation, remodel, or addition' },
  { value: 'COMMERCIAL', label: 'Commercial', description: 'Office, retail, or commercial space' },
  { value: 'NEW_BUILD', label: 'New Build', description: 'New construction from the ground up' },
] as const;

export default function NewProjectPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<string>('RESIDENTIAL');
  const [zipCode, setZipCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = title.trim() && type && zipCode.trim() && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    try {
      const project = await projectsApi.create({
        title: title.trim(),
        type,
        zipCode: zipCode.trim(),
      });
      router.push(`/projects/${project.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Back link */}
      <Link
        href="/projects"
        className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors mb-8"
      >
        <ArrowLeft size={16} />
        Back to Projects
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Project</h1>
        <p className="text-gray-500">
          Set up the basics and then use the AI Scope Architect to define your scope of work.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-600">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Project Title */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Project Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Kitchen Remodel, Office Buildout"
            className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-500 transition-colors"
            required
          />
        </div>

        {/* Project Type */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-4">
            Project Type
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PROJECT_TYPES.map((pt) => (
              <button
                key={pt.value}
                type="button"
                onClick={() => setType(pt.value)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  type === pt.value
                    ? 'bg-amber-50 border-amber-500 text-amber-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <p className="font-semibold text-sm">{pt.label}</p>
                <p className="text-xs mt-1 opacity-70">{pt.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Zip Code */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Project Zip Code
          </label>
          <input
            type="text"
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value)}
            placeholder="e.g. 75019"
            maxLength={10}
            className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-500 transition-colors"
            required
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full bg-amber-500 text-white font-semibold py-3 rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              Creating Project...
            </>
          ) : (
            'Create Project'
          )}
        </button>
      </form>
    </div>
  );
}
