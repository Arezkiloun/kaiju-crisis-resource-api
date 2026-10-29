import { IsIn, IsInt } from "class-validator";

export class UpdateRetentionDto {
  @IsInt()
  @IsIn([15, 30])
  retentionPercent!: number;
}

