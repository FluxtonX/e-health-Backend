import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { CreateMetricDto } from './create-metric.dto';

export class BatchMetricsDto {
  @ApiProperty({ type: [CreateMetricDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMetricDto)
  metrics: CreateMetricDto[];
}
