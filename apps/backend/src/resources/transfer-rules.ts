import {
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Role } from "../generated/prisma/enums";

export function assertCanRequestDirectTransfer(
  role: Role,
  managesDestination: boolean,
  level: number,
): void {
  if (!Number.isInteger(level) || level < 1 || level > 5) {
    throw new ServiceUnavailableException({
      code: "INVALID_DISASTER_LEVEL",
      message: "Le niveau de catastrophe est invalide.",
    });
  }

  if (level <= 2) {
    throw new ConflictException({
      code: "TRANSFER_LEVEL_FORBIDDEN",
      message: "Les transferts sont interdits aux niveaux 1 et 2.",
    });
  }

  if (level === 3 && role !== Role.QC) {
    throw new ForbiddenException({
      code: "TRANSFER_ROLE_FORBIDDEN",
      message: "Seul un QC peut demander un transfert direct au niveau 3.",
    });
  }

  if (
    level === 4 &&
    role !== Role.QC &&
    role !== Role.LC
  ) {
    throw new ForbiddenException({
      code: "TRANSFER_ROLE_FORBIDDEN",
      message: "Seuls un QC ou un LC peuvent demander ce transfert au niveau 4.",
    });
  }

  if (
    role !== Role.CD &&
    !managesDestination
  ) {
    throw new ForbiddenException({
      code: "TRANSFER_DISTRICT_FORBIDDEN",
      message: "Vous ne gérez pas le district destinataire.",
    });
  }
}

export function assertCanOrganizeTransit(
  role: Role,
  level: number,
): void {
  if (!Number.isInteger(level) || level < 1 || level > 5) {
    throw new ServiceUnavailableException({
      code: "INVALID_DISASTER_LEVEL",
      message: "Le niveau de catastrophe est invalide.",
    });
  }

  if (level < 4) {
    throw new ConflictException({
      code: "TRANSIT_LEVEL_FORBIDDEN",
      message: "Le transit est disponible uniquement aux niveaux 4 et 5.",
    });
  }

  if (level === 4 && role !== Role.LC) {
    throw new ForbiddenException({
      code: "TRANSIT_ROLE_FORBIDDEN",
      message: "Seul un LC peut organiser un transit au niveau 4.",
    });
  }

  if (
    level === 5 &&
    role !== Role.LC &&
    role !== Role.CD
  ) {
    throw new ForbiddenException({
      code: "TRANSIT_ROLE_FORBIDDEN",
      message: "Seuls un LC ou un CD peuvent organiser un transit au niveau 5.",
    });
  }
}
