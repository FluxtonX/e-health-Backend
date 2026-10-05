import { ApiPropertyOptional } from '@nestjs/swagger';
import { MetricType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export class QueryMetricDto {
  @ApiPropertyOptional({ enum: MetricType })
  @IsEnum(MetricType)
  @IsOptional()
  type?: MetricType;

  @ApiPropertyOptional({ example: '2026-09-01T00:00:00.000Z' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-09-16T23:59:59.000Z' })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ example: 7 })
  @IsOptional()
  days?: number;
}
