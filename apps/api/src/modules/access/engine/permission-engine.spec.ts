import { decide, can, buildScopeFilter } from './permission-engine';
import {
  PrincipalContext,
  ActivePersona,
  ApplicableGrant,
  RecordContext,
} from './types';

// ── helpers ──────────────────────────────────────────────────
const ME = 'user-me';
const OTHER = 'user-other';

function persona(slug: string, perms: ActivePersona['permissions']): ActivePersona {
  return { personaId: `p-${slug}`, slug, permissions: perms };
}

function ctx(
  personas: ActivePersona[],
  grants: ApplicableGrant[] = [],
  userId = ME,
): PrincipalContext {
  return { userId, personas, grants };
}

const myProject: RecordContext = { id: 'proj-1', ownerId: ME, participantIds: [] };
const othersProject: RecordContext = {
  id: 'proj-2',
  ownerId: OTHER,
  participantIds: [],
};
const assignedProject: RecordContext = {
  id: 'proj-3',
  ownerId: OTHER,
  participantIds: [ME, 'someone-else'],
};

// ── FR-15 step 2: persona scope ALL ──────────────────────────
describe('persona scope ALL (admin-style)', () => {
  const admin = ctx([
    persona('admin', [{ entity: 'project', actions: ['read', 'update', 'delete'], scope: 'ALL' }]),
  ]);

  it('allows reading any record regardless of owner', () => {
    expect(can(admin, 'read', 'project', othersProject)).toBe(true);
    expect(can(admin, 'update', 'project', othersProject)).toBe(true);
  });

  it('reports the allowing reason and via slug', () => {
    const d = decide(admin, 'read', 'project', othersProject);
    expect(d).toMatchObject({ allowed: true, reason: 'persona-scope-all', via: 'admin' });
  });

  it('denies an action the persona does not have', () => {
    expect(can(admin, 'create', 'project')).toBe(false);
  });
});

// ── FR-15 step 2: scope OWN ──────────────────────────────────
describe('persona scope OWN', () => {
  const client = ctx([
    persona('client', [{ entity: 'project', actions: ['read', 'update', 'delete'], scope: 'OWN' }]),
  ]);

  it('allows acting on a record I own', () => {
    expect(can(client, 'read', 'project', myProject)).toBe(true);
    expect(can(client, 'update', 'project', myProject)).toBe(true);
  });

  it("denies acting on someone else's record", () => {
    expect(can(client, 'read', 'project', othersProject)).toBe(false);
    expect(can(client, 'update', 'project', othersProject)).toBe(false);
  });

  it('reports scope-not-satisfied when action matched but ownership failed', () => {
    expect(decide(client, 'read', 'project', othersProject).reason).toBe('scope-not-satisfied');
  });

  it('denies when no record is supplied (OWN cannot be evaluated)', () => {
    expect(can(client, 'read', 'project')).toBe(false);
  });
});

// ── FR-15 step 2: scope ASSIGNED ─────────────────────────────
describe('persona scope ASSIGNED', () => {
  const contractor = ctx([
    persona('general-contractor', [{ entity: 'project', actions: ['read'], scope: 'ASSIGNED' }]),
  ]);

  it('allows reading a project I participate in', () => {
    expect(can(contractor, 'read', 'project', assignedProject)).toBe(true);
    expect(decide(contractor, 'read', 'project', assignedProject).reason).toBe(
      'persona-scope-assigned',
    );
  });

  it('denies reading a project I am not assigned to', () => {
    expect(can(contractor, 'read', 'project', othersProject)).toBe(false);
  });

  it('denies an action not granted even on an assigned project', () => {
    expect(can(contractor, 'update', 'project', assignedProject)).toBe(false);
  });
});

// ── FR-17: create path ignores scope ─────────────────────────
describe('create action (FR-17) — scope ignored, no record', () => {
  const client = ctx([
    persona('client', [{ entity: 'project', actions: ['create', 'read'], scope: 'OWN' }]),
  ]);

  it('allows create with no record present', () => {
    expect(can(client, 'create', 'project')).toBe(true);
    expect(decide(client, 'create', 'project').reason).toBe('create-action');
  });

  it('denies create when the persona lacks the create action', () => {
    const readonly = ctx([
      persona('viewer', [{ entity: 'project', actions: ['read'], scope: 'OWN' }]),
    ]);
    expect(can(readonly, 'create', 'project')).toBe(false);
  });
});

// ── FR-15 step 3: record grants ──────────────────────────────
describe('record grants (FR-15.3)', () => {
  // A freight user with no persona scope on projects, but an explicit grant.
  const freightWithGrant = ctx(
    [persona('freight', [{ entity: 'project', actions: ['read'], scope: 'ASSIGNED' }])],
    [{ entity: 'project', recordId: 'proj-2', actions: ['read'] }],
  );

  it('allows access to the granted record even without ownership/participation', () => {
    expect(can(freightWithGrant, 'read', 'project', othersProject)).toBe(true);
    expect(decide(freightWithGrant, 'read', 'project', othersProject)).toMatchObject({
      allowed: true,
      reason: 'record-grant',
      via: 'grant:proj-2',
    });
  });

  it('does not leak the grant to other records or actions', () => {
    const another: RecordContext = { id: 'proj-99', ownerId: OTHER };
    expect(can(freightWithGrant, 'read', 'project', another)).toBe(false);
    expect(can(freightWithGrant, 'update', 'project', othersProject)).toBe(false);
  });

  it('grant does not apply to create (no record)', () => {
    expect(can(freightWithGrant, 'create', 'project')).toBe(false);
  });
});

// ── Union model: multiple personas combine (acceptance criterion) ──
describe('union of multiple personas', () => {
  // Same login holds both client (OWN projects) and contractor (ASSIGNED read).
  const dual = ctx([
    persona('client', [{ entity: 'project', actions: ['read', 'update'], scope: 'OWN' }]),
    persona('general-contractor', [{ entity: 'project', actions: ['read'], scope: 'ASSIGNED' }]),
  ]);

  it('applies both sets of permissions simultaneously', () => {
    expect(can(dual, 'update', 'project', myProject)).toBe(true); // via client/OWN
    expect(can(dual, 'read', 'project', assignedProject)).toBe(true); // via contractor/ASSIGNED
  });

  it('still denies what neither persona allows', () => {
    expect(can(dual, 'delete', 'project', assignedProject)).toBe(false);
  });
});

// ── Wildcard action support ──────────────────────────────────
describe('wildcard actions', () => {
  const superuser = ctx([
    persona('admin', [{ entity: 'project', actions: ['*'], scope: 'ALL' }]),
  ]);
  it('matches any action via "*"', () => {
    expect(can(superuser, 'archive', 'project', othersProject)).toBe(true);
    expect(can(superuser, 'create', 'project')).toBe(true);
  });
});

// ── Deny-by-default ──────────────────────────────────────────
describe('deny by default', () => {
  const empty = ctx([]);
  it('denies everything with no personas or grants', () => {
    expect(can(empty, 'read', 'project', myProject)).toBe(false);
    expect(decide(empty, 'read', 'project', myProject).reason).toBe('no-matching-permission');
  });

  it('denies an entity the principal has no permissions on', () => {
    const client = ctx([
      persona('client', [{ entity: 'project', actions: ['read'], scope: 'OWN' }]),
    ]);
    expect(can(client, 'read', 'invoice', { id: 'inv-1', ownerId: ME })).toBe(false);
  });
});

// ── FR-16: scope filter descriptor ───────────────────────────
describe('buildScopeFilter (FR-16)', () => {
  it('flags all:true for an ALL-scope persona', () => {
    const admin = ctx([persona('admin', [{ entity: 'project', actions: ['read'], scope: 'ALL' }])]);
    expect(buildScopeFilter(admin, 'read', 'project')).toMatchObject({
      all: true,
      empty: false,
    });
  });

  it('flags own:true for an OWN-scope persona', () => {
    const client = ctx([
      persona('client', [{ entity: 'project', actions: ['read'], scope: 'OWN' }]),
    ]);
    expect(buildScopeFilter(client, 'read', 'project')).toMatchObject({
      all: false,
      own: true,
      assigned: false,
    });
  });

  it('unions own + assigned across personas and includes granted ids', () => {
    const dual = ctx(
      [
        persona('client', [{ entity: 'project', actions: ['read'], scope: 'OWN' }]),
        persona('gc', [{ entity: 'project', actions: ['read'], scope: 'ASSIGNED' }]),
      ],
      [
        { entity: 'project', recordId: 'g1', actions: ['read'] },
        { entity: 'project', recordId: 'g1', actions: ['read'] }, // dup → deduped
        { entity: 'invoice', recordId: 'i1', actions: ['read'] }, // other entity → excluded
      ],
    );
    const f = buildScopeFilter(dual, 'read', 'project');
    expect(f.own).toBe(true);
    expect(f.assigned).toBe(true);
    expect(f.grantedIds).toEqual(['g1']);
    expect(f.empty).toBe(false);
  });

  it('marks empty when nothing matches → caller returns empty list', () => {
    const client = ctx([
      persona('client', [{ entity: 'project', actions: ['read'], scope: 'OWN' }]),
    ]);
    expect(buildScopeFilter(client, 'read', 'invoice')).toMatchObject({ empty: true });
  });

  it('grant for a different action is not included', () => {
    const c = ctx(
      [persona('client', [{ entity: 'project', actions: ['read'], scope: 'OWN' }])],
      [{ entity: 'project', recordId: 'g1', actions: ['update'] }],
    );
    expect(buildScopeFilter(c, 'read', 'project').grantedIds).toEqual([]);
  });
});

// ── collection / list reads (recordless): the guard must allow an OWN/ASSIGNED
// persona through; buildScopeFilter then narrows the actual rows. Regression
// guard for the bug where GET /projects 404'd for every non-ALL persona. ──────
describe('collection reads (no record in play)', () => {
  const clientCtx = ctx([
    persona('client', [{ entity: 'project', actions: ['read', 'update'], scope: 'OWN' }]),
  ]);
  const assignedCtx = ctx([
    persona('gc', [{ entity: 'project', actions: ['read'], scope: 'ASSIGNED' }]),
  ]);
  const adminCtx = ctx([
    persona('admin', [{ entity: 'project', actions: ['read'], scope: 'ALL' }]),
  ]);
  const noneCtx = ctx([
    persona('client', [{ entity: 'document', actions: ['read'], scope: 'OWN' }]),
  ]);

  it('OWN-scoped persona is ALLOWED to read the collection (collection=true)', () => {
    expect(decide(clientCtx, 'read', 'project', undefined, true).allowed).toBe(true);
  });

  it('ASSIGNED-scoped persona is ALLOWED to read the collection', () => {
    expect(decide(assignedCtx, 'read', 'project', undefined, true).allowed).toBe(true);
  });

  it('ALL-scoped persona is ALLOWED to read the collection', () => {
    expect(decide(adminCtx, 'read', 'project', undefined, true).allowed).toBe(true);
  });

  it('persona with NO matching entity permission is DENIED', () => {
    expect(decide(noneCtx, 'read', 'project', undefined, true).allowed).toBe(false);
  });

  it('a record grant on the entity unlocks the collection read', () => {
    const grantOnly = ctx(
      [persona('viewer', [])],
      [{ entity: 'project', recordId: 'proj-9', actions: ['read'] }],
    );
    expect(decide(grantOnly, 'read', 'project', undefined, true).allowed).toBe(true);
  });

  it('without collection=true, an OWN persona recordless read still denies (record-level semantics unchanged)', () => {
    expect(decide(clientCtx, 'read', 'project', undefined, false).allowed).toBe(false);
  });

  it('record-level checks are unchanged: OWN persona allowed on own record, denied on others', () => {
    expect(decide(clientCtx, 'read', 'project', myProject).allowed).toBe(true);
    expect(decide(clientCtx, 'read', 'project', othersProject).allowed).toBe(false);
  });
});
