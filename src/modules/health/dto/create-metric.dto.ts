import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HealthDataSource, MetricType, SyncStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateMetricDto {
  @ApiProperty({ enum: MetricType, example: MetricType.HEART_RATE })
  @IsEnum(MetricType)
  type: MetricType;

  @ApiProperty({ example: 72.0 })
  @IsNumber()
  value: number;

  @ApiProperty({ example: 'bpm' })
  @IsString()
  unit: string;

  @ApiPropertyOptional({
    enum: HealthDataSource,
    default: HealthDataSource.WRISTBAND,
  })
  @IsEnum(HealthDataSource)
  @IsOptional()
  source?: HealthDataSource;

  @ApiPropertyOptional({ enum: SyncStatus, default: SyncStatus.SYNCED })
  @IsEnum(SyncStatus)
  @IsOptional()
  syncStatus?: SyncStatus;

  @ApiPropertyOptional({ example: '2026-09-16T12:00:00.000Z' })
  @IsDateString()
  @IsOptional()
  timestamp?: string;

  @ApiPropertyOptional({ example: { restingBpm: 64, minBpm: 58, maxBpm: 124 } })
  @IsOptional()
  metadata?: Record<string, any>;
}
