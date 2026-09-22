import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Enable CORS for mobile app, web apps, and clinician admin portal
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global API route prefix aligning with Flutter AppConfig
  app.setGlobalPrefix('v1');

  // Strict Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // HIPAA / PHI-Safe Exception Filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Interactive Swagger / OpenAPI Specification
  const config = new DocumentBuilder()
    .setTitle('United Union Health API')
    .setDescription(
      'Enterprise REST API for United Union Health mobile application, clinician care portal, and biometric telemetry synchronization.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter your JWT access token (Bearer <token>)',
        in: 'header',
      },
      'bearer',
    )
    .addTag('Authentication', 'Member credential authentication & JWT session management')
    .addTag('User Profile', 'Demographics, biological sex, height, weight, emergency contacts')
    .addTag('Health Metrics & Telemetry', 'Continuous PPG, SpO2, Sleep stages, Steps, and Activity')
    .addTag('Devices & Hardware', 'Wearable wristband, Apple HealthKit, Smart Scale, and BLE devices')
    .addTag('Doctor & Clinical Care', 'Physician profiles, electronic notes, and shared reports')
    .addTag('Health Targets & Goals', 'Clinician and member personal targets')
    .addTag('AI Wellness Advisor', 'Telemetry-grounded companion with clinical safety boundaries')
    .addTag('Mental Wellness & Reflection', 'Mood check-ins and restorative audio sessions')
    .addTag('Nutrition & Food Scanner', 'Daily macronutrients and Vision AI meal recognition')
    .addTag('Notifications & Alerts', 'Clinical alerts, goal achievements, and synchronization updates')
    .addTag('eSIM & Cellular Telemetry', 'Global cellular data connectivity and roaming status')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'United Union Health API Documentation',
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`🚀 United Union Health Backend is running on: http://localhost:${port}/v1`);
  logger.log(`📖 Swagger API documentation is available at: http://localhost:${port}/api/docs`);
}

bootstrap();
