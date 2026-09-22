import { ApiProperty } from '@nestjs/swagger';

export class ApiResponseDto<T> {
  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Operation completed successfully' })
  message?: string;

  data?: T;

  @ApiProperty({ example: '2026-09-16T12:00:00.000Z' })
  timestamp: string;
}
