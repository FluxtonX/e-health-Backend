import { ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, SubscriptionTier } from '@prisma/client';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Elena' })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Vance' })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @ApiPropertyOptional({ example: '1994-06-15' })
  @IsDateString()
  @IsOptional()
  birthdate?: string;

  @ApiPropertyOptional({ example: 172.0 })
  @IsNumber()
  @IsOptional()
  heightCm?: number;

  @ApiPropertyOptional({ example: 64.5 })
  @IsNumber()
  @IsOptional()
  weightKg?: number;

  @ApiPropertyOptional({ example: 'O+' })
  @IsString()
  @IsOptional()
  bloodType?: string;

  @ApiPropertyOptional({ example: 'Marcus Vance' })
  @IsString()
  @IsOptional()
  emergencyContactName?: string;

  @ApiPropertyOptional({ example: '+1-555-019-2834' })
  @IsString()
  @IsOptional()
  emergencyContactPhone?: string;

  @ApiPropertyOptional({ enum: SubscriptionTier })
  @IsEnum(SubscriptionTier)
  @IsOptional()
  subscriptionTier?: SubscriptionTier;
}
