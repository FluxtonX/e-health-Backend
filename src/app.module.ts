import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { HealthModule } from './modules/health/health.module';
import { DevicesModule } from './modules/devices/devices.module';
import { DoctorModule } from './modules/doctor/doctor.module';
import { GoalsModule } from './modules/goals/goals.module';
import { AiAdvisorModule } from './modules/ai-advisor/ai-advisor.module';
import { MentalWellnessModule } from './modules/mental-wellness/mental-wellness.module';
import { NutritionModule } from './modules/nutrition/nutrition.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { EsimModule } from './modules/esim/esim.module';
import { MailModule } from './modules/mail/mail.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    HealthModule,
    DevicesModule,
    DoctorModule,
    GoalsModule,
    AiAdvisorModule,
    MentalWellnessModule,
    NutritionModule,
    NotificationsModule,
    EsimModule,
    MailModule,
  ],
})
export class AppModule {}
