import {
  Body,
  Controller,
  Get,
  Put,
  Req,
  UnauthorizedException,
} from "@nestjs/common";

import { DisasterService } from "./disaster.service";
import { UpdateLevelDto } from "./dto/update-level.dto";
import { UpdateRetentionDto } from "./dto/update-retention.dto";

type AuthenticatedRequest = {
  user?: {
    id: number;
    role: string;
  };
};

@Controller("disaster")
export class DisasterController {
  constructor(
    private readonly disasterService: DisasterService,
  ) {}

  private getUserId(
    request: AuthenticatedRequest,
  ): number {
    if (!request.user?.id) {
      throw new UnauthorizedException(
        "Authentification requise.",
      );
    }

    return request.user.id;
  }

  @Get()
  getState() {
    return this.disasterService.getState();
  }

  @Put("level")
  updateLevel(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateLevelDto,
  ) {
    return this.disasterService.updateLevel(
      this.getUserId(request),
      dto,
    );
  }

  @Put("retention")
  updateRetention(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateRetentionDto,
  ) {
    return this.disasterService.updateRetention(
      this.getUserId(request),
      dto,
    );
  }
}
