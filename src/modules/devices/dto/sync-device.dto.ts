import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConnectionStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class SyncDeviceDto {
  @ApiProperty({ example: 'dev_wristband_01' })
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @ApiPropertyOptional({ enum: ConnectionStatus })
  @IsEnum(ConnectionStatus)
  @IsOptional()
  status?: ConnectionStatus;

  @ApiPropertyOptional({ example: 88 })
  @IsNumber()
  @IsOptional()
  batteryPercent?: number;
}
