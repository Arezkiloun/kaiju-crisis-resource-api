import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import {
  ReservationStatus,
  Role,
} from "../generated/prisma/enums";
import { PrismaService } from "../prisma/prisma.service";
import { AllocationRulesService } from "./allocation-rules.service";
import { CreateReservationDto } from "./dto";
import { assertCanReserve } from "./reservation-rules";

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly allocationRules: AllocationRulesService,
  ) {}

  async create(userId: number, dto: CreateReservationDto) {
    if (!Number.isSafeInteger(userId) || userId < 1) {
      throw new UnauthorizedException({
        code: "AUTH_REQUIRED",
        message: "Un utilisateur authentifié est nécessaire.",
      });
    }

    if (
      !Number.isInteger(dto.resourceStockId) ||
      dto.resourceStockId < 1 ||
      dto.resourceStockId > 2147483647 ||
      !Number.isInteger(dto.quantity) ||
      dto.quantity < 1 ||
      dto.quantity > 2147483647
    ) {
      throw new BadRequestException({
        code: "INVALID_RESERVATION_INPUT",
        message: "Le stock et la quantité doivent être des entiers positifs valides.",
      });
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: {
            role: true,
            districts: { select: { districtId: true } },
          },
        });

        if (!user) {
          throw new UnauthorizedException({
            code: "AUTH_USER_NOT_FOUND",
            message: "L'utilisateur authentifié n'existe plus.",
          });
        }

        const state = await tx.disasterState.findUnique({
          where: { key: "GLOBAL" },
        });

        if (!state) {
          throw new ServiceUnavailableException({
            code: "DISASTER_STATE_MISSING",
            message: "Le niveau global de catastrophe est indisponible.",
          });
        }

        const stock = await tx.resourceStock.findUnique({
          where: { id: dto.resourceStockId },
        });

        if (!stock) {
          throw new NotFoundException({
            code: "RESOURCE_STOCK_NOT_FOUND",
            message: "Ce stock n'existe pas.",
          });
        }

        const belongsToDistrict = user.districts.some(
          (district) => district.districtId === stock.districtId,
        );

        assertCanReserve(user.role, belongsToDistrict, state.level);

        const validRetention =
          state.retentionPercent === 30 ||
          (state.level === 5 && state.retentionPercent === 15);

        if (!validRetention) {
          throw new ServiceUnavailableException({
            code: "INVALID_RETENTION_CONFIGURATION",
            message: "Le seuil de rétention ne correspond pas aux règles.",
          });
        }

        const minimumRetention =
          this.allocationRules.calculateMinimumRetention(
            stock.initialQuantity,
            state.retentionPercent,
          );

        const updated = await tx.resourceStock.updateMany({
          where: {
            id: stock.id,
            currentQuantity: {
              gte: minimumRetention + dto.quantity,
            },
          },
          data: {
            currentQuantity: { decrement: dto.quantity },
          },
        });

        if (updated.count !== 1) {
          throw new ConflictException({
            code: "RETENTION_LIMIT",
            message: "La quantité demandée dépasse le stock disponible après rétention.",
          });
        }

        return tx.reservation.create({
          data: {
            userId,
            resourceStockId: stock.id,
            quantity: dto.quantity,
          },
        });
      }, {
        isolationLevel: "Serializable",
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034"
      ) {
        throw new ConflictException({
          code: "CONCURRENT_RESERVATION",
          message: "Une opération simultanée a modifié les données. Réessayez.",
        });
      }

      throw error;
    }
  }

  async returnReservation(userId: number, reservationId: number) {
    if (!Number.isSafeInteger(userId) || userId < 1) {
      throw new UnauthorizedException({
        code: "AUTH_REQUIRED",
        message: "Un utilisateur authentifié est nécessaire.",
      });
    }

    if (!Number.isSafeInteger(reservationId) || reservationId < 1) {
      throw new BadRequestException({
        code: "INVALID_RESERVATION_ID",
        message: "L'identifiant de réservation est invalide.",
      });
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: {
            role: true,
            districts: {
              select: {
                districtId: true,
              },
            },
          },
        });

        if (!user) {
          throw new UnauthorizedException({
            code: "AUTH_USER_NOT_FOUND",
            message: "L'utilisateur authentifié n'existe plus.",
          });
        }

        const reservation = await tx.reservation.findUnique({
          where: {
            id: reservationId,
          },
          include: {
            resourceStock: true,
          },
        });

        if (!reservation) {
          throw new NotFoundException({
            code: "RESERVATION_NOT_FOUND",
            message: "Cette réservation n'existe pas.",
          });
        }

        if (reservation.userId !== userId) {
          throw new ForbiddenException({
            code: "RESERVATION_OWNER_FORBIDDEN",
            message: "Cette réservation appartient à un autre utilisateur.",
          });
        }

        if (user.role !== Role.QC) {
          throw new ForbiddenException({
            code: "RESERVATION_ROLE_FORBIDDEN",
            message: "Seul un QC peut retourner cette réservation.",
          });
        }

        const belongsToDistrict = user.districts.some(
          (district) =>
            district.districtId === reservation.resourceStock.districtId,
        );

        if (!belongsToDistrict) {
          throw new ForbiddenException({
            code: "RESERVATION_DISTRICT_FORBIDDEN",
            message: "Cette réservation ne concerne pas votre district.",
          });
        }

        const updatedReservation = await tx.reservation.updateMany({
          where: {
            id: reservation.id,
            status: ReservationStatus.ACTIVE,
          },
          data: {
            status: ReservationStatus.RETURNED,
            returnedAt: new Date(),
          },
        });

        if (updatedReservation.count !== 1) {
          throw new ConflictException({
            code: "RESERVATION_ALREADY_CLOSED",
            message: "Cette réservation a déjà été retournée ou annulée.",
          });
        }

        await tx.resourceStock.update({
          where: {
            id: reservation.resourceStockId,
          },
          data: {
            currentQuantity: {
              increment: reservation.quantity,
            },
          },
        });

        return tx.reservation.findUnique({
          where: {
            id: reservation.id,
          },
        });
      }, {
        isolationLevel: "Serializable",
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034"
      ) {
        throw new ConflictException({
          code: "CONCURRENT_RESERVATION",
          message: "Une opération simultanée a modifié les données. Réessayez.",
        });
      }

      throw error;
    }
  }
}
