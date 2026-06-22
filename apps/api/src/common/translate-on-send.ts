// Translate-on-send helper shared by the three chat services (DM, channel,
// project). When the client translates an outgoing message it sends the
// translation as `body` plus the pre-translation text as `originalBody`.
//
// Rules (per spec):
// - originalBody must be a non-empty string to be stored; blank => null.
// - if originalBody equals the stored body (no real translation), drop it.
// - originalLang is only meaningful alongside a stored originalBody.
export function normalizeOriginal(
  body: string,
  original?: { originalBody?: string; originalLang?: string },
): { originalBody: string | null; originalLang: string | null } {
  const candidate = (original?.originalBody ?? '').trim();
  if (!candidate || candidate === body) {
    return { originalBody: null, originalLang: null };
  }
  const lang = (original?.originalLang ?? '').trim();
  return { originalBody: candidate, originalLang: lang || null };
}
