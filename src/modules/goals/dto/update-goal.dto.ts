import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateGoalDto {
  @ApiPropertyOptional({ example: '8,950 steps' })
  @IsString()
  @IsOptional()
  current?: string;

  @ApiPropertyOptional({ example: 0.89 })
  @IsNumber()
  @IsOptional()
  progress?: number;

  @ApiPropertyOptional({ example: '12,000 steps' })
  @IsString()
  @IsOptional()
  target?: string;
}
