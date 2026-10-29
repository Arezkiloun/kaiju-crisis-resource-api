import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { UpdateLevelDto } from "./dto/update-level.dto";
import { UpdateRetentionDto } from "./dto/update-retention.dto";

@Injectable()
export class DisasterService {
  constructor(private readonly prisma: PrismaService) {}

//  récupère l’état global

  async getState() {
    return this.prisma.disasterState.upsert({
      where: { key: "GLOBAL" },
      update: {},
      create: {
        key: "GLOBAL",
        level: 1,
        retentionPercent: 30,
      },
    });
  }

//    vérifie que l’utilisateur existe et possède le rôle CD.
  private async assertCD(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
      },
    });

    if (!user) {
      throw new NotFoundException(
        "Utilisateur introuvable.",
      );
    }

    if (user.role !== "CD") {
      throw new ForbiddenException(
        "Seul le City Director peut modifier l'état de catastrophe.",
      );
    }

    return user;
  }
  
//   vérifie que le niveau est compris entre 1 et 5,
  async updateLevel(
    userId: number,
    dto: UpdateLevelDto,
  ) {
    await this.assertCD(userId);

    if (
      !Number.isInteger(dto.level) ||
      dto.level < 1 ||
      dto.level > 5
    ) {
      throw new BadRequestException(
        "Le niveau doit être compris entre 1 et 5.",
      );
    }

    await this.getState();

    return this.prisma.disasterState.update({
      where: { key: "GLOBAL" },
      data: {
        level: dto.level,
        ...(dto.level !== 5
          ? { retentionPercent: 30 }
          : {}),
      },
    });
  }


//   accepte 30 %, ou 15 % uniquement au niveau 5.
  async updateRetention(
    userId: number,
    dto: UpdateRetentionDto,
  ) {
    await this.assertCD(userId);

    if (
      dto.retentionPercent !== 15 &&
      dto.retentionPercent !== 30
    ) {
      throw new BadRequestException(
        "La rétention doit être de 15 ou 30 pour cent.",
      );
    }

    const state = await this.getState();

    if (
      dto.retentionPercent === 15 &&
      state.level !== 5
    ) {
      throw new BadRequestException(
        "La rétention à 15 pour cent est autorisée uniquement au niveau 5.",
      );
    }

    return this.prisma.disasterState.update({
      where: { key: "GLOBAL" },
      data: {
        retentionPercent: dto.retentionPercent,
      },
    });
  }
}
