import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ResourcesController } from "./resources.controller";
import { ResourcesService } from "./resources.service";
import { AllocationRulesService } from "./allocation-rules.service";
import { ReservationsService } from "./reservations.service";
import { TransfersService } from "./transfers.service";

@Module({
  imports: [PrismaModule],
  controllers: [ResourcesController],
  providers: [
    ResourcesService,
    AllocationRulesService,
    ReservationsService,
    TransfersService,
  ],
  exports: [
    ResourcesService,
    AllocationRulesService,
    ReservationsService,
    TransfersService,
  ],
})
export class ResourcesModule {}
