'use client';

/**
 * Standalone Permits & Codes lookup — sidebar entry point.
 * No project context required. Shows sample addresses as quick-start chips.
 */

import { useSearchParams } from 'next/navigation';
import PermitsCodesView, {
  ScopeValue,
} from '../../../components/permits-codes-view';

const VALID_SCOPES: ScopeValue[] = ['deck', 'adu', 'kitchen', 'solar'];

function isScopeValue(v: string | null): v is ScopeValue {
  return v !== null && (VALID_SCOPES as string[]).includes(v);
}

export default function PermitsStandalonePage() {
  // Allow deep-linking (e.g. from homepage hero in PR #20)
  const search = useSearchParams();
  const qAddress = search?.get('address') ?? '';
  const qSlug = search?.get('slug') ?? undefined;
  const qScopeRaw = search?.get('scope');
  const qScope: ScopeValue | undefined = isScopeValue(qScopeRaw)
    ? qScopeRaw
    : undefined;
  const autoLookup = !!(qAddress && qSlug);

  return (
    <PermitsCodesView
      title="Permits & Codes"
      subtitle="Look up real building permits by address and see the code rules that apply — no project required. Pick a city, paste an address, choose a scope."
      initialAddress={qAddress}
      initialSlug={qSlug}
      initialScope={qScope ?? 'deck'}
      autoLookup={autoLookup}
      showSamples
    />
  );
}
