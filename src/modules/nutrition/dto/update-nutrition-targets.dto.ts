import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional } from 'class-validator';

export class UpdateNutritionTargetsDto {
  @ApiPropertyOptional({ example: 2200 })
  @IsNumber()
  @IsOptional()
  dailyCaloriesKcal?: number;

  @ApiPropertyOptional({ example: 140 })
  @IsNumber()
  @IsOptional()
  proteinGrams?: number;

  @ApiPropertyOptional({ example: 210 })
  @IsNumber()
  @IsOptional()
  carbsGrams?: number;

  @ApiPropertyOptional({ example: 65 })
  @IsNumber()
  @IsOptional()
  fatsGrams?: number;
}
