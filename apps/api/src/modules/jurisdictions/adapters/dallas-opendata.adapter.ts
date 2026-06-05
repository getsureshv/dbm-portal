import { JurisdictionVendor, PermitStatus } from '@prisma/client';
import {
  AdapterConfig,
  NormalizedPermit,
} from '../jurisdiction-adapter.interface';
import {
  SocrataAdapter,
  mapRecordWith,
  mapStatusGeneric,
  parseDateGeneric,
  normalizeAddressForQuery as normalizeAddressForQueryGeneric,
  stripLeadingNumber as stripLeadingNumberGeneric,
} from './socrata.adapter';

/**
 * Dallas OpenData (Socrata) adapter — REAL permit data, no auth.
 *
 * This is now a THIN PRESET over the generic {@link SocrataAdapter} (PR #20).
 * All Socrata mechanics (SoQL query, field mapping, mock fallback, health
 * check) live in the generic adapter; this file only pins the Dallas dataset
 * and the field names that dataset uses, so existing behavior is unchanged.
 *
 *   Dataset: e7gq-4sah  "Building Permits"   (~56k rows; primary year 2019)
 *   Endpoint: https://www.dallasopendata.com/resource/e7gq-4sah.json
 *
 * We chose Dallas OpenData over the Accela Construct API for this demo because
 * the Construct API requires per-agency partnership credentials, while Socrata
 * is fully public. The Accela adapter is preserved so a Citizen-Access tenant
 * can be wired without a rewrite.
 *
 * Env (optional, raises throttling thresholds):
 *   DALLAS_OPENDATA_APP_TOKEN  (falls back to SOCRATA_APP_TOKEN)
 */
export class DallasOpenDataAdapter extends SocrataAdapter {
  constructor(cfg: AdapterConfig) {
    super(cfg, {
      vendor: JurisdictionVendor.DALLAS_OPENDATA,
      domain: 'www.dallasopendata.com',
      datasetId: 'e7gq-4sah',
      appToken: process.env.DALLAS_OPENDATA_APP_TOKEN,
      idPrefix: 'DALLAS',
      // Dallas e7gq-4sah column names. permit_status is absent in this dataset,
      // so every row resolves to ISSUED — preserved from the original adapter.
      fieldMap: {
        externalId: 'permit_number',
        type: ['permit_type', 'land_use'],
        status: 'permit_status',
        issuedAt: 'issued_date',
        contractor: 'contractor',
        valuation: 'value',
        description: 'work_description',
        address: 'street_address',
        zip: 'zip_code',
      },
      addressField: 'street_address',
      orderBy: 'issued_date DESC',
    });
  }
}

// ── Back-compat exported helpers ─────────────────────────────────────────────
// The original Dallas adapter exported these; keep them so existing imports
// and the dallas-opendata.adapter.spec.ts suite continue to work unchanged.
// They now delegate to the generic Socrata helpers.

interface DallasOpenDataRecord {
  permit_number?: string;
  permit_type?: string;
  issued_date?: string;
  permit_status?: string;
  mapsco?: string;
  contractor?: string;
  value?: string;
  area?: string;
  work_description?: string;
  land_use?: string;
  street_address?: string;
  zip_code?: string;
}

/** @deprecated use mapStatusGeneric — kept for back-compat. */
export function mapStatus(raw: string | null | undefined): PermitStatus {
  return mapStatusGeneric(raw);
}

/** @deprecated use parseDateGeneric — kept for back-compat. */
export function parseIssuedDate(raw: string | null | undefined): Date | null {
  return parseDateGeneric(raw);
}

/** Map a Dallas e7gq-4sah record using the Dallas field map. */
export function mapRecord(r: DallasOpenDataRecord): NormalizedPermit {
  return mapRecordWith(
    r as Record<string, unknown>,
    {
      externalId: 'permit_number',
      type: ['permit_type', 'land_use'],
      status: 'permit_status',
      issuedAt: 'issued_date',
      contractor: 'contractor',
      valuation: 'value',
      description: 'work_description',
      address: 'street_address',
      zip: 'zip_code',
    },
    'DALLAS',
  );
}

export const normalizeAddressForQuery = normalizeAddressForQueryGeneric;
export const stripLeadingNumber = stripLeadingNumberGeneric;
