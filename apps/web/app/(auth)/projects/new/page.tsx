'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, AlertCircle, Plus, Trash2, Building2 } from 'lucide-react';
import Link from 'next/link';
import { projects as projectsApi, type ProjectCompanyInput } from '../../../../lib/api';

const PROJECT_TYPES = [
  { value: 'RESIDENTIAL', label: 'Residential', description: 'Home renovation, remodel, or addition' },
  { value: 'COMMERCIAL', label: 'Commercial', description: 'Office, retail, or commercial space' },
  { value: 'NEW_BUILD', label: 'New Build', description: 'New construction from the ground up' },
] as const;

// A single company/contact row in local form state.
interface CompanyRow {
  companyName: string;
  companyWebsite: string;
  companyPhone: string;
  contactFirstName: string;
  contactLastName: string;
  contactTitle: string;
  contactEmail: string;
  contactPhone: string;
  roleInProject: string;
}

const emptyCompany = (): CompanyRow => ({
  companyName: '',
  companyWebsite: '',
  companyPhone: '',
  contactFirstName: '',
  contactLastName: '',
  contactTitle: '',
  contactEmail: '',
  contactPhone: '',
  roleInProject: '',
});

const fieldClass =
  'w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-500 transition-colors';

export default function NewProjectPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<string>('RESIDENTIAL');
  const [zipCode, setZipCode] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressState, setAddressState] = useState('');
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = title.trim() && type && zipCode.trim() && !submitting;

  // Only the title, type, and ZIP are required. Surface what is still missing
  // so a disabled button never looks like the companies section is blocking it.
  const missingRequired = [
    !title.trim() && 'a project title',
    !zipCode.trim() && 'a ZIP code',
  ].filter(Boolean) as string[];

  const addCompany = () => setCompanies((prev) => [...prev, emptyCompany()]);
  const removeCompany = (index: number) =>
    setCompanies((prev) => prev.filter((_, i) => i !== index));
  const updateCompany = (index: number, field: keyof CompanyRow, value: string) =>
    setCompanies((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    // Only send companies that have a name; trim everything, drop empties.
    const companyPayload: ProjectCompanyInput[] = companies
      .filter((c) => c.companyName.trim())
      .map((c) => {
        const clean = (v: string) => {
          const t = v.trim();
          return t ? t : undefined;
        };
        return {
          companyName: c.companyName.trim(),
          companyWebsite: clean(c.companyWebsite),
          companyPhone: clean(c.companyPhone),
          contactFirstName: clean(c.contactFirstName),
          contactLastName: clean(c.contactLastName),
          contactTitle: clean(c.contactTitle),
          contactEmail: clean(c.contactEmail),
          contactPhone: clean(c.contactPhone),
          roleInProject: clean(c.roleInProject),
        };
      });

    try {
      const project = await projectsApi.create({
        title: title.trim(),
        type,
        zipCode: zipCode.trim(),
        ...(addressStreet.trim() && { addressStreet: addressStreet.trim() }),
        ...(addressCity.trim() && { addressCity: addressCity.trim() }),
        ...(addressState.trim() && { addressState: addressState.trim() }),
        ...(companyPayload.length > 0 && { companies: companyPayload }),
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
            className={fieldClass}
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

        {/* Project Location */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-4">
            Project Location
          </label>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Zip Code
              </label>
              <input
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="e.g. 75019"
                maxLength={10}
                className={fieldClass}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Street Address <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                value={addressStreet}
                onChange={(e) => setAddressStreet(e.target.value)}
                placeholder="e.g. 123 Main St"
                className={fieldClass}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  City <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={addressCity}
                  onChange={(e) => setAddressCity(e.target.value)}
                  placeholder="e.g. Coppell"
                  className={fieldClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  State <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={addressState}
                  onChange={(e) => setAddressState(e.target.value)}
                  placeholder="e.g. TX"
                  className={fieldClass}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Companies & Contacts */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">
              Companies & Contacts
            </label>
            <span className="text-xs text-gray-400">Optional</span>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Capture the companies involved and a contact person for each, along with their
            role in the project.
          </p>

          <div className="space-y-4">
            {companies.map((company, index) => (
              <div
                key={index}
                className="border border-gray-200 rounded-xl p-4 bg-gray-50/50"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Building2 size={16} className="text-amber-500" />
                    <span className="text-sm font-medium">
                      Company {index + 1}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCompany(index)}
                    className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={14} />
                    Remove
                  </button>
                </div>

                {/* Company details */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      Company Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={company.companyName}
                      onChange={(e) => updateCompany(index, 'companyName', e.target.value)}
                      placeholder="e.g. Acme Construction LLC"
                      className={fieldClass}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">
                        Website
                      </label>
                      <input
                        type="text"
                        value={company.companyWebsite}
                        onChange={(e) =>
                          updateCompany(index, 'companyWebsite', e.target.value)
                        }
                        placeholder="e.g. acme.com"
                        className={fieldClass}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">
                        Company Phone
                      </label>
                      <input
                        type="text"
                        value={company.companyPhone}
                        onChange={(e) =>
                          updateCompany(index, 'companyPhone', e.target.value)
                        }
                        placeholder="e.g. (555) 123-4567"
                        className={fieldClass}
                      />
                    </div>
                  </div>

                  {/* Role in project */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      Role in Project
                    </label>
                    <input
                      type="text"
                      value={company.roleInProject}
                      onChange={(e) =>
                        updateCompany(index, 'roleInProject', e.target.value)
                      }
                      placeholder="e.g. General Contractor, Architect, Plumber"
                      className={fieldClass}
                    />
                  </div>

                  {/* Contact person */}
                  <div className="pt-3 mt-1 border-t border-gray-200">
                    <p className="text-xs font-semibold text-gray-600 mb-3">
                      Contact Person
                    </p>
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1.5">
                            First Name
                          </label>
                          <input
                            type="text"
                            value={company.contactFirstName}
                            onChange={(e) =>
                              updateCompany(index, 'contactFirstName', e.target.value)
                            }
                            placeholder="e.g. Jane"
                            className={fieldClass}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1.5">
                            Last Name
                          </label>
                          <input
                            type="text"
                            value={company.contactLastName}
                            onChange={(e) =>
                              updateCompany(index, 'contactLastName', e.target.value)
                            }
                            placeholder="e.g. Doe"
                            className={fieldClass}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">
                          Title
                        </label>
                        <input
                          type="text"
                          value={company.contactTitle}
                          onChange={(e) =>
                            updateCompany(index, 'contactTitle', e.target.value)
                          }
                          placeholder="e.g. Project Manager"
                          className={fieldClass}
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1.5">
                            Email
                          </label>
                          <input
                            type="email"
                            value={company.contactEmail}
                            onChange={(e) =>
                              updateCompany(index, 'contactEmail', e.target.value)
                            }
                            placeholder="e.g. jane@acme.com"
                            className={fieldClass}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1.5">
                            Phone
                          </label>
                          <input
                            type="text"
                            value={company.contactPhone}
                            onChange={(e) =>
                              updateCompany(index, 'contactPhone', e.target.value)
                            }
                            placeholder="e.g. (555) 987-6543"
                            className={fieldClass}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addCompany}
              className="w-full inline-flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-3 text-sm font-medium text-gray-600 hover:border-amber-400 hover:text-amber-600 transition-colors"
            >
              <Plus size={16} />
              {companies.length === 0 ? 'Add Company' : 'Add Another Company'}
            </button>
          </div>
        </div>

        {/* Submit */}
        <div>
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
          {!submitting && missingRequired.length > 0 && (
            <p className="mt-2 text-center text-xs text-gray-500">
              Add {missingRequired.join(' and ')} to create the project. Companies
              and contacts are optional.
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
