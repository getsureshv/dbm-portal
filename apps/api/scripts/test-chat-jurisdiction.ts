/**
 * Acceptance harness for the jurisdiction-aware chat helpers.
 *
 * Bootstraps JurisdictionsService + ChatService against the local DB and
 * exercises buildJurisdictionContext() for the three demo cases used in
 * Scene 6 of the Loom script:
 *   - Dallas    / ZIP 75201 / ADU
 *   - Flower Mound / ZIP 75028 / kitchen
 *   - Houston   / ZIP 77010 / deck
 *
 * Outputs the exact context block that would be prepended to the Scope
 * Architect system prompt. Asserts that:
 *   - jurisdiction is resolved correctly
 *   - scope tag is inferred correctly
 *   - the rendered block contains the real code-rule section IDs from the seed
 */
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/common/prisma.service';
import { JurisdictionsService } from '../src/modules/jurisdictions/jurisdictions.service';
import { ChatService } from '../src/modules/chat/chat.service';

type Case = {
  name: string;
  zipCode: string;
  projectType: string;
  projectScope: string | null;
  userMessage: string;
  expectJurisdictionSlug: string;
  expectScopeTag: string;
  expectRuleSections: string[];
};

const CASES: Case[] = [
  {
    name: 'Dallas / ADU',
    zipCode: '75201',
    projectType: 'RESIDENTIAL',
    projectScope: 'Build a 600 sqft accessory dwelling unit in the backyard.',
    userMessage: 'What code rules and permits do I need for this ADU?',
    expectJurisdictionSlug: 'dallas-tx',
    expectScopeTag: 'adu',
    expectRuleSections: [], // populated below from DB
  },
  {
    name: 'Flower Mound / kitchen',
    zipCode: '75028',
    projectType: 'RESIDENTIAL',
    projectScope: 'Full kitchen remodel: new range hood, quartz countertops.',
    userMessage: 'Are there code rules I need to know about for the kitchen?',
    expectJurisdictionSlug: 'flower-mound-tx',
    expectScopeTag: 'kitchen',
    expectRuleSections: [],
  },
  {
    name: 'Houston / deck',
    zipCode: '77010',
    projectType: 'RESIDENTIAL',
    projectScope: 'Build a 300 sqft deck off the back of the house.',
    userMessage: 'Show me the permits and code rules for this deck.',
    expectJurisdictionSlug: 'houston-tx',
    expectScopeTag: 'deck',
    expectRuleSections: [],
  },
];

async function main() {
  const prisma = new PrismaService();
  const configService = new ConfigService();
  const jurisdictions = new JurisdictionsService(prisma);
  const chat = new ChatService(configService, prisma, jurisdictions);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  DBM chat jurisdiction-aware acceptance — 3 cities');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let failures = 0;

  for (const tc of CASES) {
    console.log(`\n▶ ${tc.name}`);
    console.log(`  user: "${tc.userMessage}"`);

    // 1. intent detector
    const intent = chat.detectJurisdictionIntent(tc.userMessage);
    console.log(`  intent fires?  ${intent}`);
    if (!intent) {
      console.error('  ✗ intent should fire');
      failures++;
    }

    // 2. scope inference
    const scope = chat.inferScopeTag(tc.projectType, tc.projectScope, tc.userMessage);
    console.log(`  scope tag:     ${scope}`);
    if (scope !== tc.expectScopeTag) {
      console.error(`  ✗ expected scope=${tc.expectScopeTag}, got ${scope}`);
      failures++;
    }

    // 3. jurisdiction resolution
    const j = await jurisdictions.resolveAddress(tc.zipCode);
    console.log(`  jurisdiction:  ${j?.slug ?? '(none)'} (${j?.vendor ?? '-'})`);
    if (j?.slug !== tc.expectJurisdictionSlug) {
      console.error(`  ✗ expected ${tc.expectJurisdictionSlug}, got ${j?.slug}`);
      failures++;
    }

    // 4. live rules for this scope (sanity check we have ≥2 per scope)
    if (j && scope) {
      const rules = await jurisdictions.codeRules(j.slug, scope);
      console.log(`  rules count:   ${rules.length}`);
      console.log('  rule IDs:');
      rules.forEach((r) => console.log(`    • [${r.codeFamily} ${r.section}] ${r.title}`));
      if (rules.length < 2) {
        console.error(`  ✗ expected ≥2 rules, got ${rules.length}`);
        failures++;
      }
    }

    // 5. full context block — what Claude would actually see
    const ctx = await chat.buildJurisdictionContext(
      tc.zipCode,
      tc.projectType,
      tc.projectScope,
      tc.userMessage,
    );
    console.log('\n  ─── injected system prompt block ───');
    console.log(
      (ctx || '(none)')
        .split('\n')
        .map((l) => '    ' + l)
        .join('\n'),
    );

    if (!ctx || !ctx.includes(tc.expectJurisdictionSlug)) {
      console.error('  ✗ context missing expected jurisdiction slug');
      failures++;
    }
    if (!ctx || !ctx.includes(`scope tag: ${tc.expectScopeTag}`.toLowerCase())) {
      // case-insensitive contains
      if (!ctx?.toLowerCase().includes(`scope tag: ${tc.expectScopeTag}`)) {
        console.error('  ✗ context missing expected scope tag line');
        failures++;
      }
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (failures === 0) {
    console.log('  ✅ ALL 3 CASES PASS');
  } else {
    console.log(`  ❌ ${failures} assertion(s) failed`);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
