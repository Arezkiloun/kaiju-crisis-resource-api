import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DistrictCode } from "../generated/prisma/enums";
import { AllocationRulesService } from "./allocation-rules.service";

@Injectable()
export class ResourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly allocationRules: AllocationRulesService,
  ) {}

  private validateDistrictCode(code: string): DistrictCode {
    const normalizedCode = code.toUpperCase();
    const validCodes = ["A", "E", "W", "X", "Z"];

    if (!validCodes.includes(normalizedCode)) {
      throw new NotFoundException(`District ${code} not found`);
    }

    return normalizedCode as DistrictCode;
  }

  async findAll() {
    return this.prisma.resourceType.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        id: "asc",
      },
    });
  }

  async findByDistrict(code: string) {
    const districtCode = this.validateDistrictCode(code);

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
        stocks: {
          select: {
            id: true,
            initialQuantity: true,
            currentQuantity: true,
            resourceType: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            resourceTypeId: "asc",
          },
        },
      },
    });

    if (!district) {
      throw new NotFoundException(`District ${code} not found`);
    }

    return district;
  }

  async findAvailabilityByDistrict(code: string) {
    const districtCode = this.validateDistrictCode(code);

    const disasterState = await this.prisma.disasterState.findUnique({
      where: {
        key: "GLOBAL",
      },
    });

    const retentionPercent = disasterState?.retentionPercent ?? 30;

    const district = await this.prisma.district.findUnique({
      where: {
        code: districtCode,
      },
      select: {
        id: true,
        code: true,
        name: true,
        stocks: {
          select: {
            initialQuantity: true,
            currentQuantity: true,
            resourceType: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            resourceTypeId: "asc",
          },
        },
      },
    });

    if (!district) {
      throw new NotFoundException(`District ${code} not found`);
    }

    return {
      district: {
        id: district.id,
        code: district.code,
        name: district.name,
      },
      retentionPercent,
      resources: district.stocks.map((stock) => {
        const minimumRetention =
          this.allocationRules.calculateMinimumRetention(
            stock.initialQuantity,
            retentionPercent,
          );

        const availableQuantity =
          this.allocationRules.calculateAvailableQuantity(
            stock.currentQuantity,
            minimumRetention,
          );

        return {
          resourceType: stock.resourceType,
          initialQuantity: stock.initialQuantity,
          currentQuantity: stock.currentQuantity,
          minimumRetention,
          availableQuantity,
        };
      }),
    };
  }

}
