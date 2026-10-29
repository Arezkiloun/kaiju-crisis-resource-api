import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import {
  ApprovalStatus,
  DistrictCode,
  Role,
  RouteType,
  TransferStatus,
} from "../generated/prisma/enums";
import { PrismaService } from "../prisma/prisma.service";
import { AllocationRulesService } from "./allocation-rules.service";
import { CreateTransferDto, CreateTransitDto, CreateMaritimeDto } from "./transfer.dto";
import {
  assertCanRequestDirectTransfer,
  assertCanOrganizeTransit,
} from "./transfer-rules";

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly allocationRules: AllocationRulesService,
  ) {}

  private validateDistrictCode(code: string): DistrictCode {
    const normalized = code.toUpperCase();
    const validCodes = ["A", "E", "W", "X", "Z"];

    if (!validCodes.includes(normalized)) {
      throw new NotFoundException({
        code: "DISTRICT_NOT_FOUND",
        message: `District ${code} not found`,
      });
    }

    return normalized as DistrictCode;
  }



  

  async create(userId: number, dto: CreateTransferDto) {
    if (!Number.isSafeInteger(userId) || userId < 1) {
      throw new UnauthorizedException({
        code: "AUTH_REQUIRED",
        message: "Un utilisateur authentifié est nécessaire.",
      });
    }

    if (
      !Number.isInteger(dto.resourceTypeId) ||
      dto.resourceTypeId < 1 ||
      !Number.isInteger(dto.quantity) ||
      dto.quantity < 1
    ) {
      throw new BadRequestException({
        code: "INVALID_TRANSFER_INPUT",
        message: "La ressource et la quantité doivent être valides.",
      });
    }

    const sourceCode = this.validateDistrictCode(dto.sourceDistrictCode);
    const destinationCode =
      this.validateDistrictCode(dto.destinationDistrictCode);

    if (sourceCode === destinationCode) {
      throw new BadRequestException({
        code: "SAME_DISTRICT_TRANSFER",
        message: "La source et la destination doivent être différentes.",
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          role: true,
          districts: {
            select: { districtId: true },
          },
        },
      });

      if (!user) {
        throw new UnauthorizedException({
          code: "AUTH_USER_NOT_FOUND",
          message: "L'utilisateur n'existe pas.",
        });
      }

      const state = await tx.disasterState.findUnique({
        where: { key: "GLOBAL" },
      });

      if (!state) {
        throw new ServiceUnavailableException({
          code: "DISASTER_STATE_MISSING",
          message: "Le niveau de catastrophe est indisponible.",
        });
      }

      const source = await tx.district.findUnique({
        where: { code: sourceCode },
      });

      const destination = await tx.district.findUnique({
        where: { code: destinationCode },
      });

      if (!source || !destination) {
        throw new NotFoundException({
          code: "DISTRICT_NOT_FOUND",
          message: "District introuvable.",
        });
      }

      const managesDestination = user.districts.some(
        (district) => district.districtId === destination.id,
      );

      assertCanRequestDirectTransfer(
        user.role,
        managesDestination,
        state.level,
      );

      const adjacency = await tx.districtAdjacency.findFirst({
        where: {
          OR: [
            {
              districtAId: source.id,
              districtBId: destination.id,
            },
            {
              districtAId: destination.id,
              districtBId: source.id,
            },
          ],
        },
      });

      if (!adjacency) {
        throw new ConflictException({
          code: "DISTRICTS_NOT_ADJACENT",
          message: "Les deux districts ne sont pas adjacents.",
        });
      }

      const stock = await tx.resourceStock.findFirst({
        where: {
          districtId: source.id,
          resourceTypeId: dto.resourceTypeId,
        },
      });

      if (!stock) {
        throw new NotFoundException({
          code: "RESOURCE_STOCK_NOT_FOUND",
          message: "Cette ressource n'existe pas dans le district source.",
        });
      }

      const validRetention =
        state.retentionPercent === 30 ||
        (state.level === 5 && state.retentionPercent === 15);

      if (!validRetention) {
        throw new ServiceUnavailableException({
          code: "INVALID_RETENTION_CONFIGURATION",
          message: "Le seuil de rétention est invalide.",
        });
      }

      const minimumRetention =
        this.allocationRules.calculateMinimumRetention(
          stock.initialQuantity,
          state.retentionPercent,
        );

      const availableQuantity =
        this.allocationRules.calculateAvailableQuantity(
          stock.currentQuantity,
          minimumRetention,
        );

      if (dto.quantity > availableQuantity) {
        throw new ConflictException({
          code: "RETENTION_LIMIT",
          message: `Seulement ${availableQuantity} unités sont disponibles.`,
        });
      }

      const transfer = await tx.transfer.create({
        data: {
          sourceDistrictId: source.id,
          destinationDistrictId: destination.id,
          resourceTypeId: dto.resourceTypeId,
          requestedById: userId,
          quantity: dto.quantity,
          routeType: RouteType.DIRECT,
        },
      });

      await tx.transferApproval.create({
        data: {
          transferId: transfer.id,
          districtId: source.id,
          sequence: 1,
        },
      });

      return tx.transfer.findUnique({
        where: { id: transfer.id },
        include: {
          sourceDistrict: true,
          destinationDistrict: true,
          resourceType: true,
          approvals: true,
        },
      });
    });
  }






  async approve(userId: number, transferId: number) {
    if (!Number.isSafeInteger(userId) || userId < 1) {
      throw new UnauthorizedException({
        code: "AUTH_REQUIRED",
        message: "Un utilisateur authentifié est nécessaire.",
      });
    }

    if (!Number.isSafeInteger(transferId) || transferId < 1) {
      throw new BadRequestException({
        code: "INVALID_TRANSFER_ID",
        message: "L'identifiant du transfert est invalide.",
      });
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: {
            role: true,
            districts: {
              select: { districtId: true },
            },
          },
        });

        if (!user) {
          throw new UnauthorizedException({
            code: "AUTH_USER_NOT_FOUND",
            message: "L'utilisateur n'existe pas.",
          });
        }

        if (user.role !== Role.QC) {
          throw new ForbiddenException({
            code: "TRANSFER_APPROVAL_ROLE_FORBIDDEN",
            message: "Seul le QC du district fournisseur peut approuver ce transfert.",
          });
        }

        const transfer = await tx.transfer.findUnique({
          where: { id: transferId },
          include: {
            approvals: true,
          },
        });

        if (!transfer) {
          throw new NotFoundException({
            code: "TRANSFER_NOT_FOUND",
            message: "Ce transfert n'existe pas.",
          });
        }

        if (transfer.status !== TransferStatus.PENDING) {
          throw new ConflictException({
            code: "TRANSFER_ALREADY_CLOSED",
            message: "Ce transfert n'est plus en attente.",
          });
        }

        if (transfer.routeType !== RouteType.DIRECT) {
          throw new ConflictException({
            code: "TRANSFER_ROUTE_NOT_DIRECT",
            message: "Cette route nécessite une autre procédure d'approbation.",
          });
        }

        const managesSource = user.districts.some(
          (district) =>
            district.districtId === transfer.sourceDistrictId,
        );

        if (!managesSource) {
          throw new ForbiddenException({
            code: "TRANSFER_APPROVAL_DISTRICT_FORBIDDEN",
            message: "Seul le QC du district fournisseur peut approuver.",
          });
        }

        const approval = transfer.approvals.find(
          (item) =>
            item.districtId === transfer.sourceDistrictId,
        );

        if (!approval) {
          throw new ServiceUnavailableException({
            code: "TRANSFER_APPROVAL_MISSING",
            message: "L'approbation du district destinataire est absente.",
          });
        }

        if (approval.status !== ApprovalStatus.PENDING) {
          throw new ConflictException({
            code: "TRANSFER_APPROVAL_ALREADY_PROCESSED",
            message: "Cette approbation a déjà été traitée.",
          });
        }

        const state = await tx.disasterState.findUnique({
          where: { key: "GLOBAL" },
        });

        if (!state) {
          throw new ServiceUnavailableException({
            code: "DISASTER_STATE_MISSING",
            message: "Le niveau de catastrophe est indisponible.",
          });
        }

        const validRetention =
          state.retentionPercent === 30 ||
          (state.level === 5 && state.retentionPercent === 15);

        if (!validRetention) {
          throw new ServiceUnavailableException({
            code: "INVALID_RETENTION_CONFIGURATION",
            message: "Le seuil de rétention est invalide.",
          });
        }

        const sourceStock = await tx.resourceStock.findFirst({
          where: {
            districtId: transfer.sourceDistrictId,
            resourceTypeId: transfer.resourceTypeId,
          },
        });

        const destinationStock = await tx.resourceStock.findFirst({
          where: {
            districtId: transfer.destinationDistrictId,
            resourceTypeId: transfer.resourceTypeId,
          },
        });

        if (!sourceStock || !destinationStock) {
          throw new NotFoundException({
            code: "RESOURCE_STOCK_NOT_FOUND",
            message: "Le stock source ou destination est introuvable.",
          });
        }

        const minimumRetention =
          this.allocationRules.calculateMinimumRetention(
            sourceStock.initialQuantity,
            state.retentionPercent,
          );

        const updatedSource = await tx.resourceStock.updateMany({
          where: {
            id: sourceStock.id,
            currentQuantity: {
              gte: minimumRetention + transfer.quantity,
            },
          },
          data: {
            currentQuantity: {
              decrement: transfer.quantity,
            },
          },
        });

        if (updatedSource.count !== 1) {
          throw new ConflictException({
            code: "RETENTION_LIMIT",
            message:
              "Le stock source ne permet plus ce transfert sans violer la rétention.",
          });
        }

        await tx.resourceStock.update({
          where: {
            id: destinationStock.id,
          },
          data: {
            currentQuantity: {
              increment: transfer.quantity,
            },
          },
        });

        await tx.transferApproval.update({
          where: {
            id: approval.id,
          },
          data: {
            status: ApprovalStatus.APPROVED,
            approverId: userId,
            approvedAt: new Date(),
          },
        });

        await tx.transfer.update({
          where: {
            id: transfer.id,
          },
          data: {
            status: TransferStatus.COMPLETED,
            approvedAt: new Date(),
            completedAt: new Date(),
          },
        });

        return tx.transfer.findUnique({
          where: { id: transfer.id },
          include: {
            sourceDistrict: true,
            destinationDistrict: true,
            resourceType: true,
            approvals: true,
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
          code: "CONCURRENT_TRANSFER",
          message:
            "Une opération simultanée a modifié les stocks. Réessayez.",
        });
      }

      throw error;
    }
  }

  async reject(userId: number, transferId: number) {
    if (!Number.isSafeInteger(userId) || userId < 1) {
      throw new UnauthorizedException({
        code: "AUTH_REQUIRED",
        message: "Un utilisateur authentifié est nécessaire.",
      });
    }

    if (!Number.isSafeInteger(transferId) || transferId < 1) {
      throw new BadRequestException({
        code: "INVALID_TRANSFER_ID",
        message: "L'identifiant du transfert est invalide.",
      });
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: {
            role: true,
            districts: {
              select: { districtId: true },
            },
          },
        });

        if (!user) {
          throw new UnauthorizedException({
            code: "AUTH_USER_NOT_FOUND",
            message: "L'utilisateur n'existe pas.",
          });
        }

        if (user.role !== Role.QC) {
          throw new ForbiddenException({
            code: "TRANSFER_REJECTION_ROLE_FORBIDDEN",
            message: "Seul un QC peut refuser cette demande.",
          });
        }

        const transfer = await tx.transfer.findUnique({
          where: { id: transferId },
          include: {
            approvals: true,
          },
        });

        if (!transfer) {
          throw new NotFoundException({
            code: "TRANSFER_NOT_FOUND",
            message: "Ce transfert n'existe pas.",
          });
        }

        if (transfer.status !== TransferStatus.PENDING) {
          throw new ConflictException({
            code: "TRANSFER_ALREADY_CLOSED",
            message: "Ce transfert n'est plus en attente.",
          });
        }

        const managesSource = user.districts.some(
          (district) =>
            district.districtId === transfer.sourceDistrictId,
        );

        if (!managesSource) {
          throw new ForbiddenException({
            code: "TRANSFER_REJECTION_DISTRICT_FORBIDDEN",
            message:
              "Seul le QC du district fournisseur peut refuser cette demande.",
          });
        }

        const approval = transfer.approvals.find(
          (item) =>
            item.districtId === transfer.sourceDistrictId,
        );

        if (!approval) {
          throw new ServiceUnavailableException({
            code: "TRANSFER_APPROVAL_MISSING",
            message: "L'approbation du district fournisseur est absente.",
          });
        }

        if (approval.status !== ApprovalStatus.PENDING) {
          throw new ConflictException({
            code: "TRANSFER_APPROVAL_ALREADY_PROCESSED",
            message: "Cette demande a déjà été traitée.",
          });
        }

        const approvalResult =
          await tx.transferApproval.updateMany({
            where: {
              id: approval.id,
              status: ApprovalStatus.PENDING,
            },
            data: {
              status: ApprovalStatus.REJECTED,
              approverId: userId,
            },
          });

        if (approvalResult.count !== 1) {
          throw new ConflictException({
            code: "TRANSFER_APPROVAL_ALREADY_PROCESSED",
            message: "Cette demande a déjà été traitée.",
          });
        }

        const transferResult = await tx.transfer.updateMany({
          where: {
            id: transfer.id,
            status: TransferStatus.PENDING,
          },
          data: {
            status: TransferStatus.REJECTED,
          },
        });

        if (transferResult.count !== 1) {
          throw new ConflictException({
            code: "TRANSFER_ALREADY_CLOSED",
            message: "Ce transfert n'est plus en attente.",
          });
        }

        return tx.transfer.findUnique({
          where: { id: transfer.id },
          include: {
            sourceDistrict: true,
            destinationDistrict: true,
            resourceType: true,
            approvals: true,
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
          code: "CONCURRENT_TRANSFER",
          message:
            "Une opération simultanée a modifié le transfert. Réessayez.",
        });
      }

      throw error;
    }
  }


  async createTransit(userId: number, dto: CreateTransitDto) {
    if (!Number.isSafeInteger(userId) || userId < 1) {
      throw new UnauthorizedException({
        code: "AUTH_REQUIRED",
        message: "Un utilisateur authentifié est nécessaire.",
      });
    }

    if (
      !Number.isInteger(dto.resourceTypeId) ||
      dto.resourceTypeId < 1 ||
      !Number.isInteger(dto.quantity) ||
      dto.quantity < 1
    ) {
      throw new BadRequestException({
        code: "INVALID_TRANSIT_INPUT",
        message: "La ressource et la quantité doivent être valides.",
      });
    }

    const sourceCode =
      this.validateDistrictCode(dto.sourceDistrictCode);

    const transitCode =
      this.validateDistrictCode(dto.transitDistrictCode);

    const destinationCode =
      this.validateDistrictCode(dto.destinationDistrictCode);

    if (
      sourceCode === transitCode ||
      sourceCode === destinationCode ||
      transitCode === destinationCode
    ) {
      throw new BadRequestException({
        code: "INVALID_TRANSIT_ROUTE",
        message:
          "La source, le transit et la destination doivent être différents.",
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          role: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException({
          code: "AUTH_USER_NOT_FOUND",
          message: "L'utilisateur n'existe pas.",
        });
      }

      const state = await tx.disasterState.findUnique({
        where: { key: "GLOBAL" },
      });

      if (!state) {
        throw new ServiceUnavailableException({
          code: "DISASTER_STATE_MISSING",
          message: "Le niveau de catastrophe est indisponible.",
        });
      }

      assertCanOrganizeTransit(
        user.role,
        state.level,
      );

      const districts = await tx.district.findMany({
        where: {
          code: {
            in: [
              sourceCode,
              transitCode,
              destinationCode,
            ],
          },
        },
      });

      const source = districts.find(
        (d) => d.code === sourceCode,
      );

      const transit = districts.find(
        (d) => d.code === transitCode,
      );

      const destination = districts.find(
        (d) => d.code === destinationCode,
      );

      if (!source || !transit || !destination) {
        throw new NotFoundException({
          code: "DISTRICT_NOT_FOUND",
          message: "Un des districts est introuvable.",
        });
      }

      const directAdjacency =
        await tx.districtAdjacency.findFirst({
          where: {
            OR: [
              {
                districtAId: source.id,
                districtBId: destination.id,
              },
              {
                districtAId: destination.id,
                districtBId: source.id,
              },
            ],
          },
        });

      if (directAdjacency) {
        throw new ConflictException({
          code: "TRANSIT_NOT_REQUIRED",
          message:
            "La source et la destination sont adjacentes. Utilisez un transfert direct.",
        });
      }

      const sourceToTransit =
        await tx.districtAdjacency.findFirst({
          where: {
            OR: [
              {
                districtAId: source.id,
                districtBId: transit.id,
              },
              {
                districtAId: transit.id,
                districtBId: source.id,
              },
            ],
          },
        });

      const transitToDestination =
        await tx.districtAdjacency.findFirst({
          where: {
            OR: [
              {
                districtAId: transit.id,
                districtBId: destination.id,
              },
              {
                districtAId: destination.id,
                districtBId: transit.id,
              },
            ],
          },
        });

      if (!sourceToTransit || !transitToDestination) {
        throw new ConflictException({
          code: "INVALID_TRANSIT_PATH",
          message:
            "Le district intermédiaire doit être adjacent à la source et à la destination.",
        });
      }

      const sourceStock = await tx.resourceStock.findFirst({
        where: {
          districtId: source.id,
          resourceTypeId: dto.resourceTypeId,
        },
      });

      if (!sourceStock) {
        throw new NotFoundException({
          code: "RESOURCE_STOCK_NOT_FOUND",
          message:
            "La ressource n'existe pas dans le district source.",
        });
      }

      const validRetention =
        state.retentionPercent === 30 ||
        (
          state.level === 5 &&
          state.retentionPercent === 15
        );

      if (!validRetention) {
        throw new ServiceUnavailableException({
          code: "INVALID_RETENTION_CONFIGURATION",
          message: "Le seuil de rétention est invalide.",
        });
      }

      const minimumRetention =
        this.allocationRules.calculateMinimumRetention(
          sourceStock.initialQuantity,
          state.retentionPercent,
        );

      const availableQuantity =
        this.allocationRules.calculateAvailableQuantity(
          sourceStock.currentQuantity,
          minimumRetention,
        );

      if (dto.quantity > availableQuantity) {
        throw new ConflictException({
          code: "RETENTION_LIMIT",
          message:
            `Seulement ${availableQuantity} unités sont disponibles dans le district source.`,
        });
      }

      /*
       * Priorité aux quartiers adjacents à la destination.
       * Un fournisseur non adjacent n'est autorisé que si aucun voisin
       * de la destination ne possède le surplus nécessaire.
       */
      const destinationLinks =
        await tx.districtAdjacency.findMany({
          where: {
            OR: [
              { districtAId: destination.id },
              { districtBId: destination.id },
            ],
          },
        });

      const adjacentIds = destinationLinks.map((link) =>
        link.districtAId === destination.id
          ? link.districtBId
          : link.districtAId
      );

      const adjacentStocks =
        await tx.resourceStock.findMany({
          where: {
            districtId: {
              in: adjacentIds,
            },
            resourceTypeId: dto.resourceTypeId,
          },
          include: {
            district: true,
          },
        });

      const adjacentSupplier = adjacentStocks.find(
        (stock) => {
          const minimum =
            this.allocationRules.calculateMinimumRetention(
              stock.initialQuantity,
              state.retentionPercent,
            );

          const available =
            this.allocationRules.calculateAvailableQuantity(
              stock.currentQuantity,
              minimum,
            );

          return available >= dto.quantity;
        },
      );

      if (adjacentSupplier) {
        throw new ConflictException({
          code: "ADJACENT_SUPPLIER_AVAILABLE",
          message:
            `Le quartier adjacent ${adjacentSupplier.district.code} possède déjà le surplus nécessaire.`,
        });
      }

      const transfer = await tx.transfer.create({
        data: {
          sourceDistrictId: source.id,
          destinationDistrictId: destination.id,
          resourceTypeId: dto.resourceTypeId,
          requestedById: userId,
          quantity: dto.quantity,
          routeType: RouteType.TRANSIT,
        },
      });

      /*
       * Le fournisseur doit accepter de céder ses ressources.
       * Le quartier intermédiaire doit accepter le transit.
       */
      await tx.transferApproval.createMany({
        data: [
          {
            transferId: transfer.id,
            districtId: source.id,
            sequence: 1,
          },
          {
            transferId: transfer.id,
            districtId: transit.id,
            sequence: 2,
          },
        ],
      });

      return tx.transfer.findUnique({
        where: {
          id: transfer.id,
        },
        include: {
          sourceDistrict: true,
          destinationDistrict: true,
          resourceType: true,
          approvals: {
            include: {
              district: true,
            },
            orderBy: {
              sequence: "asc",
            },
          },
        },
      });
    });
  }


  async approveTransit(userId: number, transferId: number) {
    if (!Number.isSafeInteger(userId) || userId < 1) {
      throw new UnauthorizedException({
        code: "AUTH_REQUIRED",
        message: "Un utilisateur authentifié est nécessaire.",
      });
    }

    if (!Number.isSafeInteger(transferId) || transferId < 1) {
      throw new BadRequestException({
        code: "INVALID_TRANSFER_ID",
        message: "L'identifiant du transfert est invalide.",
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          role: true,
          districts: {
            select: { districtId: true },
          },
        },
      });

      if (!user) {
        throw new UnauthorizedException({
          code: "AUTH_USER_NOT_FOUND",
          message: "L'utilisateur n'existe pas.",
        });
      }

      if (user.role !== Role.QC) {
        throw new ForbiddenException({
          code: "TRANSIT_APPROVAL_ROLE_FORBIDDEN",
          message: "Seul un QC peut approuver une étape de transit.",
        });
      }

      const transfer = await tx.transfer.findUnique({
        where: { id: transferId },
        include: {
          approvals: {
            orderBy: {
              sequence: "asc",
            },
          },
        },
      });

      if (!transfer) {
        throw new NotFoundException({
          code: "TRANSFER_NOT_FOUND",
          message: "Ce transfert n'existe pas.",
        });
      }

      if (transfer.routeType !== RouteType.TRANSIT) {
        throw new ConflictException({
          code: "TRANSFER_ROUTE_NOT_TRANSIT",
          message: "Ce transfert n'est pas un transit.",
        });
      }

      if (transfer.status !== TransferStatus.PENDING) {
        throw new ConflictException({
          code: "TRANSFER_ALREADY_CLOSED",
          message: "Ce transfert n'est plus en attente.",
        });
      }

      const managedDistrictIds =
        user.districts.map((d) => d.districtId);

      const approval = transfer.approvals.find(
        (a) =>
          managedDistrictIds.includes(a.districtId) &&
          a.status === ApprovalStatus.PENDING,
      );

      if (!approval) {
        throw new ForbiddenException({
          code: "TRANSIT_APPROVAL_DISTRICT_FORBIDDEN",
          message: "Aucune approbation en attente pour votre district.",
        });
      }

      const previousNotApproved = transfer.approvals.find(
        (a) =>
          a.sequence < approval.sequence &&
          a.status !== ApprovalStatus.APPROVED,
      );

      if (previousNotApproved) {
        throw new ConflictException({
          code: "TRANSIT_APPROVAL_ORDER",
          message: "Les approbations doivent être effectuées dans l'ordre.",
        });
      }

      await tx.transferApproval.update({
        where: {
          id: approval.id,
        },
        data: {
          status: ApprovalStatus.APPROVED,
          approverId: userId,
          approvedAt: new Date(),
        },
      });

      const remaining = await tx.transferApproval.count({
        where: {
          transferId,
          status: {
            not: ApprovalStatus.APPROVED,
          },
        },
      });

      if (remaining === 0) {
        const state = await tx.disasterState.findUnique({
          where: {
            key: "GLOBAL",
          },
        });

        if (!state) {
          throw new ServiceUnavailableException({
            code: "DISASTER_STATE_MISSING",
            message: "Le niveau de catastrophe est indisponible.",
          });
        }

        const sourceStock = await tx.resourceStock.findFirst({
          where: {
            districtId: transfer.sourceDistrictId,
            resourceTypeId: transfer.resourceTypeId,
          },
        });

        const destinationStock =
          await tx.resourceStock.findFirst({
            where: {
              districtId: transfer.destinationDistrictId,
              resourceTypeId: transfer.resourceTypeId,
            },
          });

        if (!sourceStock || !destinationStock) {
          throw new NotFoundException({
            code: "RESOURCE_STOCK_NOT_FOUND",
            message: "Le stock source ou destination est introuvable.",
          });
        }

        const minimumRetention =
          this.allocationRules.calculateMinimumRetention(
            sourceStock.initialQuantity,
            state.retentionPercent,
          );

        const sourceUpdate =
          await tx.resourceStock.updateMany({
            where: {
              id: sourceStock.id,
              currentQuantity: {
                gte: minimumRetention + transfer.quantity,
              },
            },
            data: {
              currentQuantity: {
                decrement: transfer.quantity,
              },
            },
          });

        if (sourceUpdate.count !== 1) {
          throw new ConflictException({
            code: "RETENTION_LIMIT",
            message: "Le stock source ne permet plus ce transit.",
          });
        }

        await tx.resourceStock.update({
          where: {
            id: destinationStock.id,
          },
          data: {
            currentQuantity: {
              increment: transfer.quantity,
            },
          },
        });

        await tx.transfer.update({
          where: {
            id: transfer.id,
          },
          data: {
            status: TransferStatus.COMPLETED,
            approvedAt: new Date(),
            completedAt: new Date(),
          },
        });
      }

      return tx.transfer.findUnique({
        where: {
          id: transfer.id,
        },
        include: {
          sourceDistrict: true,
          destinationDistrict: true,
          resourceType: true,
          approvals: {
            include: {
              district: true,
            },
            orderBy: {
              sequence: "asc",
            },
          },
        },
      });
    }, {
      isolationLevel: "Serializable",
    });
  }


  async createMaritime(userId: number, dto: CreateMaritimeDto) {
    if (!Number.isSafeInteger(userId) || userId < 1) {
      throw new UnauthorizedException({
        code: "AUTH_REQUIRED",
        message: "Un utilisateur authentifié est nécessaire.",
      });
    }

    if (
      !Number.isInteger(dto.resourceTypeId) ||
      dto.resourceTypeId < 1 ||
      !Number.isInteger(dto.quantity) ||
      dto.quantity < 1
    ) {
      throw new BadRequestException({
        code: "INVALID_MARITIME_INPUT",
        message: "La ressource et la quantité doivent être valides.",
      });
    }

    const sourceCode =
      this.validateDistrictCode(dto.sourceDistrictCode);

    const destinationCode =
      this.validateDistrictCode(dto.destinationDistrictCode);

    if (sourceCode === destinationCode) {
      throw new BadRequestException({
        code: "SAME_DISTRICT_TRANSFER",
        message: "La source et la destination doivent être différentes.",
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new UnauthorizedException({
          code: "AUTH_USER_NOT_FOUND",
          message: "L'utilisateur n'existe pas.",
        });
      }

      const state = await tx.disasterState.findUnique({
        where: { key: "GLOBAL" },
      });

      if (!state) {
        throw new ServiceUnavailableException({
          code: "DISASTER_STATE_MISSING",
          message: "Le niveau de catastrophe est indisponible.",
        });
      }

      if (state.level !== 5) {
        throw new ConflictException({
          code: "MARITIME_LEVEL_FORBIDDEN",
          message:
            "La route maritime prioritaire est disponible au niveau 5.",
        });
      }

      const source = await tx.district.findUnique({
        where: { code: sourceCode },
      });

      const destination = await tx.district.findUnique({
        where: { code: destinationCode },
      });

      if (!source || !destination) {
        throw new NotFoundException({
          code: "DISTRICT_NOT_FOUND",
          message: "District introuvable.",
        });
      }

      if (!source.seaAccess || !destination.seaAccess) {
        throw new ConflictException({
          code: "MARITIME_ACCESS_FORBIDDEN",
          message:
            "La route maritime est réservée à Echo, Xeno et Zion.",
        });
      }

      const stock = await tx.resourceStock.findFirst({
        where: {
          districtId: source.id,
          resourceTypeId: dto.resourceTypeId,
        },
      });

      if (!stock) {
        throw new NotFoundException({
          code: "RESOURCE_STOCK_NOT_FOUND",
          message: "La ressource est absente du district source.",
        });
      }

      const validRetention =
        state.retentionPercent === 30 ||
        state.retentionPercent === 15;

      if (!validRetention) {
        throw new ServiceUnavailableException({
          code: "INVALID_RETENTION_CONFIGURATION",
          message: "Le seuil de rétention est invalide.",
        });
      }

      const minimumRetention =
        this.allocationRules.calculateMinimumRetention(
          stock.initialQuantity,
          state.retentionPercent,
        );

      const available =
        this.allocationRules.calculateAvailableQuantity(
          stock.currentQuantity,
          minimumRetention,
        );

      if (dto.quantity > available) {
        throw new ConflictException({
          code: "RETENTION_LIMIT",
          message:
            `Seulement ${available} unités sont disponibles.`,
        });
      }

      const transfer = await tx.transfer.create({
        data: {
          sourceDistrictId: source.id,
          destinationDistrictId: destination.id,
          resourceTypeId: dto.resourceTypeId,
          requestedById: userId,
          quantity: dto.quantity,
          routeType: RouteType.MARITIME,
        },
      });

      await tx.transferApproval.create({
        data: {
          transferId: transfer.id,
          districtId: source.id,
          sequence: 1,
        },
      });

      return tx.transfer.findUnique({
        where: { id: transfer.id },
        include: {
          sourceDistrict: true,
          destinationDistrict: true,
          resourceType: true,
          approvals: true,
        },
      });
    });
  }


  async approveMaritime(userId: number, transferId: number) {
    if (!Number.isSafeInteger(userId) || userId < 1) {
      throw new UnauthorizedException({
        code: "AUTH_REQUIRED",
        message: "Un utilisateur authentifié est nécessaire.",
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          role: true,
          districts: {
            select: { districtId: true },
          },
        },
      });

      if (!user) {
        throw new UnauthorizedException({
          code: "AUTH_USER_NOT_FOUND",
          message: "L'utilisateur n'existe pas.",
        });
      }

      if (user.role !== Role.QC) {
        throw new ForbiddenException({
          code: "MARITIME_APPROVAL_ROLE_FORBIDDEN",
          message: "Seul le QC du district fournisseur peut approuver.",
        });
      }

      const transfer = await tx.transfer.findUnique({
        where: { id: transferId },
        include: {
          approvals: true,
        },
      });

      if (!transfer) {
        throw new NotFoundException({
          code: "TRANSFER_NOT_FOUND",
          message: "Ce transfert n'existe pas.",
        });
      }

      if (transfer.routeType !== RouteType.MARITIME) {
        throw new ConflictException({
          code: "TRANSFER_ROUTE_NOT_MARITIME",
          message: "Ce transfert n'utilise pas la route maritime.",
        });
      }

      if (transfer.status !== TransferStatus.PENDING) {
        throw new ConflictException({
          code: "TRANSFER_ALREADY_PROCESSED",
          message: "Ce transfert maritime n'est plus en attente.",
        });
      }

      const managesSource = user.districts.some(
        (district) =>
          district.districtId === transfer.sourceDistrictId,
      );

      if (!managesSource) {
        throw new ForbiddenException({
          code: "MARITIME_APPROVAL_DISTRICT_FORBIDDEN",
          message: "Seul le QC du district fournisseur peut approuver.",
        });
      }

      const approval = transfer.approvals.find(
        (item) =>
          item.districtId === transfer.sourceDistrictId,
      );

      if (!approval) {
        throw new ServiceUnavailableException({
          code: "TRANSFER_APPROVAL_MISSING",
          message: "L'approbation du fournisseur est absente.",
        });
      }

      if (approval.status !== ApprovalStatus.PENDING) {
        throw new ConflictException({
          code: "TRANSFER_APPROVAL_ALREADY_PROCESSED",
          message: "Cette approbation a déjà été traitée.",
        });
      }

      const state = await tx.disasterState.findUnique({
        where: { key: "GLOBAL" },
      });

      if (!state) {
        throw new ServiceUnavailableException({
          code: "DISASTER_STATE_MISSING",
          message: "Le niveau de catastrophe est indisponible.",
        });
      }

      const sourceStock = await tx.resourceStock.findFirst({
        where: {
          districtId: transfer.sourceDistrictId,
          resourceTypeId: transfer.resourceTypeId,
        },
      });

      if (!sourceStock) {
        throw new NotFoundException({
          code: "RESOURCE_STOCK_NOT_FOUND",
          message: "Le stock source est introuvable.",
        });
      }

      const minimumRetention =
        this.allocationRules.calculateMinimumRetention(
          sourceStock.initialQuantity,
          state.retentionPercent,
        );

      const sourceUpdate =
        await tx.resourceStock.updateMany({
          where: {
            id: sourceStock.id,
            currentQuantity: {
              gte: minimumRetention + transfer.quantity,
            },
          },
          data: {
            currentQuantity: {
              decrement: transfer.quantity,
            },
          },
        });

      if (sourceUpdate.count !== 1) {
        throw new ConflictException({
          code: "RETENTION_LIMIT",
          message:
            "Le stock source ne permet plus ce transfert maritime.",
        });
      }

      await tx.transferApproval.update({
        where: { id: approval.id },
        data: {
          status: ApprovalStatus.APPROVED,
          approverId: userId,
          approvedAt: new Date(),
        },
      });

      await tx.transfer.update({
        where: { id: transfer.id },
        data: {
          status: TransferStatus.IN_TRANSIT,
          approvedAt: new Date(),
        },
      });

      return tx.transfer.findUnique({
        where: { id: transfer.id },
        include: {
          sourceDistrict: true,
          destinationDistrict: true,
          resourceType: true,
          approvals: true,
        },
      });
    }, {
      isolationLevel: "Serializable",
    });
  }


  async completeMaritime(userId: number, transferId: number) {
    if (!Number.isSafeInteger(userId) || userId < 1) {
      throw new UnauthorizedException({
        code: "AUTH_REQUIRED",
        message: "Un utilisateur authentifié est nécessaire.",
      });
    }

    if (!Number.isSafeInteger(transferId) || transferId < 1) {
      throw new BadRequestException({
        code: "INVALID_TRANSFER_ID",
        message: "L'identifiant du transfert est invalide.",
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new UnauthorizedException({
          code: "AUTH_USER_NOT_FOUND",
          message: "L'utilisateur n'existe pas.",
        });
      }

      const transfer = await tx.transfer.findUnique({
        where: { id: transferId },
      });

      if (!transfer) {
        throw new NotFoundException({
          code: "TRANSFER_NOT_FOUND",
          message: "Ce transfert n'existe pas.",
        });
      }

      if (transfer.routeType !== RouteType.MARITIME) {
        throw new ConflictException({
          code: "TRANSFER_ROUTE_NOT_MARITIME",
          message: "Ce transfert n'est pas maritime.",
        });
      }

      if (transfer.status !== TransferStatus.IN_TRANSIT) {
        throw new ConflictException({
          code: "MARITIME_NOT_IN_TRANSIT",
          message:
            "Ce transfert maritime n'est pas actuellement en transit.",
        });
      }

      const destinationStock =
        await tx.resourceStock.findFirst({
          where: {
            districtId: transfer.destinationDistrictId,
            resourceTypeId: transfer.resourceTypeId,
          },
        });

      if (!destinationStock) {
        throw new NotFoundException({
          code: "RESOURCE_STOCK_NOT_FOUND",
          message: "Le stock destination est introuvable.",
        });
      }

      await tx.resourceStock.update({
        where: {
          id: destinationStock.id,
        },
        data: {
          currentQuantity: {
            increment: transfer.quantity,
          },
        },
      });

      const result = await tx.transfer.updateMany({
        where: {
          id: transfer.id,
          status: TransferStatus.IN_TRANSIT,
        },
        data: {
          status: TransferStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      if (result.count !== 1) {
        throw new ConflictException({
          code: "MARITIME_ALREADY_COMPLETED",
          message: "Ce transfert a déjà été terminé.",
        });
      }

      return tx.transfer.findUnique({
        where: { id: transfer.id },
        include: {
          sourceDistrict: true,
          destinationDistrict: true,
          resourceType: true,
          approvals: true,
        },
      });
    }, {
      isolationLevel: "Serializable",
    });
  }


  async createRequisition(
    userId: number,
    dto: CreateRequisitionDto,
  ) {
    if (!Number.isSafeInteger(userId) || userId < 1) {
      throw new UnauthorizedException({
        code: "AUTH_REQUIRED",
        message: "Un utilisateur authentifié est nécessaire.",
      });
    }

    if (
      !Number.isInteger(dto.resourceTypeId) ||
      dto.resourceTypeId < 1 ||
      !Number.isInteger(dto.quantity) ||
      dto.quantity < 1
    ) {
      throw new BadRequestException({
        code: "INVALID_REQUISITION_INPUT",
        message: "La ressource et la quantité doivent être valides.",
      });
    }

    const sourceCode =
      this.validateDistrictCode(dto.sourceDistrictCode);

    const destinationCode =
      this.validateDistrictCode(dto.destinationDistrictCode);

    if (sourceCode === destinationCode) {
      throw new BadRequestException({
        code: "SAME_DISTRICT_REQUISITION",
        message:
          "La source et la destination doivent être différentes.",
      });
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: {
            role: true,
          },
        });

        if (!user) {
          throw new UnauthorizedException({
            code: "AUTH_USER_NOT_FOUND",
            message: "L'utilisateur n'existe pas.",
          });
        }

        if (user.role !== Role.CD) {
          throw new ForbiddenException({
            code: "REQUISITION_ROLE_FORBIDDEN",
            message:
              "Seul le City Director peut réquisitionner des ressources.",
          });
        }

        const state = await tx.disasterState.findUnique({
          where: {
            key: "GLOBAL",
          },
        });

        if (!state) {
          throw new ServiceUnavailableException({
            code: "DISASTER_STATE_MISSING",
            message:
              "Le niveau de catastrophe est indisponible.",
          });
        }

        if (state.level !== 4 && state.level !== 5) {
          throw new ConflictException({
            code: "REQUISITION_LEVEL_FORBIDDEN",
            message:
              "La réquisition est autorisée uniquement aux niveaux 4 et 5.",
          });
        }

        const source = await tx.district.findUnique({
          where: {
            code: sourceCode,
          },
        });

        const destination = await tx.district.findUnique({
          where: {
            code: destinationCode,
          },
        });

        if (!source || !destination) {
          throw new NotFoundException({
            code: "DISTRICT_NOT_FOUND",
            message: "District introuvable.",
          });
        }

        const sourceStock =
          await tx.resourceStock.findFirst({
            where: {
              districtId: source.id,
              resourceTypeId: dto.resourceTypeId,
            },
          });

        const destinationStock =
          await tx.resourceStock.findFirst({
            where: {
              districtId: destination.id,
              resourceTypeId: dto.resourceTypeId,
            },
          });

        if (!sourceStock || !destinationStock) {
          throw new NotFoundException({
            code: "RESOURCE_STOCK_NOT_FOUND",
            message:
              "Le stock source ou destination est introuvable.",
          });
        }

        const validRetention =
          state.retentionPercent === 30 ||
          (
            state.level === 5 &&
            state.retentionPercent === 15
          );

        if (!validRetention) {
          throw new ServiceUnavailableException({
            code: "INVALID_RETENTION_CONFIGURATION",
            message: "Le seuil de rétention est invalide.",
          });
        }

        const minimumRetention =
          this.allocationRules.calculateMinimumRetention(
            sourceStock.initialQuantity,
            state.retentionPercent,
          );

        const sourceUpdate =
          await tx.resourceStock.updateMany({
            where: {
              id: sourceStock.id,
              currentQuantity: {
                gte:
                  minimumRetention +
                  dto.quantity,
              },
            },
            data: {
              currentQuantity: {
                decrement: dto.quantity,
              },
            },
          });

        if (sourceUpdate.count !== 1) {
          throw new ConflictException({
            code: "RETENTION_LIMIT",
            message:
              "La réquisition violerait le seuil minimal de rétention.",
          });
        }

        await tx.resourceStock.update({
          where: {
            id: destinationStock.id,
          },
          data: {
            currentQuantity: {
              increment: dto.quantity,
            },
          },
        });

        return tx.transfer.create({
          data: {
            sourceDistrictId: source.id,
            destinationDistrictId: destination.id,
            resourceTypeId: dto.resourceTypeId,
            requestedById: userId,
            quantity: dto.quantity,
            routeType: RouteType.REQUISITION,
            status: TransferStatus.COMPLETED,
            completedAt: new Date(),
          },
          include: {
            sourceDistrict: true,
            destinationDistrict: true,
            resourceType: true,
            approvals: true,
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
          code: "CONCURRENT_REQUISITION",
          message:
            "Les stocks ont été modifiés simultanément. Réessayez.",
        });
      }

      throw error;
    }
  }

}import { CreateRequisitionDto } from "./transfer.dto";

