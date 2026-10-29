import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

const districts = [
  { code: "A" as const, name: "Apex", seaAccess: false },
  { code: "E" as const, name: "Echo", seaAccess: true },
  { code: "W" as const, name: "Warden", seaAccess: false },
  { code: "X" as const, name: "Xeno", seaAccess: true },
  { code: "Z" as const, name: "Zion", seaAccess: true },
];

const resources = [
  "Medical personnel",
  "Rescue teams",
  "Transport vehicles",
  "Emergency shelters",
  "Food & water supplies",
  "Communication equipment",
  "Power generators",
  "Engineering crews",
  "Security units",
  "Hazmat equipment",
];

const quantities: Record<string, Record<string, number>> = {
  "Medical personnel": {
    A: 12,
    E: 5,
    W: 8,
    X: 3,
    Z: 7,
  },

  "Rescue teams": {
    A: 4,
    E: 9,
    W: 3,
    X: 6,
    Z: 5,
  },

  "Transport vehicles": {
    A: 6,
    E: 3,
    W: 10,
    X: 4,
    Z: 7,
  },

  "Emergency shelters": {
    A: 8,
    E: 6,
    W: 4,
    X: 10,
    Z: 2,
  },

  "Food & water supplies": {
    A: 5,
    E: 8,
    W: 6,
    X: 7,
    Z: 9,
  },

  "Communication equipment": {
    A: 3,
    E: 7,
    W: 5,
    X: 8,
    Z: 4,
  },

  "Power generators": {
    A: 7,
    E: 2,
    W: 9,
    X: 5,
    Z: 6,
  },

  "Engineering crews": {
    A: 2,
    E: 6,
    W: 7,
    X: 4,
    Z: 8,
  },

  "Security units": {
    A: 9,
    E: 4,
    W: 2,
    X: 6,
    Z: 3,
  },

  "Hazmat equipment": {
    A: 3,
    E: 5,
    W: 4,
    X: 2,
    Z: 10,
  },
};

async function main() {
  console.log("Starting KAIJU database seed...");

  // 1. Districts
  const districtMap: Record<string, number> = {};

  for (const district of districts) {
    const result = await prisma.district.upsert({
      where: {
        code: district.code,
      },

      update: {
        name: district.name,
        seaAccess: district.seaAccess,
      },

      create: {
        code: district.code,
        name: district.name,
        seaAccess: district.seaAccess,
        severityLevel: 1,
      },
    });

    districtMap[district.code] = result.id;
  }

  console.log("Districts created");

  // 2. Resource types
  const resourceMap: Record<string, number> = {};

  for (const resource of resources) {
    const result = await prisma.resourceType.upsert({
      where: {
        name: resource,
      },

      update: {},

      create: {
        name: resource,
      },
    });

    resourceMap[resource] = result.id;
  }

  console.log("Resource types created");

  // 3. Resource stocks
  for (const resource of resources) {
    for (const district of districts) {
      const quantity = quantities[resource][district.code];

      await prisma.resourceStock.upsert({
        where: {
          districtId_resourceTypeId: {
            districtId: districtMap[district.code],
            resourceTypeId: resourceMap[resource],
          },
        },

        update: {
          initialQuantity: quantity,
          currentQuantity: quantity,
        },

        create: {
          districtId: districtMap[district.code],
          resourceTypeId: resourceMap[resource],
          initialQuantity: quantity,
          currentQuantity: quantity,
        },
      });
    }
  }

  console.log("Resource stocks created");

  // 4. District adjacency
  const adjacencies: [string, string][] = [
    ["A", "E"],
    ["A", "W"],
    ["A", "X"],
    ["E", "X"],
    ["W", "X"],
    ["W", "Z"],
    ["X", "Z"],
  ];

  for (const [districtA, districtB] of adjacencies) {
    await prisma.districtAdjacency.upsert({
      where: {
        districtAId_districtBId: {
          districtAId: districtMap[districtA],
          districtBId: districtMap[districtB],
        },
      },

      update: {},

      create: {
        districtAId: districtMap[districtA],
        districtBId: districtMap[districtB],
      },
    });
  }

  console.log("District adjacency created");

  // 5. Initial disaster state
  await prisma.disasterState.upsert({
    where: {
      key: "GLOBAL",
    },

    update: {},

    create: {
      key: "GLOBAL",
      level: 1,
      retentionPercent: 30,
    },
  });

  console.log("Disaster state created");

  console.log("KAIJU database seeded successfully!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Seed failed:");
    console.error(error);

    await prisma.$disconnect();

    process.exit(1);
  });