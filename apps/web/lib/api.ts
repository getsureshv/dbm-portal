/**
 * API client for the DBM backend.
 * Calls go to /api on the same origin and are proxied to the NestJS backend
 * via Next.js rewrites (see next.config.js → NEXT_PUBLIC_API_URL).
 */

const BASE = '/api';

// ─── Session token (Bearer) support ────────────────────────
// In addition to the httpOnly `session` cookie, we keep the session token in
// localStorage and send it as `Authorization: Bearer`. This is required for the
// public sandbox preview on *.pplx.app, where non-`__Host-` cookies are stripped
// by the proxy and the cookie-based session would otherwise be lost. Locally the
// cookie still works; the Bearer header is simply an additional, equivalent
// credential the backend already accepts (see auth.guard.ts).
const TOKEN_KEY = 'dbm_session_token';

export function setSessionToken(token: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // localStorage may be unavailable (private mode); cookie still covers local dev.
  }
}

export function getSessionToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getSessionToken();
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || `API Error: ${res.status}`);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json();
}

// ─── Types ────────────────────────────────────────────────

export interface ApiUser {
  id: string;
  email: string;
  role: 'OWNER' | 'PROVIDER' | 'ADMIN' | null;
  providerType: 'PROFESSIONAL' | 'SUPPLIER' | 'FREIGHT' | null;
  name: string | null;
  phone: string | null;
  onboardingComplete: boolean;
  verificationStatus: boolean | null;
}

export interface ApiProjectCompany {
  id: string;
  projectId: string;
  companyName: string;
  companyWebsite: string | null;
  companyPhone: string | null;
  contactFirstName: string | null;
  contactLastName: string | null;
  contactTitle: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  roleInProject: string | null;
  createdAt: string;
  updatedAt: string;
}

// Payload for a single company/contact entry when creating a project.
export interface ProjectCompanyInput {
  companyName: string;
  companyWebsite?: string;
  companyPhone?: string;
  contactFirstName?: string;
  contactLastName?: string;
  contactTitle?: string;
  contactEmail?: string;
  contactPhone?: string;
  roleInProject?: string;
}

export interface ApiProject {
  id: string;
  title: string;
  type: 'RESIDENTIAL' | 'COMMERCIAL' | 'NEW_BUILD';
  status: 'DISCOVERY' | 'BIDDING' | 'CONTRACTING' | 'EXECUTION' | 'CLOSING' | 'ARCHIVED';
  zipCode: string;
  description: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  scopeCreationMode: 'AI_ASSISTED' | 'MANUAL_UPLOAD';
  ownerId: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  documents: ApiDocument[];
  scopeDocument: ApiScopeDocument | null;
  companies?: ApiProjectCompany[];
  notes?: ApiProjectNote[];
}

// A note/comment on a project, captured with its author and timestamp.
export interface ApiProjectNote {
  id: string;
  projectId: string;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string | null; email: string };
}

export interface ApiDocument {
  id: string;
  projectId: string;
  category: string;
  filename: string;
  s3Key: string;
  extractedText: string | null;
  uploadedById: string;
  createdAt: string;
}

export interface ApiScopeDocument {
  id: string;
  projectId: string;
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETE' | 'FINALIZED';
  completenessPercent: number;
  pdfS3Key: string | null;
  projectScope: string | null;
  dimensions: string | null;
  materialGrade: string | null;
  timeline: string | null;
  milestones: string | null;
  specialConditions: string | null;
  preferredStartDate: string | null;
  siteConstraints: string | null;
  aestheticPreferences: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiVendor {
  id: string;
  name: string;
  providerType: 'professional' | 'supplier' | 'freight';
  yearsInBusiness: number | null;
  licenseStatus: string;
  trades: string[];
  rating: number | null;
  reviewCount: number;
  location: { zip: string } | null;
  distanceMiles: number | null;
  image: string | null;
}

// ─── Auth ──────────────────────────────────────────────────

export const auth = {
  createSession: (firebaseIdToken: string) =>
    request<{ user: ApiUser; token: string }>('/auth/session', {
      method: 'POST',
      body: JSON.stringify({ firebaseIdToken }),
    }),

  me: () => request<{ user: ApiUser | null }>('/auth/me'),

  logout: () => request<{ success: boolean }>('/auth/logout', { method: 'POST' }),
};

// ─── Onboarding ────────────────────────────────────────────

export const onboarding = {
  setRole: (data: { role: 'OWNER' | 'PROVIDER'; providerType?: string }) =>
    request<{ message: string; role: string; providerType: string | null }>('/onboarding/role', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  createProfile: (data: Record<string, unknown>) =>
    request<{ message: string; onboardingComplete: boolean }>('/onboarding/profile', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ─── Projects ──────────────────────────────────────────────

export const projects = {
  create: (data: {
    title: string;
    type: string;
    zipCode: string;
    description?: string;
    addressStreet?: string;
    addressCity?: string;
    addressState?: string;
    companies?: ProjectCompanyInput[];
  }) =>
    request<ApiProject>('/projects', { method: 'POST', body: JSON.stringify(data) }),

  list: () => request<ApiProject[]>('/projects'),

  get: (id: string) => request<ApiProject>(`/projects/${id}`),

  update: (id: string, data: Partial<{ title: string; description: string; type: string }>) =>
    request<ApiProject>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string) => request<void>(`/projects/${id}`, { method: 'DELETE' }),

  // Notes / comments
  listNotes: (projectId: string) =>
    request<ApiProjectNote[]>(`/projects/${projectId}/notes`),

  addNote: (projectId: string, body: string) =>
    request<ApiProjectNote>(`/projects/${projectId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),

  updateNote: (projectId: string, noteId: string, body: string) =>
    request<ApiProjectNote>(`/projects/${projectId}/notes/${noteId}`, {
      method: 'PATCH',
      body: JSON.stringify({ body }),
    }),

  deleteNote: (projectId: string, noteId: string) =>
    request<void>(`/projects/${projectId}/notes/${noteId}`, {
      method: 'DELETE',
    }),

  addDocument: (projectId: string, data: { s3Key: string; filename: string; category: string }) =>
    request<ApiDocument>(`/projects/${projectId}/documents`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  generateScopePdf: (projectId: string) =>
    request<{ downloadUrl: string; pdfS3Key: string }>(`/projects/${projectId}/scope/generate-pdf`, {
      method: 'POST',
    }),

  // ── Owner self-service access sharing ──────────────────────────────
  listGrants: (projectId: string) =>
    request<ProjectGrant[]>(`/projects/${projectId}/grants`),

  grantAccess: (
    projectId: string,
    data: { email: string; actions?: Array<'read' | 'update'>; reason?: string; expiresAt?: string },
  ) =>
    request<{ grant: { id: string }; invited: boolean }>(`/projects/${projectId}/grants`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  revokeAccess: (projectId: string, grantId: string) =>
    request<{ id: string; status: string }>(
      `/projects/${projectId}/grants/${grantId}/revoke`,
      { method: 'POST' },
    ),
};

export interface ProjectGrant {
  id: string;
  granteeId: string;
  granteeEmail: string | null;
  granteeName: string | null;
  pendingInvite: boolean;
  actions: string[];
  reason: string | null;
  status: string;
  expiresAt: string | null;
  grantedAt: string;
}

// ─── Uploads ──────────────────────────────────────────────

export const uploads = {
  presign: (data: { kind: string; contentType: string; contentLength: number }) =>
    request<{ uploadUrl: string; key: string; expiresAt: string }>('/uploads/presign', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ─── Documents ────────────────────────────────────────────

export const documents = {
  scan: (documentId: string) =>
    request<{ id: string; filename: string; extractedText: string }>(`/documents/${documentId}/scan`, {
      method: 'POST',
    }),

  getText: (documentId: string) =>
    request<{ id: string; filename: string; extractedText: string | null }>(`/documents/${documentId}/text`),

  convertToScope: (documentId: string) =>
    request<{
      isScopeDocument: boolean;
      confidence: number;
      reason?: string;
      scope?: {
        id: string;
        projectId: string;
        completenessPercent: number;
        filledFields: string[];
      };
    }>(`/documents/${documentId}/convert-to-scope`, { method: 'POST' }),

  delete: (documentId: string) =>
    request<void>(`/documents/${documentId}`, { method: 'DELETE' }),
};

// ─── Opportunities ────────────────────────────────────────

export interface ApiOpportunity {
  id: string;
  title: string;
  type: string;
  status: string;
  zipCode: string;
  createdAt: string;
  owner: {
    id: string;
    name: string | null;
  };
  scopeDocument: {
    completenessPercent: number;
    status: string;
    projectScope: string | null;
    timeline: string | null;
    preferredStartDate: string | null;
  } | null;
}

export interface ApiOpportunityDetail {
  id: string;
  title: string;
  type: string;
  status: string;
  zipCode: string;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    name: string | null;
  };
  scopeDocument: {
    completenessPercent: number;
    status: string;
    projectScope: string | null;
    dimensions: string | null;
    materialGrade: string | null;
    timeline: string | null;
    milestones: string | null;
    specialConditions: string | null;
    preferredStartDate: string | null;
    siteConstraints: string | null;
    aestheticPreferences: string | null;
  } | null;
}

export const opportunities = {
  list: (params?: { type?: string; zipCode?: string }) => {
    const qs = new URLSearchParams();
    if (params?.type) qs.set('type', params.type);
    if (params?.zipCode) qs.set('zipCode', params.zipCode);
    const queryStr = qs.toString();
    return request<ApiOpportunity[]>(
      `/projects/opportunities${queryStr ? `?${queryStr}` : ''}`,
    );
  },

  get: (id: string) =>
    request<ApiOpportunityDetail>(`/projects/opportunities/${id}`),
};

// ─── Discovery ─────────────────────────────────────────────

export interface ApiVendorDetail {
  id: string;
  providerType: string;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  phone2: string | null;
  website: string | null;
  address: Record<string, string> | null;
  yearsInBusiness: number | null;
  yearsInProfession: number | null;
  licenseNumber: string | null;
  licenseStatus: string;
  styleOfWork: string[];
  awards: string[];
  tradeName: { name: string; slug: string } | null;
  tradeCategory: { label: string } | null;
  memberSince: string;
}

export interface ApiTradeCategory {
  id: string;
  name: string;
  label: string;
  trades: { id: string; name: string; slug: string }[];
}

export interface ApiWebVendor {
  id: string;
  name: string;
  rating: number | null;
  reviewCount: number;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  distanceMiles: number | null;
  categories: string[];
  imageUrl: string | null;
  source: 'yelp' | 'serpapi' | 'google-places' | 'overpass' | 'foursquare';
  sourceLabel: string;
}

export interface ApiWebSearchResult {
  vendors: ApiWebVendor[];
  provider: 'yelp' | 'serpapi' | 'google-places' | 'overpass' | 'foursquare' | null;
  configured: boolean;
  message?: string;
}

export const discovery = {
  search: (params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    return request<{ vendors: ApiVendor[]; nextCursor?: string; total: number }>(
      `/discovery/vendors?${qs}`,
    );
  },

  searchWeb: (params: { query?: string; zip: string; category?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params.query) qs.set('query', params.query);
    qs.set('zip', params.zip);
    if (params.category) qs.set('category', params.category);
    if (params.limit) qs.set('limit', String(params.limit));
    return request<ApiWebSearchResult>(`/discovery/web-vendors?${qs.toString()}`);
  },

  getVendor: (id: string, type?: string) => {
    const qs = type ? `?type=${type}` : '';
    return request<ApiVendorDetail>(`/discovery/vendors/${id}${qs}`);
  },

  listTrades: () => request<ApiTradeCategory[]>('/discovery/trades'),
};

// ─── Provider Profile ─────────────────────────────────────

export interface ApiProviderProfile {
  id: string;
  email: string;
  role: 'OWNER' | 'PROVIDER' | 'ADMIN' | null;
  providerType: 'PROFESSIONAL' | 'SUPPLIER' | 'FREIGHT' | null;
  name: string | null;
  phone: string | null;
  profile: {
    id: string;
    firstName: string;
    lastName: string;
    companyName: string;
    phone: string;
    phone2: string | null;
    email: string;
    website: string | null;
    address: Record<string, string> | null;
    yearsInBusiness?: number | null;
    yearsInProfession?: number | null;
    licenseNumber?: string | null;
    licenseStatus: string;
    styleOfWork?: string[];
    materialTypes?: string[];
    serviceTypes?: string[];
    servicesProvided?: string[];
    awards?: string[];
    tradeCategory: { id: string; label: string } | null;
    tradeName: { id: string; name: string; slug: string } | null;
  } | null;
}

export const providers = {
  getMe: () => request<ApiProviderProfile>('/providers/me'),

  updateMe: (data: Record<string, unknown>) =>
    request<ApiProviderProfile>('/providers/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

// ─── Jurisdictions (City Integration Demo) ──────────────

export interface ApiJurisdiction {
  id: string;
  name: string;
  state: string;
  slug: string;
  vendor: 'ACCELA' | 'SHOVELS' | 'ETRAKIT' | 'ILMS' | 'MOCK';
  hasZoning: boolean;
  zipPrefixes: string[];
}

export interface ApiPermit {
  id: string;
  externalId: string;
  address: string;
  type: string | null;
  status: 'OPEN' | 'ISSUED' | 'FINALIZED' | 'EXPIRED' | 'CANCELLED' | 'UNKNOWN';
  issuedAt: string | null;
  finalizedAt: string | null;
  contractor: string | null;
  valuation: string | null;
  description: string | null;
}

export interface ApiCodeRule {
  id: string;
  codeFamily: 'IBC' | 'IRC' | 'IECC' | 'IPC' | 'IMC' | 'NEC' | 'LOCAL';
  section: string;
  title: string;
  body: string;
  scopeTags: string[];
  sourceUrl: string | null;
}

export interface PermitsResponse {
  jurisdiction: ApiJurisdiction;
  permits: ApiPermit[];
  cached: boolean;
  fetchedAt: string;
}

export const jurisdictions = {
  list: () => request<ApiJurisdiction[]>('/jurisdictions'),

  resolve: (address: string) =>
    request<{ address: string; jurisdiction: ApiJurisdiction | null }>(
      `/jurisdictions/resolve?address=${encodeURIComponent(address)}`,
    ),

  permits: (slug: string, address: string, opts: { limit?: number; force?: boolean } = {}) => {
    const params = new URLSearchParams({ address });
    if (opts.limit) params.set('limit', String(opts.limit));
    if (opts.force) params.set('force', 'true');
    return request<PermitsResponse>(`/jurisdictions/${slug}/permits?${params}`);
  },

  codeRules: (slug: string, scope?: string) => {
    const qs = scope ? `?scope=${encodeURIComponent(scope)}` : '';
    return request<ApiCodeRule[]>(`/jurisdictions/${slug}/code-rules${qs}`);
  },
};


// ─── Admin: Personas & Access (PR7/PR8) ──────────────────

export type PermissionScope = 'ALL' | 'OWN' | 'ASSIGNED';

export interface ApiPermissionRow {
  entity: string;
  actions: string[];
  scope: PermissionScope;
}

export interface ApiPersona {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  baseType: string;
  isSystem: boolean;
  status: 'ACTIVE' | 'ARCHIVED';
  requiresApproval: boolean;
  holderCount: number;
  permissions: ApiPermissionRow[];
}

export interface ApiEntity {
  key: string;
  label: string;
  actions: string[];
  supportsRecordGrants: boolean;
  ownerField: string | null;
  participantSource: string | null;
}

export interface ApiUserPersona {
  personaId: string;
  slug: string;
  name: string;
  baseType: string;
  status: 'PENDING' | 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  assignedAt: string;
  expiresAt: string | null;
}

export interface ApiUserPersonas {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string | null;
    providerType: string | null;
  };
  personas: ApiUserPersona[];
}

export interface ApiUserListItem {
  id: string;
  email: string;
  name: string | null;
  role: string | null;
  providerType: string | null;
  createdAt: string;
  personaCount: number;
  pendingCount: number;
  personas: {
    personaId: string;
    slug: string;
    name: string;
    baseType: string;
    status: 'PENDING' | 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  }[];
}

export interface ApiRecordListItem {
  id: string;
  title: string;
  type: string;
  status: string;
  zipCode: string | null;
  ownerEmail: string | null;
  ownerName: string | null;
  createdAt: string;
}

export interface ApiRecordListPage {
  items: ApiRecordListItem[];
  nextCursor: string | null;
  total: number;
}

export interface ApiPendingApproval {
  userId: string;
  user: { id: string; email: string; name: string | null };
  personaId: string;
  personaSlug: string;
  personaName: string;
  assignedAt: string;
}

export interface ApiEffectivePermissions {
  userId: string;
  personas: { slug: string; permissions: ApiPermissionRow[] }[];
  grants: unknown[];
}

export interface ApiAccessPrincipal {
  principalType: 'USER' | 'PERSONA';
  principalId: string;
  label: string;
  source: 'OWNER' | 'PARTICIPANT' | 'PERSONA_SCOPE' | 'GRANT';
  actions?: string[];
  detail?: Record<string, unknown>;
}

export interface ApiRecordGrant {
  id: string;
  entity: string;
  recordId: string;
  granteeType: 'USER' | 'PERSONA';
  granteeId: string;
  actions: string[];
  reason: string | null;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  expiresAt: string | null;
  grantedBy: string | null;
  createdAt: string;
}

export interface ApiAuditEntry {
  id: string;
  actorId: string | null;
  action: string;
  subjectType: string;
  subjectId: string | null;
  before: unknown;
  after: unknown;
  at: string;
}

export interface ApiAuditPage {
  items: ApiAuditEntry[];
  nextCursor: string | null;
}

export const admin = {
  // Personas
  listPersonas: () => request<ApiPersona[]>('/admin/personas'),
  getPersona: (id: string) => request<ApiPersona>(`/admin/personas/${id}`),
  createPersona: (data: {
    name: string;
    slug: string;
    description?: string;
    baseType: string;
    requiresApproval?: boolean;
  }) =>
    request<ApiPersona>('/admin/personas', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updatePersona: (
    id: string,
    data: Partial<{ name: string; description: string; requiresApproval: boolean }>,
  ) =>
    request<ApiPersona>(`/admin/personas/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  clonePersona: (id: string, data: { name: string; slug: string }) =>
    request<ApiPersona>(`/admin/personas/${id}/clone`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  archivePersona: (id: string, force = false) =>
    request<ApiPersona>(`/admin/personas/${id}/archive`, {
      method: 'POST',
      body: JSON.stringify({ force }),
    }),
  replacePermissions: (id: string, permissions: ApiPermissionRow[]) =>
    request<{ personaId: string; permissions: ApiPermissionRow[] }>(
      `/admin/personas/${id}/permissions`,
      { method: 'PUT', body: JSON.stringify({ permissions }) },
    ),

  // Entity registry
  listEntities: () => request<ApiEntity[]>('/admin/entities'),
  updateEntity: (
    key: string,
    data: Partial<{ label: string; actions: string[]; supportsRecordGrants: boolean }>,
  ) =>
    request<ApiEntity>(`/admin/entities/${key}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Approvals
  pendingApprovals: () => request<ApiPendingApproval[]>('/admin/approvals'),

  // User access
  listUsers: (params?: { search?: string; role?: string }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.role && params.role !== 'ALL') qs.set('role', params.role);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<ApiUserListItem[]>(`/admin/users${suffix}`);
  },
  userPersonas: (userId: string) =>
    request<ApiUserPersonas>(`/admin/users/${encodeURIComponent(userId)}/personas`),
  assignPersona: (userId: string, personaId: string, expiresAt?: string) =>
    request<unknown>(`/admin/users/${userId}/personas`, {
      method: 'POST',
      body: JSON.stringify({ personaId, expiresAt }),
    }),
  revokePersona: (userId: string, personaId: string) =>
    request<unknown>(`/admin/users/${userId}/personas/${personaId}`, {
      method: 'DELETE',
    }),
  approvePersona: (userId: string, personaId: string) =>
    request<unknown>(`/admin/users/${userId}/personas/${personaId}/approve`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  effectivePermissions: (userId: string) =>
    request<ApiEffectivePermissions>(
      `/admin/users/${userId}/effective-permissions`,
    ),

  // Record access
  listRecords: (
    entity = 'project',
    opts?: {
      search?: string;
      status?: string;
      type?: string;
      cursor?: string | null;
      limit?: number;
    },
  ) => {
    const qs = new URLSearchParams({ entity });
    if (opts?.search) qs.set('search', opts.search);
    if (opts?.status && opts.status !== 'ALL') qs.set('status', opts.status);
    if (opts?.type && opts.type !== 'ALL') qs.set('type', opts.type);
    if (opts?.cursor) qs.set('cursor', opts.cursor);
    if (opts?.limit) qs.set('limit', String(opts.limit));
    return request<ApiRecordListPage>(`/admin/users/records?${qs.toString()}`);
  },
  whoCanAccess: (entity: string, recordId: string) => {
    const qs = new URLSearchParams({ entity, recordId }).toString();
    return request<ApiAccessPrincipal[]>(`/admin/record-grants?${qs}`);
  },
  listRecordGrants: (entity: string, recordId: string) => {
    const qs = new URLSearchParams({ entity, recordId, view: 'grants' }).toString();
    return request<ApiRecordGrant[]>(`/admin/record-grants?${qs}`);
  },
  createRecordGrant: (data: {
    entity: string;
    recordId: string;
    granteeType: 'USER' | 'PERSONA';
    granteeId: string;
    actions: string[];
    reason?: string;
    expiresAt?: string;
  }) =>
    request<ApiRecordGrant>('/admin/record-grants', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  revokeRecordGrant: (id: string) =>
    request<ApiRecordGrant>(`/admin/record-grants/${id}/revoke`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  // Audit
  audit: (params: {
    action?: string;
    actorId?: string;
    subjectType?: string;
    subjectId?: string;
    cursor?: string;
    limit?: number;
  } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') qs.set(k, String(v));
    });
    const suffix = qs.toString() ? `?${qs}` : '';
    return request<ApiAuditPage>(`/admin/audit${suffix}`);
  },
};
