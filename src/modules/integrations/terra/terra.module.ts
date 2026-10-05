import { Module } from '@nestjs/common';
import { TerraController } from './terra.controller';
import { TerraService } from './terra.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [TerraController],
  providers: [TerraService],
  exports: [TerraService],
})
export class TerraModule {}
