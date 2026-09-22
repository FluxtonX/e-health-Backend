import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateMoodLogDto {
  @ApiProperty({ example: 'Energized' })
  @IsString()
  @IsNotEmpty()
  moodLabel: string;

  @ApiProperty({ example: '⚡' })
  @IsString()
  @IsNotEmpty()
  emoji: string;

  @ApiPropertyOptional({ example: 'Completed zone 2 walk and feel clear headed.' })
  @IsString()
  @IsOptional()
  reflectionNotes?: string;
}
