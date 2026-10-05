import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AiChatDto {
  @ApiProperty({
    example:
      'Can you summarize my sleep and resting heart rate trends from this week?',
  })
  @IsString()
  @IsNotEmpty()
  message: string;
}
