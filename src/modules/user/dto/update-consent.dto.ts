import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateConsentDto {
  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  continuousWearableStream?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  bloodBiomarkers?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  mentalWellness?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  doctorElectronicAccess?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  aiAdvisorProcessing?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  researchAlliance?: boolean;
}
