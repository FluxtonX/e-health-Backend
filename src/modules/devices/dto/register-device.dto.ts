import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeviceCategory } from '@prisma/client';
import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class RegisterDeviceDto {
  @ApiProperty({ example: 'United Union Smart Wristband V2' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'UU-WB2-PRO' })
  @IsString()
  @IsNotEmpty()
  model: string;

  @ApiProperty({ enum: DeviceCategory, example: DeviceCategory.WRISTBAND })
  @IsEnum(DeviceCategory)
  category: DeviceCategory;

  @ApiPropertyOptional({ example: 92 })
  @IsNumber()
  @IsOptional()
  batteryPercent?: number;

  @ApiPropertyOptional({ example: 'v2.4.1' })
  @IsString()
  @IsOptional()
  firmwareVersion?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
