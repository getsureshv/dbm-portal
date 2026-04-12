import { PrismaClient, TradeGroup } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // 1. Seed Trade Categories
  const categories = await prisma.$transaction([
    prisma.tradeCategory.upsert({
      where: { name: TradeGroup.PLANNING_DESIGN },
      update: {},
      create: {
        name: TradeGroup.PLANNING_DESIGN,
        label: 'Planning & Design',
      },
    }),
    prisma.tradeCategory.upsert({
      where: { name: TradeGroup.CONTRACTORS },
      update: {},
      create: {
        name: TradeGroup.CONTRACTORS,
        label: 'Contractors',
      },
    }),
    prisma.tradeCategory.upsert({
      where: { name: TradeGroup.SUPPLIERS },
      update: {},
      create: {
        name: TradeGroup.SUPPLIERS,
        label: 'Suppliers',
      },
    }),
    prisma.tradeCategory.upsert({
      where: { name: TradeGroup.SERVICES },
      update: {},
      create: {
        name: TradeGroup.SERVICES,
        label: 'Services',
      },
    }),
  ]);

  console.log(`✓ Seeded ${categories.length} trade categories`);

  // 2. Seed Trade Names
  const tradeNames = [
    // Planning & Design
    { name: 'Architect', category: 'PLANNING_DESIGN' },
    { name: 'Interior Designer', category: 'PLANNING_DESIGN' },
    { name: 'Landscape Designer', category: 'PLANNING_DESIGN' },
    { name: 'Civil Engineer', category: 'PLANNING_DESIGN' },
    { name: 'Structural Engineer', category: 'PLANNING_DESIGN' },
    { name: 'Urban Planner', category: 'PLANNING_DESIGN' },
    { name: 'Project Manager', category: 'PLANNING_DESIGN' },
    // Contractors
    { name: 'General Contractor', category: 'CONTRACTORS' },
    { name: 'Electrician', category: 'CONTRACTORS' },
    { name: 'Plumber', category: 'CONTRACTORS' },
    { name: 'HVAC', category: 'CONTRACTORS' },
    { name: 'Roofer', category: 'CONTRACTORS' },
    { name: 'Painter', category: 'CONTRACTORS' },
    { name: 'Flooring Contractor', category: 'CONTRACTORS' },
    { name: 'Framer', category: 'CONTRACTORS' },
    { name: 'Drywall Hanger', category: 'CONTRACTORS' },
    { name: 'Concrete', category: 'CONTRACTORS' },
    { name: 'Pool Contractor', category: 'CONTRACTORS' },
    { name: 'Deck/Patio', category: 'CONTRACTORS' },
    { name: 'Fence Contractor', category: 'CONTRACTORS' },
    { name: 'Fire Alarm', category: 'CONTRACTORS' },
    { name: 'Fire Sprinkler', category: 'CONTRACTORS' },
    { name: 'Glass & Glazing', category: 'CONTRACTORS' },
    { name: 'Cabinets', category: 'CONTRACTORS' },
    { name: 'Countertops', category: 'CONTRACTORS' },
    { name: 'Doors & Windows', category: 'CONTRACTORS' },
    { name: 'Mechanical', category: 'CONTRACTORS' },
    { name: 'Irrigation', category: 'CONTRACTORS' },
    { name: 'Landscape', category: 'CONTRACTORS' },
    // Suppliers
    { name: 'Lumber', category: 'SUPPLIERS' },
    { name: 'Hardware', category: 'SUPPLIERS' },
    { name: 'Plumbing Supplies', category: 'SUPPLIERS' },
    { name: 'Electrical Supplies', category: 'SUPPLIERS' },
    { name: 'Flooring Materials', category: 'SUPPLIERS' },
    { name: 'Roofing Materials', category: 'SUPPLIERS' },
    { name: 'Drywall', category: 'SUPPLIERS' },
    { name: 'Doors & Windows Supplies', category: 'SUPPLIERS' },
    { name: 'Gardening Supplies', category: 'SUPPLIERS' },
    { name: 'Irrigation Supplies', category: 'SUPPLIERS' },
    { name: 'Concrete Supplies', category: 'SUPPLIERS' },
    // Services
    { name: 'Construction Cleaning', category: 'SERVICES' },
    { name: 'Equipment Rental', category: 'SERVICES' },
    { name: 'Dumpster', category: 'SERVICES' },
    { name: 'Smoke Testing', category: 'SERVICES' },
    { name: 'Pest Control', category: 'SERVICES' },
    { name: 'Waterproofing', category: 'SERVICES' },
    { name: 'Electrical Testing', category: 'SERVICES' },
    { name: 'Water Damage Restoration', category: 'SERVICES' },
    { name: 'Lab Tests', category: 'SERVICES' },
    { name: 'Surveyor', category: 'SERVICES' },
  ];

  const createdTrades = await Promise.all(
    tradeNames.map((trade) =>
      prisma.tradeName.upsert({
        where: { slug: slugify(trade.name) },
        update: {},
        create: {
          name: trade.name,
          slug: slugify(trade.name),
          category: {
            connect: {
              name: trade.category as TradeGroup,
            },
          },
        },
      })
    )
  );

  console.log(`✓ Seeded ${createdTrades.length} trade names`);

  // 3. Seed Test Users
  const ownerUser = await prisma.user.upsert({
    where: { firebaseUid: 'test-owner-uid' },
    update: {},
    create: {
      firebaseUid: 'test-owner-uid',
      email: 'owner@test.com',
      role: 'OWNER',
      onboardingComplete: true,
      name: 'Test Owner',
      phone: '(555) 100-0000',
      verificationStatus: true,
    },
  });

  console.log(`✓ Created owner user: ${ownerUser.email}`);

  // Find General Contractor trade + its category
  const generalContractorTrade = await prisma.tradeName.findUnique({
    where: { slug: 'general-contractor' },
    include: { category: true },
  });

  const providerUser = await prisma.user.upsert({
    where: { firebaseUid: 'test-pro-uid' },
    update: {},
    create: {
      firebaseUid: 'test-pro-uid',
      email: 'pro@test.com',
      role: 'PROVIDER',
      providerType: 'PROFESSIONAL',
      onboardingComplete: true,
      name: 'Test Professional',
      phone: '(555) 200-0000',
      verificationStatus: true,
      professionalProfile: {
        create: {
          firstName: 'Test',
          lastName: 'Professional',
          companyName: 'Martinez Construction LLC',
          contactNumber1: '(555) 200-0000',
          email: 'pro@test.com',
          licenseStatus: 'ACTIVE',
          styleOfWork: ['residential', 'commercial'],
          yearsInBusiness: 18,
          ...(generalContractorTrade
            ? {
                tradeNameId: generalContractorTrade.id,
                tradeCategoryId: generalContractorTrade.category.id,
              }
            : {}),
        },
      },
    },
    include: {
      professionalProfile: true,
    },
  });

  console.log(`✓ Created provider user: ${providerUser.email}`);

  // 4. Seed Test Project
  const project = await prisma.project.create({
    data: {
      title: 'Kitchen Remodel',
      type: 'RESIDENTIAL',
      status: 'DISCOVERY',
      zipCode: '75019',
      scopeCreationMode: 'AI_ASSISTED',
      ownerId: ownerUser.id,
      scopeDocument: {
        create: {
          status: 'DRAFT',
        },
      },
    },
    include: { scopeDocument: true },
  });

  console.log(`✓ Created test project: ${project.title}`);

  // 5. Seed Feature Flag
  const featureFlag = await prisma.featureFlag.upsert({
    where: { key: 'scope_creation_mode' },
    update: { variant: 'ai_assisted' },
    create: {
      key: 'scope_creation_mode',
      variant: 'ai_assisted',
      userId: null,
    },
  });

  console.log(`✓ Created feature flag: ${featureFlag.key}`);

  console.log('\n✅ Database seed completed successfully!');
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
