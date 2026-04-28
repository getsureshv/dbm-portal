/**
 * API client for the DBM backend.
 * Calls are proxied via Next.js rewrites to NestJS at localhost:4000.
 */

const BASE = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
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

export interface ApiProject {
  id: string;
  title: string;
  type: 'RESIDENTIAL' | 'COMMERCIAL' | 'NEW_BUILD';
  status: 'DISCOVERY' | 'BIDDING' | 'CONTRACTING' | 'EXECUTION' | 'CLOSING' | 'ARCHIVED';
  zipCode: string;
  description: string | null;
  scopeCreationMode: 'AI_ASSISTED' | 'MANUAL_UPLOAD';
  ownerId: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  documents: ApiDocument[];
  scopeDocument: ApiScopeDocument | null;
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
  create: (data: { title: string; type: string; zipCode: string; description?: string }) =>
    request<ApiProject>('/projects', { method: 'POST', body: JSON.stringify(data) }),

  list: () => request<ApiProject[]>('/projects'),

  get: (id: string) => request<ApiProject>(`/projects/${id}`),

  update: (id: string, data: Partial<{ title: string; description: string; type: string }>) =>
    request<ApiProject>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string) => request<void>(`/projects/${id}`, { method: 'DELETE' }),

  addDocument: (projectId: string, data: { s3Key: string; filename: string; category: string }) =>
    request<ApiDocument>(`/projects/${projectId}/documents`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  generateScopePdf: (projectId: string) =>
    request<{ downloadUrl: string; pdfS3Key: string }>(`/projects/${projectId}/scope/generate-pdf`, {
      method: 'POST',
    }),
};

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

