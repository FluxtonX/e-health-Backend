import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ example: 'sample_refresh_token_jwt' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
