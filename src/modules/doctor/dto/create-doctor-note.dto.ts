import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class CreateDoctorNoteDto {
  @ApiProperty({ example: 'usr_patient_id' })
  @IsString()
  @IsNotEmpty()
  patientId: string;

  @ApiProperty({ example: 'Quarterly Cardiovascular Follow-up' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ example: 'Resting heart rate has improved by 4 bpm...' })
  @IsString()
  @IsNotEmpty()
  noteText: string;

  @ApiProperty({
    example: [
      'Maintain 45 minutes of aerobic exercise 4x weekly',
      'Target sleep duration above 7.5 hours nightly',
    ],
  })
  @IsArray()
  @IsString({ each: true })
  recommendations: string[];
}
