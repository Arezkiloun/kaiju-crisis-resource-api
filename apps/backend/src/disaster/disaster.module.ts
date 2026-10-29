import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { DisasterController } from "./disaster.controller";
import { DisasterService } from "./disaster.service";

@Module({
  imports: [PrismaModule],
  controllers: [DisasterController],
  providers: [DisasterService],
  exports: [DisasterService],
})
export class DisasterModule {}