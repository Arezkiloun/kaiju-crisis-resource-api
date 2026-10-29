import { Controller, Get, Param } from "@nestjs/common";
import { DistrictsService } from "./districts.service";

@Controller("districts")
export class DistrictsController {
  constructor(private readonly districtsService: DistrictsService) {}
  

  // recuperer tous les district
  @Get()
  findAll() {
    return this.districtsService.findAll();
  }
//  recuperer les voissinage d'un district
  @Get(":code/neighbors")
  findNeighbors(@Param("code") code: string) {
    return this.districtsService.findNeighbors(code);
  }

  
  @Get(":code")
  findOne(@Param("code") code: string) {
    return this.districtsService.findOne(code);
  }
}
