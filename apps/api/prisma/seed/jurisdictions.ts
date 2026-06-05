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
      vendor: JurisdictionVendor.DALLAS_OPENDATA,
      zipPrefixes: ['752', '753'],
      countryCode: 'US',
      timezone: 'America/Chicago',
      measurementSystem: 'IMPERIAL',
      defaultCurrency: 'USD',
      adapterConfig: {
        datasetId: 'e7gq-4sah',
        domain: 'www.dallasopendata.com',
      },
    },
    create: {
      name: 'City of Dallas',
      state: 'TX',
      slug: 'dallas-tx',
      vendor: JurisdictionVendor.DALLAS_OPENDATA,
      hasZoning: true,
      zipPrefixes: ['752', '753'],
      countryCode: 'US',
      timezone: 'America/Chicago',
      measurementSystem: 'IMPERIAL',
      defaultCurrency: 'USD',
      adapterConfig: {
        datasetId: 'e7gq-4sah',
        domain: 'www.dallasopendata.com',
      },
    },
  });

  const flowerMound = await prisma.jurisdiction.upsert({
    where: { slug: 'flower-mound-tx' },
    update: {
      vendor: JurisdictionVendor.SHOVELS,
      zipPrefixes: ['75022', '75028'],
      countryCode: 'US',
      timezone: 'America/Chicago',
      measurementSystem: 'IMPERIAL',
      defaultCurrency: 'USD',
    },
    create: {
      name: 'Town of Flower Mound',
      state: 'TX',
      slug: 'flower-mound-tx',
      vendor: JurisdictionVendor.SHOVELS,
      hasZoning: true,
      zipPrefixes: ['75022', '75028'],
      countryCode: 'US',
      timezone: 'America/Chicago',
      measurementSystem: 'IMPERIAL',
      defaultCurrency: 'USD',
      adapterConfig: { jurisdiction: 'Flower Mound,TX' },
    },
  });

  const houston = await prisma.jurisdiction.upsert({
    where: { slug: 'houston-tx' },
    update: {
      vendor: JurisdictionVendor.SHOVELS,
      zipPrefixes: ['770', '771', '772'],
      countryCode: 'US',
      timezone: 'America/Chicago',
      measurementSystem: 'IMPERIAL',
      defaultCurrency: 'USD',
      adapterConfig: { jurisdiction: 'Houston,TX' },
    },
    create: {
      name: 'City of Houston',
      state: 'TX',
      slug: 'houston-tx',
      vendor: JurisdictionVendor.SHOVELS,
      hasZoning: true,
      zipPrefixes: ['770', '771', '772'],
      countryCode: 'US',
      timezone: 'America/Chicago',
      measurementSystem: 'IMPERIAL',
      defaultCurrency: 'USD',
      adapterConfig: { jurisdiction: 'Houston,TX' },
    },
  });

  // ── Curated code rules (richer rewrite — PR #19) ──────────
  // 24 rules across deck / adu / kitchen / solar for the three active
  // jurisdictions. Each body follows a Trigger → Required → Verify structure
  // and names its governing IRC/IBC/IECC/NEC sections inline so the frontend
  // citation auto-linker can deep-link them to the official free code viewers.
  // sourceUrl points at the precise section anchor where one exists.

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
      body: 'Trigger: any deck with framing in contact with the ground or supporting a weather-exposed walking surface. Required: per IRC R507.2 all such lumber shall be naturally durable or preservative-treated, and connectors/fasteners shall be hot-dip galvanized, stainless steel, silicon bronze, or copper. Verify: inspector checks the lumber grade stamp and fastener listing at framing inspection.',
      scopeTags: ['deck'],
      sourceUrl: 'https://codes.iccsafe.org/content/IRC2021P2/chapter-5-floors#IRC2021P2_Pt03_Ch05_SecR507.2',
    },
    {
      jurisdictionId: dallas.id,
      codeFamily: CodeFamily.IRC,
      section: 'R507.9',
      title: 'Deck ledger attachment',
      body: 'Trigger: a deck ledger attached to the house band joist. Required: per IRC R507.9.1.3 the ledger must be fastened with through-bolts or lag screws on the prescribed spacing schedule — toenailing alone is prohibited — and IRC R703.4 flashing is required at the ledger-to-wall interface. Verify: framing inspection confirms fastener type/spacing and continuous flashing before decking is installed.',
      scopeTags: ['deck'],
      sourceUrl: 'https://codes.iccsafe.org/content/IRC2021P2/chapter-5-floors#IRC2021P2_Pt03_Ch05_SecR507.9',
    },
    {
      jurisdictionId: dallas.id,
      codeFamily: CodeFamily.LOCAL,
      section: 'DAL-DCC-51A-4.401',
      title: 'Dallas zoning — accessory structure setbacks',
      body: 'Trigger: an accessory deck in a single-family zoning district. Required: per Dallas Development Code §51A-4.401, decks more than 30 in. above grade must observe a 5 ft side and rear yard setback; decks 30 in. or less above grade with no attached roof may extend to the property line. Verify: zoning plan review checks the deck height above grade and the platted setback lines before permit issuance.',
      scopeTags: ['deck', 'adu'],
      sourceUrl: 'https://dallascityhall.com/departments/sustainabledevelopment',
    },

    // ── DALLAS — ADU ──────────────────────────────────────
    {
      jurisdictionId: dallas.id,
      codeFamily: CodeFamily.LOCAL,
      section: 'DAL-DCC-51A-4.501',
      title: 'Dallas ADU — size and parking',
      body: 'Trigger: a detached accessory dwelling unit (ADU) on a single-family lot. Required: per Dallas Development Code §51A-4.501, the ADU is limited to the lesser of 25% of the main structure floor area or 700 sq ft, and one additional off-street parking space is required. Verify: site plan review confirms the floor-area ratio and the added parking space prior to permit.',
      scopeTags: ['adu'],
      sourceUrl: 'https://dallascityhall.com',
    },
    {
      jurisdictionId: dallas.id,
      codeFamily: CodeFamily.IRC,
      section: 'R302.1',
      title: 'ADU fire separation from property line',
      body: 'Trigger: an ADU exterior wall closer than 5 ft to a property line. Required: per IRC R302.1 (Table R302.1(1)) that wall must be 1-hour fire-resistance-rated; openings are prohibited within 3 ft of the line and limited to 25% of wall area between 3 ft and 5 ft. Verify: plan review measures the fire-separation distance and inspection confirms the rated assembly and opening limits.',
      scopeTags: ['adu'],
      sourceUrl: 'https://codes.iccsafe.org/content/IRC2021P2/chapter-3-building-planning#IRC2021P2_Pt03_Ch03_SecR302.1',
    },

    // ── DALLAS — KITCHEN ──────────────────────────────────
    {
      jurisdictionId: dallas.id,
      codeFamily: CodeFamily.IRC,
      section: 'R602.7',
      title: 'Load-bearing wall — header sizing',
      body: 'Trigger: removing or opening a load-bearing wall during a kitchen remodel. Required: per IRC R602.7 headers must be sized from Table R602.7(1) — e.g. an 8 ft opening carrying one story plus roof needs at minimum a double 2x10 with a ½" plywood spacer. Verify: a stamped header detail or the prescriptive table value is confirmed at rough-frame inspection.',
      scopeTags: ['kitchen'],
      sourceUrl: 'https://codes.iccsafe.org/content/IRC2021P2/chapter-6-wall-construction#IRC2021P2_Pt03_Ch06_SecR602.7',
    },
    {
      jurisdictionId: dallas.id,
      codeFamily: CodeFamily.NEC,
      section: 'NEC 210.52(C)',
      title: 'Kitchen receptacle spacing',
      body: 'Trigger: new or relocated countertop receptacles in a kitchen remodel. Required: per NEC 210.52(C) receptacles must be placed so no point along a wall countertop is more than 24 in. from a receptacle, and each island or peninsula countertop space requires at least one receptacle. Verify: rough electrical inspection measures spacing against the countertop layout.',
      scopeTags: ['kitchen'],
      sourceUrl: 'https://link.nfpa.org/free-access/publications/70/2023',
    },

    // ── DALLAS — SOLAR ────────────────────────────────────
    {
      jurisdictionId: dallas.id,
      codeFamily: CodeFamily.IRC,
      section: 'R324',
      title: 'Rooftop solar PV systems',
      body: 'Trigger: a rooftop photovoltaic (PV) installation on a dwelling. Required: per IRC R324 the roof structure must support the PV dead load plus snow/wind loads, and the electrical work must comply with NEC Article 690; fire-access setbacks of 3 ft from the ridge and roof edges apply unless an alternate access path is approved. Verify: a structural review of the roof framing plus an electrical inspection to NEC Article 690 are both required before final.',
      scopeTags: ['solar'],
      sourceUrl: 'https://codes.iccsafe.org/content/IRC2021P2/chapter-3-building-planning#IRC2021P2_Pt03_Ch03_SecR324',
    },
    {
      jurisdictionId: dallas.id,
      codeFamily: CodeFamily.NEC,
      section: 'NEC 690.12',
      title: 'PV rapid shutdown',
      body: 'Trigger: any PV system circuit on or in a building. Required: per NEC 690.12 the system must include a rapid-shutdown function that reduces controlled conductors to 30 V or less within 30 seconds of initiation, with an initiation device located at the service equipment. Verify: the electrical inspector tests the rapid-shutdown initiator and confirms labeling at the service.',
      scopeTags: ['solar'],
      sourceUrl: 'https://link.nfpa.org/free-access/publications/70/2023',
    },

    // ── FLOWER MOUND — DECK ───────────────────────────────
    {
      jurisdictionId: flowerMound.id,
      codeFamily: CodeFamily.IRC,
      section: 'R507.2',
      title: 'Deck materials (FM amendment)',
      body: 'Trigger: a deck in Flower Mound, especially one over 200 sq ft. Required: the town adopts IRC R507 with a local amendment requiring an engineer-stamped ledger detail for any deck larger than 200 sq ft; composite decking is permitted when listed and labeled. Verify: building inspections reviews the stamped detail at plan submittal and confirms listed material at framing inspection.',
      scopeTags: ['deck'],
      sourceUrl: 'https://codes.iccsafe.org/content/IRC2021P2/chapter-5-floors#IRC2021P2_Pt03_Ch05_SecR507.2',
    },
    {
      jurisdictionId: flowerMound.id,
      codeFamily: CodeFamily.LOCAL,
      section: 'FM-ZONE-98-30',
      title: 'Flower Mound zoning — rear yard decks',
      body: 'Trigger: a deck in a single-family residential zone, attached to the principal structure and more than 30 in. above grade. Required: per Flower Mound zoning ordinance §98-30 the deck must maintain a minimum 10 ft rear-yard setback. Verify: zoning plan review checks the setback against the platted rear lot line before permit issuance.',
      scopeTags: ['deck', 'adu'],
      sourceUrl: 'https://www.flower-mound.com',
    },

    // ── FLOWER MOUND — ADU ────────────────────────────────
    {
      jurisdictionId: flowerMound.id,
      codeFamily: CodeFamily.LOCAL,
      section: 'FM-ZONE-98-42',
      title: 'Flower Mound — accessory dwelling restrictions',
      body: 'Trigger: a proposed accessory dwelling unit in Flower Mound. Required: per zoning ordinance §98-42 independent ADUs are prohibited on lots smaller than 1 acre, and on qualifying lots any detached structure over 400 sq ft requires a Specific Use Permit. Verify: planning confirms lot area and, where applicable, an approved SUP before the building permit is released.',
      scopeTags: ['adu'],
      sourceUrl: 'https://www.flower-mound.com',
    },

    // ── FLOWER MOUND — KITCHEN ────────────────────────────
    {
      jurisdictionId: flowerMound.id,
      codeFamily: CodeFamily.IECC,
      section: 'N1102.4',
      title: 'Air sealing on remodel',
      body: 'Trigger: a kitchen remodel disturbing more than 50% of an exterior wall area. Required: per IECC N1102.4.1 the building thermal envelope must be air-sealed and verified by a blower-door test at 5 ACH50 or less. Verify: a third-party blower-door test report is submitted before the energy final.',
      scopeTags: ['kitchen'],
      sourceUrl: 'https://codes.iccsafe.org/content/IECC2021P1/chapter-4-re-residential-energy-efficiency',
    },
    {
      jurisdictionId: flowerMound.id,
      codeFamily: CodeFamily.NEC,
      section: 'NEC 210.8(A)(6)',
      title: 'GFCI protection at kitchen counters',
      body: 'Trigger: 125-volt, single-phase, 15- and 20-amp receptacles serving kitchen countertop surfaces (Flower Mound enforces the 2020 NEC). Required: per NEC 210.8(A)(6) all such receptacles must have ground-fault circuit-interrupter (GFCI) protection, including any receptacle within 6 ft of a sink. Verify: rough and final electrical inspections confirm GFCI protection at each countertop receptacle.',
      scopeTags: ['kitchen'],
      sourceUrl: 'https://link.nfpa.org/free-access/publications/70/2023',
    },

    // ── FLOWER MOUND — SOLAR ──────────────────────────────
    {
      jurisdictionId: flowerMound.id,
      codeFamily: CodeFamily.LOCAL,
      section: 'FM-ZONE-98-65',
      title: 'Flower Mound — solar panel placement',
      body: 'Trigger: a residential solar PV installation in Flower Mound. Required: per zoning ordinance §98-65 roof-mounted PV must be flush-mounted within 6 in. of the roof plane, and ground-mounted arrays are prohibited in front yards and must keep a 10 ft setback from any property line. Verify: zoning review checks the mounting height and array location against the site plan.',
      scopeTags: ['solar'],
      sourceUrl: 'https://www.flower-mound.com',
    },
    {
      jurisdictionId: flowerMound.id,
      codeFamily: CodeFamily.IRC,
      section: 'R324.4',
      title: 'Rooftop PV — fire access pathways',
      body: 'Trigger: a rooftop PV array on a single-family dwelling. Required: per IRC R324.6 (fire-fighter access) the array must preserve a 36 in. clear eave-to-ridge pathway on at least one side of each roof plane carrying PV, plus 18 in. setbacks from hips and ridges. Verify: the fire-access pathway layout is confirmed at PV plan review and at final inspection.',
      scopeTags: ['solar'],
      sourceUrl: 'https://codes.iccsafe.org/content/IRC2021P2/chapter-3-building-planning#IRC2021P2_Pt03_Ch03_SecR324',
    },

    // ── HOUSTON — DECK ────────────────────────────────────
    {
      jurisdictionId: houston.id,
      codeFamily: CodeFamily.IRC,
      section: 'R507.2',
      title: 'Deck materials & fasteners (Houston amendment)',
      body: 'Trigger: a deck in Houston, where humidity and termite exposure are high. Required: the city adopts IRC R507.2 with local amendments — all wood in ground contact must be Use-Category UC4A pressure-treated, and stainless or hot-dip galvanized fasteners are required in coastal-exposure conditions (within 3 mi of Galveston Bay). Verify: framing inspection checks the treatment tag and fastener listing.',
      scopeTags: ['deck'],
      sourceUrl: 'https://codes.iccsafe.org/content/IRC2021P2/chapter-5-floors#IRC2021P2_Pt03_Ch05_SecR507.2',
    },
    {
      jurisdictionId: houston.id,
      codeFamily: CodeFamily.LOCAL,
      section: 'HOU-CCC-10-101',
      title: 'Houston — accessory structure permit threshold',
      body: 'Trigger: a deck or similar accessory structure over 200 sq ft or more than 30 in. above grade in Houston. Required: per City Code Ch. 10-101 a building permit and engineered drawings are required; Houston has no zoning, but deed restrictions and the Chapter 42 development ordinance govern setbacks. Verify: permitting reviews the engineered drawings and the structure size/height before issuing the permit.',
      scopeTags: ['deck', 'adu'],
      sourceUrl: 'https://www.houstonpermittingcenter.org',
    },

    // ── HOUSTON — ADU ─────────────────────────────────────
    {
      jurisdictionId: houston.id,
      codeFamily: CodeFamily.LOCAL,
      section: 'HOU-CH42-204',
      title: 'Houston ADU — Chapter 42 lot & setback rules',
      body: 'Trigger: an ADU (locally a "garage apartment") on a single-family lot in Houston. Required: per Chapter 42 §204 such lots must provide 5 ft side setbacks and 10 ft rear setbacks, and the ADU height is capped at the height of the main dwelling. Verify: development review confirms the setbacks and height cap against the site plan before permit.',
      scopeTags: ['adu'],
      sourceUrl: 'https://www.houstontx.gov/planning/DevelopRegs/',
    },
    {
      jurisdictionId: houston.id,
      codeFamily: CodeFamily.IRC,
      section: 'R302.1',
      title: 'ADU fire separation from property line',
      body: 'Trigger: an ADU exterior wall less than 5 ft from a property line (Houston enforces the 2021 IRC). Required: per IRC R302.1 that wall must be 1-hour fire-resistance-rated; openings are prohibited within 3 ft of the line and limited to 25% of wall area between 3 ft and 5 ft. Verify: plan review measures the fire-separation distance and inspection confirms the rated assembly.',
      scopeTags: ['adu'],
      sourceUrl: 'https://codes.iccsafe.org/content/IRC2021P2/chapter-3-building-planning#IRC2021P2_Pt03_Ch03_SecR302.1',
    },

    // ── HOUSTON — KITCHEN ─────────────────────────────────
    {
      jurisdictionId: houston.id,
      codeFamily: CodeFamily.NEC,
      section: 'NEC 210.8(A)(6)',
      title: 'GFCI protection at kitchen counters',
      body: 'Trigger: 125-volt, single-phase, 15- and 20-amp kitchen countertop receptacles (Houston enforces the 2020 NEC with no local amendment to this section). Required: per NEC 210.8(A)(6) all such receptacles must be GFCI-protected, including any receptacle within 6 ft of a sink. Verify: final electrical inspection confirms GFCI protection at every countertop receptacle.',
      scopeTags: ['kitchen'],
      sourceUrl: 'https://link.nfpa.org/free-access/publications/70/2023',
    },
    {
      jurisdictionId: houston.id,
      codeFamily: CodeFamily.IRC,
      section: 'M1503.4',
      title: 'Kitchen exhaust — makeup air',
      body: 'Trigger: a kitchen exhaust hood rated over 400 CFM. Required: per IRC M1503.4 an equivalent powered makeup-air system, interlocked with the hood, must be provided; in Houston climate zone 2A negative-pressure backdrafting is a real combustion-safety risk. Verify: mechanical inspection confirms the interlocked makeup-air system on every kitchen remodel that adds a high-CFM hood.',
      scopeTags: ['kitchen'],
      sourceUrl: 'https://codes.iccsafe.org/content/IRC2021P2/chapter-15-exhaust-systems#IRC2021P2_Pt06_Ch15_SecM1503.4',
    },

    // ── HOUSTON — SOLAR ───────────────────────────────────
    {
      jurisdictionId: houston.id,
      codeFamily: CodeFamily.IRC,
      section: 'R324',
      title: 'Rooftop solar PV — wind & uplift (Houston)',
      body: 'Trigger: rooftop PV in Houston, ASCE 7 wind exposure C with a 140 mph design wind speed (Vult). Required: per IRC R324 the PV racking and roof structure must be designed for the resulting uplift, and PE-stamped wind calculations are required for systems larger than 4 kW; electrical work also follows NEC Article 690. Verify: structural plan review confirms the stamped uplift calculations before permit.',
      scopeTags: ['solar'],
      sourceUrl: 'https://codes.iccsafe.org/content/IRC2021P2/chapter-3-building-planning#IRC2021P2_Pt03_Ch03_SecR324',
    },
    {
      jurisdictionId: houston.id,
      codeFamily: CodeFamily.NEC,
      section: 'NEC 690.12',
      title: 'PV rapid shutdown',
      body: 'Trigger: any PV system circuit on or in a building (Houston enforces the 2020 NEC). Required: per NEC 690.12 the system must include a rapid-shutdown function reducing controlled conductors to 30 V or less within 30 seconds of initiation, with an initiation device at the service equipment. Verify: the electrical inspector tests the rapid-shutdown initiator and confirms service labeling.',
      scopeTags: ['solar'],
      sourceUrl: 'https://link.nfpa.org/free-access/publications/70/2023',
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
