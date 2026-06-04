'use client';

/**
 * Per-project Permits & Codes view. Thin shell that pre-fills the shared
 * <PermitsCodesView /> component from the project's address/zip/scope (when
 * those carry-over query params are present), and shows a "Back to project"
 * link so users don't lose their place. All real UI lives in the shared
 * component — see apps/web/components/permits-codes-view.tsx.
 */

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import PermitsCodesView, {
  ScopeValue,
} from '../../../../../components/permits-codes-view';

const VALID_SCOPES: ScopeValue[] = ['deck', 'adu', 'kitchen', 'solar'];

function isScopeValue(v: string | null): v is ScopeValue {
  return v !== null && (VALID_SCOPES as string[]).includes(v);
}

export default function ProjectJurisdictionPage() {
  const params = useParams();
  const search = useSearchParams();
  const projectId = params?.id as string;

  // Query-param carry-over from Scope or Chat surfaces (PR #19 will populate
  // these links). Falls back to no pre-fill when called directly.
  const qAddress = search?.get('address') ?? '';
  const qSlug = search?.get('slug') ?? undefined;
  const qScopeRaw = search?.get('scope');
  const qScope: ScopeValue | undefined = isScopeValue(qScopeRaw)
    ? qScopeRaw
    : undefined;
  const autoLookup = !!(qAddress && qSlug);

  return (
    <PermitsCodesView
      topSlot={
        <Link
          href={`/projects/${projectId}`}
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to project
        </Link>
      }
      initialAddress={qAddress}
      initialSlug={qSlug}
      initialScope={qScope ?? 'deck'}
      autoLookup={autoLookup}
    />
  );
}
