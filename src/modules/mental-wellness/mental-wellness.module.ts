import { Module } from '@nestjs/common';
import { MentalWellnessController } from './mental-wellness.controller';
import { MentalWellnessService } from './mental-wellness.service';

@Module({
  controllers: [MentalWellnessController],
  providers: [MentalWellnessService],
  exports: [MentalWellnessService],
})
export class MentalWellnessModule {}
