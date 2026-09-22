import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateGoalDto {
  @ApiProperty({ example: 'Daily Steps' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: '10,000 steps' })
  @IsString()
  @IsNotEmpty()
  target: string;

  @ApiProperty({ example: '8,430 steps' })
  @IsString()
  @IsNotEmpty()
  current: string;

  @ApiPropertyOptional({ example: 0.84 })
  @IsNumber()
  @IsOptional()
  progress?: number;

  @ApiPropertyOptional({ example: 'directions_walk_rounded' })
  @IsString()
  @IsOptional()
  iconName?: string;

  @ApiPropertyOptional({ example: 'Personal Goal' })
  @IsString()
  @IsOptional()
  setBy?: string;
}
