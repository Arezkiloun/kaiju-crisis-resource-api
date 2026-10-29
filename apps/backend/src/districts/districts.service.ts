import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DistrictCode } from "../generated/prisma/enums";

@Injectable()
export class DistrictsService {
  constructor(private readonly prisma: PrismaService) {}


   // mets le code en majuscules

  private validateCode(code: string): DistrictCode {
    const normalizedCode = code.toUpperCase();
    const validCodes = ["A", "E", "W", "X", "Z"];

    if (!validCodes.includes(normalizedCode)) {
      throw new NotFoundException(`District ${code} not found`);
    }

    return normalizedCode as DistrictCode;
  }

  //recupere les districts avec Prisma.

  async findAll() {
    return this.prisma.district.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        seaAccess: true,
        severityLevel: true,
      },
      orderBy: {
        code: "asc",
      },
    });
  }

  //validation du code

  async findOne(code: string) {
    const districtCode = this.validateCode(code);

    const district = await this.prisma.district.findUnique({
      where: {
        code: districtCode,
      },
      select: {
        id: true,
        code: true,
        name: true,
        seaAccess: true,
        severityLevel: true,
      },
    });

    if (!district) {
      throw new NotFoundException(`District ${code} not found`);
    }

    return district;
  }

  //les relations de voisinage
  
  async findNeighbors(code: string) {
    const districtCode = this.validateCode(code);

    const district = await this.prisma.district.findUnique({
      where: {
        code: districtCode,
      },
    });

    if (!district) {
      throw new NotFoundException(`District ${code} not found`);
    }

    const adjacencies = await this.prisma.districtAdjacency.findMany({
      where: {
        OR: [
          {
            districtA: {
              code: districtCode,
            },
          },
          {
            districtB: {
              code: districtCode,
            },
          },
        ],
      },
      include: {
        districtA: true,
        districtB: true,
      },
    });

    return adjacencies
      .map((adjacency) =>
        adjacency.districtA.code === districtCode
          ? adjacency.districtB
          : adjacency.districtA
      )
      .map((neighbor) => ({
        id: neighbor.id,
        code: neighbor.code,
        name: neighbor.name,
        seaAccess: neighbor.seaAccess,
        severityLevel: neighbor.severityLevel,
      }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }
}
