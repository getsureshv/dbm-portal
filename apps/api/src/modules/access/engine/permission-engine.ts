/**
 * Pure `can()` permission engine (PR2).
 *
 * Implements the central authorization decision described in
 * DBM-persona-access-module-spec.md §3.4:
 *
 *   FR-15 — can(user, action, entity, record?):
 *     1. Load the user's active personas (done by the loader; passed in here).
 *     2. Any persona permission matches (entity, action) AND its scope is
 *        satisfied for `record`  → allow.
 *     3. Any active, unexpired record grant matches (entity, recordId, action)
 *        for the user or one of their personas → allow.
 *     4. Otherwise deny.
 *   FR-16 — list endpoints translate the same logic into a query filter:
 *     scope:all OR owner=me OR id IN (participations) OR id IN (grants).
 *   FR-17 — `create` evaluates step 2 only (no record; scope ignored).
 *
 * This module is intentionally free of NestJS / Prisma so it can be unit-tested
 * in isolation. It performs no I/O and holds no state.
 */

import {
  PrincipalContext,
  RecordContext,
  Decision,
  Scope,
  PermissionGrant,
} from './types';

/** Union of every entity for which the principal holds a grant or persona. */
const has = (actions: string[], action: string): boolean =>
  actions.includes(action) || actions.includes('*');

/**
 * Does a scope hold for this record and principal?
 *  - ALL:      always.
 *  - OWN:      record.ownerId === userId.
 *  - ASSIGNED: userId ∈ record.participantIds.
 * When no record is supplied (non-create read of a collection should use the
 * scope filter instead), OWN/ASSIGNED cannot be satisfied → false.
 */
function scopeSatisfied(
  scope: Scope,
  userId: string,
  record?: RecordContext,
): boolean {
  if (scope === 'ALL') return true;
  if (!record) return false;
  if (scope === 'OWN') return !!record.ownerId && record.ownerId === userId;
  if (scope === 'ASSIGNED')
    return !!record.participantIds && record.participantIds.includes(userId);
  return false;
}

const scopeReason = (
  scope: Scope,
): Extract<
  Decision['reason'],
  'persona-scope-all' | 'persona-scope-own' | 'persona-scope-assigned'
> =>
  scope === 'ALL'
    ? 'persona-scope-all'
    : scope === 'OWN'
      ? 'persona-scope-own'
      : 'persona-scope-assigned';

/**
 * Central authorization check.
 *
 * @param ctx     resolved principal context (active personas + applicable grants)
 * @param action  e.g. "read", "update", "create", "submit"
 * @param entity  entity key, e.g. "project"
 * @param record  the record being acted on; omit for `create` (FR-17) or when
 *                evaluating a create-style permission. For reads/writes on a
 *                specific record, pass it so OWN/ASSIGNED can be evaluated.
 */
export function decide(
  ctx: PrincipalContext,
  action: string,
  entity: string,
  record?: RecordContext,
): Decision {
  const isCreate = action === 'create';

  // Step 2 — persona permission match.
  // For `create`, scope is ignored (FR-17): a matching action is enough.
  for (const persona of ctx.personas) {
    for (const perm of persona.permissions) {
      if (perm.entity !== entity) continue;
      if (!has(perm.actions, action)) continue;

      if (isCreate) {
        return { allowed: true, reason: 'create-action', via: persona.slug };
      }
      if (scopeSatisfied(perm.scope, ctx.userId, record)) {
        return { allowed: true, reason: scopeReason(perm.scope), via: persona.slug };
      }
    }
  }

  // Step 3 — record grant match (only meaningful when a record is in play).
  if (!isCreate && record) {
    for (const grant of ctx.grants) {
      if (grant.entity !== entity) continue;
      if (grant.recordId !== record.id) continue;
      if (!has(grant.actions, action)) continue;
      return { allowed: true, reason: 'record-grant', via: `grant:${grant.recordId}` };
    }
  }

  // Step 4 — deny. Distinguish "no permission at all" from "had permission but
  // scope/record didn't satisfy" purely for debug clarity; callers treat any
  // allowed=false the same (404 on read, 403 on write — enforced in PR3).
  const hadActionMatch = ctx.personas.some((p) =>
    p.permissions.some((perm) => perm.entity === entity && has(perm.actions, action)),
  );
  return {
    allowed: false,
    reason: hadActionMatch ? 'scope-not-satisfied' : 'no-matching-permission',
  };
}

/** Boolean convenience wrapper around {@link decide}. */
export function can(
  ctx: PrincipalContext,
  action: string,
  entity: string,
  record?: RecordContext,
): boolean {
  return decide(ctx, action, entity, record).allowed;
}

/**
 * FR-16 — produce the building blocks for a list/query filter for `(entity,
 * action)`. Rather than emit Prisma-specific SQL here (which would couple the
 * pure engine to the ORM), we return a structured descriptor that the NestJS
 * `scopeFilter()` helper (PR3) translates into a Prisma `where` clause.
 *
 * Semantics (union):
 *   - if any matching persona perm has scope ALL  → `all: true` (no filter; sees everything)
 *   - collect OWN      → caller filters `ownerField = userId`
 *   - collect ASSIGNED → caller filters `id IN (participations)`
 *   - always include the principal's granted record ids for this entity
 *
 * If the principal has no matching persona permission AND no grants, the result
 * is `{ all:false, own:false, assigned:false, grantedIds:[] }` → caller must
 * return an empty list (deny-by-default).
 */
export interface ScopeFilterDescriptor {
  /** Principal can see all records of this entity (admin-style). */
  all: boolean;
  /** Principal can see records they own (apply entity.ownerField = userId). */
  own: boolean;
  /** Principal can see records they participate in (apply participation join). */
  assigned: boolean;
  /** Specific record ids unlocked by record grants for this (entity, action). */
  grantedIds: string[];
  /** True when nothing matched → caller should short-circuit to empty result. */
  empty: boolean;
}

export function buildScopeFilter(
  ctx: PrincipalContext,
  action: string,
  entity: string,
): ScopeFilterDescriptor {
  let all = false;
  let own = false;
  let assigned = false;

  for (const persona of ctx.personas) {
    for (const perm of persona.permissions) {
      if (perm.entity !== entity) continue;
      if (!has(perm.actions, action)) continue;
      if (perm.scope === 'ALL') all = true;
      else if (perm.scope === 'OWN') own = true;
      else if (perm.scope === 'ASSIGNED') assigned = true;
    }
  }

  const grantedIds = ctx.grants
    .filter((g) => g.entity === entity && has(g.actions, action))
    .map((g) => g.recordId);

  const empty = !all && !own && !assigned && grantedIds.length === 0;
  return { all, own, assigned, grantedIds: [...new Set(grantedIds)], empty };
}

/** Re-exported for callers that want the matrix-cell shape. */
export type { PermissionGrant };
