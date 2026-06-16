/**
 * Pure access-engine types (PR2).
 *
 * Deliberately framework-free: no NestJS, no Prisma imports. Everything the
 * `can()` engine needs is passed in as plain data so the core logic can be
 * unit-tested with nothing but Node + Jest. The NestJS `PermissionsService`
 * (PR3) is responsible for loading these structures from the database and
 * caching them; the engine itself never touches I/O.
 *
 * Spec: DBM-persona-access-module-spec.md §3.4 (FR-15, FR-16, FR-17).
 */

/** Permission scope, mirrors the Prisma `PermissionScope` enum (string values). */
export type Scope = 'ALL' | 'OWN' | 'ASSIGNED';

/**
 * A single permission cell from a persona's matrix: "this persona may perform
 * these actions on this entity, limited to this scope".
 */
export interface PermissionGrant {
  entity: string; // entity key, e.g. "project"
  actions: string[]; // e.g. ["read", "update"]
  scope: Scope;
}

/**
 * One active persona the principal currently holds, with its permission matrix.
 * Only ACTIVE (non-pending, non-expired, non-revoked) personas should be passed
 * in — status/expiry filtering happens in the loader, not the engine.
 */
export interface ActivePersona {
  personaId: string;
  slug: string;
  permissions: PermissionGrant[];
}

/**
 * An active, unexpired record grant that applies to the principal — either
 * granted directly to the user, or to one of the personas they actively hold.
 * Expiry/status/persona-membership filtering happens in the loader.
 */
export interface ApplicableGrant {
  entity: string;
  recordId: string;
  actions: string[];
}

/**
 * Everything the engine needs to decide. Built once per request by the loader
 * and reused across multiple `can()` calls for the same principal.
 */
export interface PrincipalContext {
  userId: string;
  personas: ActivePersona[];
  grants: ApplicableGrant[];
}

/**
 * Facts about a concrete record, used to evaluate OWN / ASSIGNED scopes.
 * The loader resolves these from the entity registry's `ownerField` /
 * `participantSource` wiring and the record itself.
 *
 *  - `ownerId`:        the record's owner user id (resolves scope:OWN).
 *  - `participantIds`: user ids participating in the record (resolves scope:ASSIGNED).
 *
 * For a `create` action no record exists yet, so callers pass `undefined`
 * (FR-17: scope is ignored, only the persona action match matters).
 */
export interface RecordContext {
  id: string;
  ownerId?: string | null;
  participantIds?: string[];
}

/** Outcome of an authorization decision. */
export interface Decision {
  allowed: boolean;
  /** Why it was allowed/denied — useful for the effective-permissions debug view. */
  reason:
    | 'persona-scope-all'
    | 'persona-scope-own'
    | 'persona-scope-assigned'
    | 'record-grant'
    | 'create-action'
    | 'no-matching-permission'
    | 'scope-not-satisfied';
  /** The persona slug or grant that produced an allow (for audit/debug). */
  via?: string;
}
