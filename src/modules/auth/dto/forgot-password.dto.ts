import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'member@unitedunionhealth.com' })
  @IsEmail()
  email: string;
}
