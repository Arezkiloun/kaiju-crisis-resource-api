import {
  ForbiddenException,
  ConflictException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Role } from "../generated/prisma/enums";

/*l’utilisateur possède le rôle QC 
  il appartient au district du stock 
  le niveau de catastrophe autorise les réservations : 2 à 5.¨*/

export function assertCanReserve(
  role: Role,
  belongsToDistrict: boolean,
  level: number,
): void {
  if (!Number.isInteger(level) || level < 1 || level > 5) {
    throw new ServiceUnavailableException({
      code: "INVALID_DISASTER_LEVEL",
      message: "Le niveau de catastrophe est invalide.",
    });
  }

  if (role !== Role.QC) {
    throw new ForbiddenException({
      code: "RESERVATION_ROLE_FORBIDDEN",
      message: "Seul un QC peut réserver des ressources.",
    });
  }

  if (!belongsToDistrict) {
    throw new ForbiddenException({
      code: "RESERVATION_DISTRICT_FORBIDDEN",
      message: "Un QC peut réserver uniquement dans son district.",
    });
  }

  if (level === 1) {
    throw new ConflictException({
      code: "RESERVATION_LEVEL_FORBIDDEN",
      message: "Les réservations sont interdites au niveau 1.",
    });
  }
}
