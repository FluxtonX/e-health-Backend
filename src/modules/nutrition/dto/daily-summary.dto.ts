import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class DailySummaryQueryDto {
  @ApiPropertyOptional({
    example: '2026-09-29',
    description:
      'Target date in YYYY-MM-DD or ISO 8601 format (defaults to current date)',
  })
  @IsString()
  @IsOptional()
  date?: string;
}

export class LogWaterDto {
  @ApiProperty({
    example: 250,
    description: 'Volume of water consumed in milliliters (ml)',
  })
  @IsNumber()
  @IsPositive()
  amountMl: number;
}
