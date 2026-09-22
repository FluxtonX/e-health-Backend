import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class ScanFoodDto {
  @ApiProperty({ example: 'data:image/jpeg;base64,...', description: 'Base64 image or image URL' })
  @IsString()
  @IsNotEmpty()
  imageBase64: string;

  @ApiPropertyOptional({ example: 'lunch' })
  @IsString()
  @IsOptional()
  mealType?: string;
}

export class LogMealDto {
  @ApiProperty({ example: 'Grilled Chicken Breast & Roasted Vegetables' })
  @IsString()
  @IsNotEmpty()
  foodName: string;

  @ApiPropertyOptional({ example: '320g • High Protein / Low Glycemic' })
  @IsString()
  @IsOptional()
  portionDescription?: string;

  @ApiPropertyOptional({ example: 320 })
  @IsNumber()
  @IsOptional()
  portionGrams?: number;

  @ApiProperty({ example: 380 })
  @IsNumber()
  calories: number;

  @ApiProperty({ example: 42 })
  @IsNumber()
  proteinGrams: number;

  @ApiProperty({ example: 14 })
  @IsNumber()
  carbsGrams: number;

  @ApiProperty({ example: 8 })
  @IsNumber()
  fatsGrams: number;

  @ApiPropertyOptional({ example: 0.94 })
  @IsNumber()
  @IsOptional()
  confidenceScore?: number;
}
