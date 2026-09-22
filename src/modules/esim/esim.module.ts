import { Module } from '@nestjs/common';
import { EsimController } from './esim.controller';
import { EsimService } from './esim.service';

@Module({
  controllers: [EsimController],
  providers: [EsimService],
  exports: [EsimService],
})
export class EsimModule {}
