import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class ScanFoodDto {
  @ApiPropertyOptional({
    example: 'data:image/jpeg;base64,...',
    description: 'Base64 image or image URL from camera or gallery',
  })
  @IsString()
  @IsOptional()
  imageBase64?: string;

  @ApiPropertyOptional({
    example: 'Chicken Curry',
    description: 'Direct food query or manual correction string',
  })
  @IsString()
  @IsOptional()
  foodQuery?: string;

  @ApiPropertyOptional({
    example: '9300652009491',
    description: 'Scanned EAN/UPC barcode for OpenFoodFacts lookup',
  })
  @IsString()
  @IsOptional()
  barcode?: string;

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

  @ApiPropertyOptional({
    example: 0,
    description: 'Water in ml associated with meal',
  })
  @IsNumber()
  @IsOptional()
  waterMl?: number;

  @ApiPropertyOptional({
    example: 'LUNCH',
    description: 'Meal category (BREAKFAST, LUNCH, DINNER, SNACK)',
  })
  @IsString()
  @IsOptional()
  mealType?: string;

  @ApiPropertyOptional({
    example: '9300633852109',
    description: 'Scanned EAN/UPC barcode',
  })
  @IsString()
  @IsOptional()
  barcode?: string;

  @ApiPropertyOptional({ example: 0.94 })
  @IsNumber()
  @IsOptional()
  confidenceScore?: number;
}
