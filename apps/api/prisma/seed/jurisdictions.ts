/**
 * Demo seed for city integration: Dallas + Flower Mound + curated code rules.
 *
 * Run standalone:  pnpm -F api exec tsx prisma/seed/jurisdictions.ts
 * Or call from index.ts:  await seedJurisdictions(prisma)
 */
import { PrismaClient, JurisdictionVendor, CodeFamily } from '@prisma/client';

export async function seedJurisdictions(prisma: PrismaClient) {
  console.log('🏛  Seeding jurisdictions...');

  const dallas = await prisma.jurisdiction.upsert({
    where: { slug: 'dallas-tx' },
    update: {
      vendor: JurisdictionVendor.ACCELA,
      zipPrefixes: ['752', '753'],
    },
    create: {
      name: 'City of Dallas',
      state: 'TX',
      slug: 'dallas-tx',
      vendor: JurisdictionVendor.ACCELA,
      hasZoning: true,
      zipPrefixes: ['752', '753'],
      adapterConfig: { agency: 'DALLAS_TX' },
    },
  });

  const flowerMound = await prisma.jurisdiction.upsert({
    where: { slug: 'flower-mound-tx' },
    update: {
      vendor: JurisdictionVendor.SHOVELS,
      zipPrefixes: ['75022', '75028'],
    },
    create: {
      name: 'Town of Flower Mound',
      state: 'TX',
      slug: 'flower-mound-tx',
      vendor: JurisdictionVendor.SHOVELS,
      hasZoning: true,
      zipPrefixes: ['75022', '75028'],
      adapterConfig: { jurisdiction: 'Flower Mound,TX' },
    },
  });

  const houston = await prisma.jurisdiction.upsert({
    where: { slug: 'houston-tx' },
    update: {
      vendor: JurisdictionVendor.MOCK, // Wave 3 — mock for now
      zipPrefixes: ['770', '771', '772'],
    },
    create: {
      name: 'City of Houston',
      state: 'TX',
      slug: 'houston-tx',
      vendor: JurisdictionVendor.MOCK,
      hasZoning: true,
      zipPrefixes: ['770', '771', '772'],
      adapterConfig: { note: 'Wave 3 — ILMS adapter pending' },
    },
  });

  // ── Curated code rules ────────────────────────────────────
  // 2-3 rules per scope (deck, adu, kitchen, solar) per active jurisdiction.
  // Sources cited in sourceUrl where available; bodies are demo-summarized.

  const rules: Array<{
    jurisdictionId: string;
    codeFamily: CodeFamily;
    section: string;
    title: string;
    body: string;
    scopeTags: string[];
    sourceUrl: string | null;
  }> = [
    // ── DALLAS — DECK ─────────────────────────────────────
    {
      jurisdictionId: dallas.id,
      codeFamily: CodeFamily.IRC,
      section: 'R507.2',
      title: 'Deck materials',
      body: 'All deck framing lumber in contact with the ground or supporting weather-exposed surfaces shall be preservative-treated or naturally durable. Fasteners and connectors must be hot-dip galvanized, stainless steel, silicon bronze, or copper.',
      scopeTags: ['deck'],
      sourceUrl: 'https://codes.iccsafe.org/content/IRC2021P2/chapter-5-floors#IRC2021P2_Pt03_Ch05_SecR507',
    },
    {
      jurisdictionId: dallas.id,
      codeFamily: CodeFamily.IRC,
      section: 'R507.9',
      title: 'Deck ledger attachment',
      body: 'Ledgers must be attached to the band joist with through-bolts or lag screws per Table R507.9.1.3. Toenailing alone is prohibited. Flashing required at ledger-to-wall interface.',
      scopeTags: ['deck'],
      sourceUrl: 'https://codes.iccsafe.org/content/IRC2021P2',
    },
    {
      jurisdictionId: dallas.id,
      codeFamily: CodeFamily.LOCAL,
      section: 'DAL-DCC-51A-4.401',
      title: 'Dallas zoning — accessory structure setbacks',
      body: 'In single-family districts, accessory decks > 30 in. above grade must observe a 5 ft side and rear yard setback. Decks ≤ 30 in. above grade may extend to the property line if no roof is attached.',
      scopeTags: ['deck', 'adu'],
      sourceUrl: 'https://dallascityhall.com/departments/sustainabledevelopment',
    },

    // ── DALLAS — ADU ──────────────────────────────────────
    {
      jurisdictionId: dallas.id,
      codeFamily: CodeFamily.LOCAL,
      section: 'DAL-DCC-51A-4.501',
      title: 'Dallas ADU — size and parking',
      body: 'Detached accessory dwelling units are limited to 25% of the main structure floor area or 700 sq ft, whichever is less. One additional off-street parking space required.',
      scopeTags: ['adu'],
      sourceUrl: 'https://dallascityhall.com',
    },
    {
      jurisdictionId: dallas.id,
      codeFamily: CodeFamily.IRC,
      section: 'R302.1',
      title: 'ADU fire separation from property line',
      body: 'Exterior walls less than 5 ft from a property line require 1-hour fire-resistance-rated construction. Openings prohibited within 3 ft; limited (25% max) between 3-5 ft.',
      scopeTags: ['adu'],
      sourceUrl: 'https://codes.iccsafe.org/content/IRC2021P2',
    },

    // ── DALLAS — KITCHEN ──────────────────────────────────
    {
      jurisdictionId: dallas.id,
      codeFamily: CodeFamily.IRC,
      section: 'R602.7',
      title: 'Load-bearing wall — header sizing',
      body: 'Headers in load-bearing walls must be sized per Table R602.7(1). For an 8 ft opening with one story above plus roof, a double 2x10 with ½" plywood spacer is the minimum.',
      scopeTags: ['kitchen'],
      sourceUrl: 'https://codes.iccsafe.org/content/IRC2021P2',
    },
    {
      jurisdictionId: dallas.id,
      codeFamily: CodeFamily.NEC,
      section: 'NEC 210.52(C)',
      title: 'Kitchen receptacle spacing',
      body: 'Countertop receptacles must be installed so no point along the wall countertop is more than 24 in. from a receptacle. Islands ≥ 12 sq ft require at least one receptacle.',
      scopeTags: ['kitchen'],
      sourceUrl: 'https://www.nfpa.org/codes-and-standards/all-codes-and-standards/list-of-codes-and-standards/detail?code=70',
    },

    // ── DALLAS — SOLAR ────────────────────────────────────
    {
      jurisdictionId: dallas.id,
      codeFamily: CodeFamily.IRC,
      section: 'R324',
      title: 'Rooftop solar PV systems',
      body: 'Rooftop PV must comply with IRC R324 and NEC Article 690. Roof must support PV dead load + snow/wind loads. Setbacks: 3 ft from ridge and edges unless an alternate path is approved.',
      scopeTags: ['solar'],
      sourceUrl: 'https://codes.iccsafe.org/content/IRC2021P2',
    },
    {
      jurisdictionId: dallas.id,
      codeFamily: CodeFamily.NEC,
      section: 'NEC 690.12',
      title: 'PV rapid shutdown',
      body: 'PV system circuits on or in buildings must include a rapid-shutdown function reducing controlled conductors to ≤ 30 V within 30 s of initiation. Initiation device at service equipment required.',
      scopeTags: ['solar'],
      sourceUrl: 'https://www.nfpa.org',
    },

    // ── FLOWER MOUND — DECK ───────────────────────────────
    {
      jurisdictionId: flowerMound.id,
      codeFamily: CodeFamily.IRC,
      section: 'R507.2',
      title: 'Deck materials (FM amendment)',
      body: 'Flower Mound adopts IRC R507 with local amendment: all decks > 200 sq ft require an engineer-stamped ledger detail. Composite decking allowed when listed and labeled.',
      scopeTags: ['deck'],
      sourceUrl: 'https://www.flower-mound.com/166/Building-Inspections',
    },
    {
      jurisdictionId: flowerMound.id,
      codeFamily: CodeFamily.LOCAL,
      section: 'FM-ZONE-98-30',
      title: 'Flower Mound zoning — rear yard decks',
      body: 'Decks in single-family residential zones must maintain a minimum 10 ft rear-yard setback when attached to the principal structure and >30 in. above grade.',
      scopeTags: ['deck', 'adu'],
      sourceUrl: 'https://www.flower-mound.com',
    },

    // ── FLOWER MOUND — ADU ────────────────────────────────
    {
      jurisdictionId: flowerMound.id,
      codeFamily: CodeFamily.LOCAL,
      section: 'FM-ZONE-98-42',
      title: 'Flower Mound — accessory dwelling restrictions',
      body: 'Flower Mound prohibits independent accessory dwelling units on lots < 1 acre. On qualifying lots, detached structures > 400 sq ft require a Specific Use Permit.',
      scopeTags: ['adu'],
      sourceUrl: 'https://www.flower-mound.com',
    },

    // ── FLOWER MOUND — KITCHEN ────────────────────────────
    {
      jurisdictionId: flowerMound.id,
      codeFamily: CodeFamily.IECC,
      section: 'N1102.4',
      title: 'Air sealing on remodel',
      body: 'Kitchen remodels disturbing > 50% of exterior wall area must meet IECC N1102.4.1 air sealing and blower-door verification ≤ 5 ACH50.',
      scopeTags: ['kitchen'],
      sourceUrl: 'https://codes.iccsafe.org/content/IECC2021P2',
    },
    {
      jurisdictionId: flowerMound.id,
      codeFamily: CodeFamily.NEC,
      section: 'NEC 210.8(A)(6)',
      title: 'GFCI protection at kitchen counters',
      body: 'All 125-volt, single-phase, 15- and 20-amp receptacles serving kitchen countertop surfaces must have ground-fault circuit-interrupter protection. Includes any receptacle within 6 ft of a sink. Flower Mound enforces 2020 NEC.',
      scopeTags: ['kitchen'],
      sourceUrl: 'https://www.nfpa.org/codes-and-standards/all-codes-and-standards/list-of-codes-and-standards/detail?code=70',
    },

    // ── FLOWER MOUND — SOLAR ──────────────────────────────
    {
      jurisdictionId: flowerMound.id,
      codeFamily: CodeFamily.LOCAL,
      section: 'FM-ZONE-98-65',
      title: 'Flower Mound — solar panel placement',
      body: 'Roof-mounted PV must be flush-mounted within 6 in. of the roof plane. Ground-mounted arrays prohibited in front yards and require a 10 ft setback from any property line.',
      scopeTags: ['solar'],
      sourceUrl: 'https://www.flower-mound.com',
    },
    {
      jurisdictionId: flowerMound.id,
      codeFamily: CodeFamily.IRC,
      section: 'R324.4',
      title: 'Rooftop PV — fire access pathways',
      body: 'Rooftop PV arrays on single-family dwellings must preserve a 36 in. clear pathway from eave to ridge on at least one side of each roof plane with installed PV, and 18 in. setbacks from hips and ridges for firefighter access.',
      scopeTags: ['solar'],
      sourceUrl: 'https://codes.iccsafe.org/content/IRC2021P2/chapter-3-building-planning#IRC2021P2_Pt03_Ch03_SecR324',
    },
  ];

  for (const r of rules) {
    await prisma.codeRule.upsert({
      where: {
        jurisdictionId_codeFamily_section: {
          jurisdictionId: r.jurisdictionId,
          codeFamily: r.codeFamily,
          section: r.section,
        },
      },
      update: { title: r.title, body: r.body, scopeTags: r.scopeTags, sourceUrl: r.sourceUrl },
      create: r,
    });
  }

  console.log(
    `  ✓ Jurisdictions: ${dallas.slug}, ${flowerMound.slug}, ${houston.slug}`,
  );
  console.log(`  ✓ Code rules: ${rules.length}`);
}

// Allow standalone invocation
if (require.main === module) {
  const prisma = new PrismaClient();
  seedJurisdictions(prisma)
    .catch((e) => {
      console.error('❌ Jurisdiction seed failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
