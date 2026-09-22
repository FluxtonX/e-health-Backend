import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BrevoMailService } from './brevo-mail.service';

@Module({
  imports: [ConfigModule],
  providers: [BrevoMailService],
  exports: [BrevoMailService],
})
export class MailModule {}
