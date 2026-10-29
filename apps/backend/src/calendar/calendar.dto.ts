import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class CreateCalendarEventDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  startAt!: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  districtId?: number;
}