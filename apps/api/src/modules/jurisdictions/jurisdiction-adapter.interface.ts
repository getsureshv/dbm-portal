import { PermitStatus, JurisdictionVendor } from '@prisma/client';

/**
 * Normalized permit shape returned by every vendor adapter.
 * Adapters translate vendor-specific payloads into this shape; the rest
 * of the app never touches raw vendor JSON.
 */
export interface NormalizedPermit {
  externalId: string;
  address: string;
  type: string | null;
  status: PermitStatus;
  issuedAt: Date | null;
  finalizedAt: Date | null;
  contractor: string | null;
  valuation: number | null;
  description: string | null;
  raw: unknown;
}

export interface PermitSearchParams {
  address: string;
  limit?: number;
}

/**
 * Every city/county integration implements this. The JurisdictionService
 * picks the right adapter based on Jurisdiction.vendor.
 */
export interface JurisdictionAdapter {
  readonly vendor: JurisdictionVendor;

  /** Fetch permits for a given address. */
  getPermitsByAddress(params: PermitSearchParams): Promise<NormalizedPermit[]>;

  /** Cheap health check the controller can expose. */
  healthCheck(): Promise<{ ok: boolean; detail?: string }>;
}

/** Adapter configuration passed in by the service from Jurisdiction.adapterConfig + env. */
export interface AdapterConfig {
  jurisdictionId: string;
  slug: string;
  config: Record<string, unknown> | null;
}
