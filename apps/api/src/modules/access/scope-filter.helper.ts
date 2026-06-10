import { ScopeFilterDescriptor } from './engine/permission-engine';

/**
 * FR-16 — translate a {@link ScopeFilterDescriptor} (from the pure engine) into
 * a Prisma `where` fragment that services AND into their existing query.
 *
 *   const f = await permissions.scopeFilter(userId, 'read', 'project');
 *   const where = scopePrismaWhere(f, { ownerField: 'ownerId', userId });
 *   if (where === DENY_ALL) return [];           // nothing visible
 *   return prisma.project.findMany({ where: { deletedAt: null, ...where } });
 *
 * Union semantics:
 *   - all:true        → no constraint (sees everything): returns `{}`.
 *   - own:true        → `{ [ownerField]: userId }`
 *   - assigned:true   → `{ id: { in: participantRecordIds } }`  (caller supplies)
 *   - grantedIds      → `{ id: { in: grantedIds } }`
 * Multiple of the above are OR-ed. Nothing matched → DENY_ALL sentinel so the
 * caller can short-circuit to an empty result.
 */

/** Sentinel returned when the principal can see nothing for this (entity,action). */
export const DENY_ALL = Symbol('scope:deny-all');

export interface ScopePrismaOptions {
  /** Column on the entity table that holds the owner user id (for OWN). */
  ownerField?: string;
  userId: string;
  /**
   * Record ids the principal participates in (for ASSIGNED). The caller
   * resolves these from the entity's participant source (e.g. invitations).
   * Omit/empty when the entity has no participation model yet.
   */
  participantRecordIds?: string[];
  /** Column holding the record id (default "id"). */
  idField?: string;
}

/** A Prisma `where` fragment, or DENY_ALL, or {} (no constraint = see all). */
export type ScopeWhere = Record<string, any> | typeof DENY_ALL;

export function scopePrismaWhere(
  f: ScopeFilterDescriptor,
  opts: ScopePrismaOptions,
): ScopeWhere {
  if (f.all) return {}; // no constraint — sees everything.

  const idField = opts.idField ?? 'id';
  const ors: Record<string, any>[] = [];

  if (f.own && opts.ownerField) {
    ors.push({ [opts.ownerField]: opts.userId });
  }
  if (f.assigned && opts.participantRecordIds && opts.participantRecordIds.length) {
    ors.push({ [idField]: { in: opts.participantRecordIds } });
  }
  if (f.grantedIds.length) {
    ors.push({ [idField]: { in: f.grantedIds } });
  }

  if (ors.length === 0) return DENY_ALL;
  if (ors.length === 1) return ors[0];
  return { OR: ors };
}
