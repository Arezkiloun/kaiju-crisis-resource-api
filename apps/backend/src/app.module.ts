import { Module } from "@nestjs/common";
import { DistrictsModule } from "./districts/districts.module";
import { ResourcesModule } from "./resources/resources.module";
import { DisasterModule } from "./disaster/disaster.module";

@Module({
  imports: [
    DistrictsModule,
    ResourcesModule,
    DisasterModule,
  ],
})
export class AppModule {}