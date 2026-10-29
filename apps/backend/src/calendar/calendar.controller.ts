import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CalendarService } from "./calendar.service";
import { CreateCalendarEventDto } from "./calendar.dto";

type AuthenticatedRequest = {
  user: {
    id: number;
    email: string;
    role: string;
  };
};

@Controller("calendar")
@UseGuards(JwtAuthGuard)
export class CalendarController {
  constructor(
    private readonly calendarService: CalendarService,
  ) {}

  @Get()
  findAll() {
    return this.calendarService.findAll();
  }

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateCalendarEventDto,
  ) {
    return this.calendarService.create(
      request.user.id,
      dto,
    );
  }

  @Delete(":id")
  remove(
    @Req() request: AuthenticatedRequest,
    @Param("id", ParseIntPipe) eventId: number,
  ) {
    return this.calendarService.remove(
      request.user.id,
      request.user.role,
      eventId,
    );
  }
}
