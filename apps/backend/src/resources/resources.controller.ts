import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { ResourcesService } from "./resources.service";
import { ReservationsService } from "./reservations.service";
import { TransfersService } from "./transfers.service";
import { CreateTransferDto, CreateTransitDto, CreateMaritimeDto } from "./transfer.dto";
import { CreateReservationDto } from "./dto";

import { CreateRequisitionDto } from "./transfer.dto";
@Controller("resources")
export class ResourcesController {
  constructor(
    private readonly resourcesService: ResourcesService,
    private readonly reservationsService: ReservationsService,
    private readonly transfersService: TransfersService,
  ) {}
  // recuperer les resources 
  @Get()
  findAll() {
    return this.resourcesService.findAll();
  }

  @Get("district/:code/availability")
  findAvailabilityByDistrict(@Param("code") code: string) {
    return this.resourcesService.findAvailabilityByDistrict(code);
  }

  @Get("district/:code")
  findByDistrict(@Param("code") code: string) {
    return this.resourcesService.findByDistrict(code);
  }

  @Post("reservations")
  createReservation(
    @Headers("x-user-id") userIdHeader: string,
    @Body() dto: CreateReservationDto,
  ) {
    const userId = Number(userIdHeader);

    if (!Number.isSafeInteger(userId) || userId < 1) {
      throw new UnauthorizedException({
        code: "AUTH_REQUIRED",
        message: "Le header x-user-id est requis pour ce test.",
      });
    }

    return this.reservationsService.create(userId, dto);
  }

  @Post("reservations/:id/return")
  @HttpCode(200)
  returnReservation(
    @Headers("x-user-id") userIdHeader: string,
    @Param("id", ParseIntPipe) reservationId: number,
  ) {
    const userId = Number(userIdHeader);

    if (!Number.isSafeInteger(userId) || userId < 1) {
      throw new UnauthorizedException({
        code: "AUTH_REQUIRED",
        message: "Le header x-user-id est requis pour ce test.",
      });
    }

    return this.reservationsService.returnReservation(
      userId,
      reservationId,
    );
  }

  @Post("transfers")
  createTransfer(
    @Headers("x-user-id") userIdHeader: string,
    @Body() dto: CreateTransferDto,
  ) {
    const userId = Number(userIdHeader);

    if (!Number.isSafeInteger(userId) || userId < 1) {
      throw new UnauthorizedException({
        code: "AUTH_REQUIRED",
        message: "Le header x-user-id est requis pour ce test.",
      });
    }

    return this.transfersService.create(userId, dto);
  }


  @Post("transfers/:id/approve")
  @HttpCode(200)
  approveTransfer(
    @Headers("x-user-id") userIdHeader: string,
    @Param("id", ParseIntPipe) transferId: number,
  ) {
    const userId = Number(userIdHeader);

    if (!Number.isSafeInteger(userId) || userId < 1) {
      throw new UnauthorizedException({
        code: "AUTH_REQUIRED",
        message: "Le header x-user-id est requis pour ce test.",
      });
    }

    return this.transfersService.approve(userId, transferId);
  }


  @Post("transfers/:id/reject")
  @HttpCode(200)
  rejectTransfer(
    @Headers("x-user-id") userIdHeader: string,
    @Param("id", ParseIntPipe) transferId: number,
  ) {
    const userId = Number(userIdHeader);

    if (!Number.isSafeInteger(userId) || userId < 1) {
      throw new UnauthorizedException({
        code: "AUTH_REQUIRED",
        message: "Le header x-user-id est requis pour ce test.",
      });
    }

    return this.transfersService.reject(userId, transferId);
  }


  @Post("transfers/transit")
  createTransit(
    @Headers("x-user-id") userIdHeader: string,
    @Body() dto: CreateTransitDto,
  ) {
    const userId = Number(userIdHeader);

    if (!Number.isSafeInteger(userId) || userId < 1) {
      throw new UnauthorizedException({
        code: "AUTH_REQUIRED",
        message: "Le header x-user-id est requis pour ce test.",
      });
    }

    return this.transfersService.createTransit(
      userId,
      dto,
    );
  }


  @Post("transfers/:id/transit/approve")
  @HttpCode(200)
  approveTransit(
    @Headers("x-user-id") userIdHeader: string,
    @Param("id", ParseIntPipe) transferId: number,
  ) {
    const userId = Number(userIdHeader);

    if (!Number.isSafeInteger(userId) || userId < 1) {
      throw new UnauthorizedException({
        code: "AUTH_REQUIRED",
        message: "Le header x-user-id est requis pour ce test.",
      });
    }

    return this.transfersService.approveTransit(
      userId,
      transferId,
    );
  }


  @Post("transfers/maritime")
  createMaritime(
    @Headers("x-user-id") userIdHeader: string,
    @Body() dto: CreateMaritimeDto,
  ) {
    const userId = Number(userIdHeader);

    if (!Number.isSafeInteger(userId) || userId < 1) {
      throw new UnauthorizedException({
        code: "AUTH_REQUIRED",
        message: "Le header x-user-id est requis pour ce test.",
      });
    }

    return this.transfersService.createMaritime(
      userId,
      dto,
    );
  }


  @Post("transfers/:id/maritime/approve")
  @HttpCode(200)
  approveMaritime(
    @Headers("x-user-id") userIdHeader: string,
    @Param("id", ParseIntPipe) transferId: number,
  ) {
    const userId = Number(userIdHeader);

    if (!Number.isSafeInteger(userId) || userId < 1) {
      throw new UnauthorizedException({
        code: "AUTH_REQUIRED",
        message: "Le header x-user-id est requis pour ce test.",
      });
    }

    return this.transfersService.approveMaritime(
      userId,
      transferId,
    );
  }

  @Post("transfers/:id/maritime/complete")
  @HttpCode(200)
  completeMaritime(
    @Headers("x-user-id") userIdHeader: string,
    @Param("id", ParseIntPipe) transferId: number,
  ) {
    const userId = Number(userIdHeader);

    if (!Number.isSafeInteger(userId) || userId < 1) {
      throw new UnauthorizedException({
        code: "AUTH_REQUIRED",
        message: "Le header x-user-id est requis pour ce test.",
      });
    }

    return this.transfersService.completeMaritime(
      userId,
      transferId,
    );
  }


  @Post("transfers/requisition")
  createRequisition(
    @Headers("x-user-id") userIdHeader: string,
    @Body() dto: CreateRequisitionDto,
  ) {
    const userId = Number(userIdHeader);

    if (!Number.isSafeInteger(userId) || userId < 1) {
      throw new UnauthorizedException({
        code: "AUTH_REQUIRED",
        message: "Le header x-user-id est requis pour ce test.",
      });
    }

    return this.transfersService.createRequisition(
      userId,
      dto,
    );
  }

}
