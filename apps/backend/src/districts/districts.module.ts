import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { DistrictsController } from "./districts.controller";
import { DistrictsService } from "./districts.service";

@Module({
  imports: [PrismaModule],
  controllers: [DistrictsController],
  providers: [DistrictsService],
})
export class DistrictsModule {}