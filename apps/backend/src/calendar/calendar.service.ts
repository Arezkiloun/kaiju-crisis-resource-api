import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { CreateCalendarEventDto } from "./calendar.dto";

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}


//   retourne les événements triés par date de début.

  async findAll() {
    return this.prisma.calendarEvent.findMany({
      include: {
        district: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: {
        startAt: "asc",
      },
    });
  }

//   vérifie que la fin est après le début et 
// que le district indiqué existe, puis enregistre l’événement.

  async create(
    userId: number,
    dto: CreateCalendarEventDto,
  ) {
    const startAt = new Date(dto.startAt);

    const endAt = dto.endAt
      ? new Date(dto.endAt)
      : null;

    if (
      endAt &&
      endAt.getTime() <= startAt.getTime()
    ) {
      throw new BadRequestException(
        "La date de fin doit être après la date de début.",
      );
    }

    if (dto.districtId) {
      const district =
        await this.prisma.district.findUnique({
          where: {
            id: dto.districtId,
          },
        });

      if (!district) {
        throw new NotFoundException(
          "District introuvable.",
        );
      }
    }

    return this.prisma.calendarEvent.create({
      data: {
        title: dto.title.trim(),
        description:
          dto.description?.trim() || null,
        startAt,
        endAt,
        districtId: dto.districtId ?? null,
        createdById: userId,
      },
      include: {
        district: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });
  }

//   autorise la suppression au créateur


  async remove(
    userId: number,
    role: string,
    eventId: number,
  ) {
    const event =
      await this.prisma.calendarEvent.findUnique({
        where: {
          id: eventId,
        },
      });

    if (!event) {
      throw new NotFoundException(
        "Événement introuvable.",
      );
    }

    if (
      event.createdById !== userId &&
      role !== "CD"
    ) {
      throw new ForbiddenException(
        "Vous ne pouvez pas supprimer cet événement.",
      );
    }

    await this.prisma.calendarEvent.delete({
      where: {
        id: eventId,
      },
    });

    return {
      success: true,
      id: eventId,
    };
  }
}
