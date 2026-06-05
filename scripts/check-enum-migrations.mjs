#!/usr/bin/env node
/**
 * Migration safety guard — enum "ADD VALUE then USE in the same transaction".
 *
 * WHY THIS EXISTS
 * ---------------
 * PostgreSQL forbids referencing a newly-added enum value inside the SAME
 * transaction that added it:
 *
 *     ALTER TYPE "JurisdictionVendor" ADD VALUE 'SOCRATA';
 *     INSERT INTO "Jurisdiction" (vendor, ...) VALUES ('SOCRATA', ...);  -- 💥
 *
 * Prisma wraps each migration file in one transaction, so a single migration
 * that does both fails at `prisma migrate deploy`. Our container entrypoint
 * runs `set -e`, so that aborts API startup entirely — a real outage that only
 * shows up in deploy logs AFTER merge.
 *
 * This guard scans each migration.sql and FAILS CI if a file both adds an enum
 * value and references that same value later in the same file. The fix is
 * always: split it into two migrations (add the value in one, use it in the
 * next), or move the data use into the seed (which runs as a separate step).
 *
 * Scope (intentionally narrow — this is a tripwire, not a migration linter):
 *   - only the enum add-then-use-in-same-file pattern
 *   - per-file (Prisma's transaction boundary is the file)
 *
 * Usage:
 *   node scripts/check-enum-migrations.mjs [migrationsDir]
 * Exit 0 = clean, 1 = violation(s) found, 2 = usage/IO error.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIR =
  process.argv[2] ?? 'apps/api/prisma/migrations';

/** Strip SQL comments + string literals so value-uses aren't matched inside
 *  comments or unrelated text we want to ignore. We KEEP string literals for
 *  detecting the value in INSERT/UPDATE, so instead we only strip line/block
 *  comments. */
function stripComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // /* block */
    .replace(/--[^\n]*/g, ' '); // -- line
}

/** Find all enum values ADDed in this SQL. */
function addedEnumValues(sql) {
  const re =
    /ALTER\s+TYPE\s+"?[\w".]+"?\s+ADD\s+VALUE\s+(?:IF\s+NOT\s+EXISTS\s+)?'([^']+)'/gi;
  const vals = [];
  let m;
  while ((m = re.exec(sql)) !== null) vals.push(m[1]);
  return vals;
}

/**
 * Does the SQL *use* `value` somewhere that is NOT the ADD VALUE statement?
 * We look for the quoted value in INSERT/UPDATE/WHERE/CAST contexts. To avoid
 * matching the ADD VALUE line itself, we blank those out first.
 */
function usesValueOutsideAdd(sql, value) {
  const withoutAdds = sql.replace(
    /ALTER\s+TYPE\s+"?[\w".]+"?\s+ADD\s+VALUE\s+(?:IF\s+NOT\s+EXISTS\s+)?'[^']+'\s*;?/gi,
    ' ',
  );
  // Match the value as a SQL string literal, e.g. 'SOCRATA' or = 'SOCRATA'
  const esc = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const useRe = new RegExp(`'${esc}'`);
  return useRe.test(withoutAdds);
}

function main() {
  let dirStat;
  try {
    dirStat = statSync(DIR);
  } catch {
    console.log(`[enum-guard] No migrations dir at "${DIR}" — nothing to check.`);
    process.exit(0);
  }
  if (!dirStat.isDirectory()) {
    console.error(`[enum-guard] "${DIR}" is not a directory.`);
    process.exit(2);
  }

  const files = [];
  for (const entry of readdirSync(DIR)) {
    const sub = join(DIR, entry);
    try {
      if (statSync(sub).isDirectory()) {
        const sql = join(sub, 'migration.sql');
        try {
          statSync(sql);
          files.push(sql);
        } catch {
          /* no migration.sql in this dir */
        }
      }
    } catch {
      /* unreadable entry; skip */
    }
  }

  const violations = [];
  for (const file of files) {
    const raw = readFileSync(file, 'utf8');
    const sql = stripComments(raw);
    const added = addedEnumValues(sql);
    for (const value of added) {
      if (usesValueOutsideAdd(sql, value)) {
        violations.push({ file, value });
      }
    }
  }

  if (violations.length === 0) {
    console.log(
      `[enum-guard] OK — checked ${files.length} migration file(s); no enum add-and-use-in-same-transaction found.`,
    );
    process.exit(0);
  }

  console.error('\n[enum-guard] ❌ Unsafe migration(s) detected:\n');
  for (const v of violations) {
    console.error(
      `  • ${v.file}\n      adds enum value '${v.value}' AND references it in the same migration (same transaction).`,
    );
  }
  console.error(
    `\nPostgreSQL cannot use a new enum value in the transaction that added it,\n` +
      `so this will fail at \`prisma migrate deploy\` and block API startup.\n\n` +
      `FIX: split into two migrations —\n` +
      `  1) one migration with ONLY \`ALTER TYPE ... ADD VALUE 'X';\`\n` +
      `  2) a later migration (or the seed) that INSERTs/UPDATEs using 'X'.\n`,
  );
  process.exit(1);
}

main();
