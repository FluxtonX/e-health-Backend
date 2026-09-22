import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('United Union Health API (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Authentication Module', () => {
    it('POST /v1/auth/login - should authenticate Elena Vance with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: 'member@unitedunionhealth.com',
          password: 'Password123!',
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user).toHaveProperty('email', 'member@unitedunionhealth.com');
      expect(response.body.user).toHaveProperty('firstName', 'Elena');
      expect(response.body.user).toHaveProperty('lastName', 'Vance');

      accessToken = response.body.accessToken;
      userId = response.body.user.id;
    });

    it('POST /v1/auth/login - should reject invalid credentials', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: 'member@unitedunionhealth.com',
          password: 'WrongPassword!',
        })
        .expect(401);
    });
  });

  describe('2. User Profile Module', () => {
    it('GET /v1/user/profile - should return complete member demographics', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/user/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.email).toBe('member@unitedunionhealth.com');
      expect(response.body.fullName).toBe('Elena Vance');
      expect(response.body.profile).toBeDefined();
      expect(response.body.profile.subscriptionTier).toBe('GLOBAL_TIER');
    });
  });

  describe('3. Health Telemetry Module', () => {
    it('GET /v1/health/metrics/summary - should return core vitals for dashboard', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/health/metrics/summary')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('heartRate');
      expect(response.body.heartRate.bpm).toBeGreaterThan(60);
      expect(response.body).toHaveProperty('spo2');
      expect(response.body.spo2.percentage).toBeGreaterThan(95);
      expect(response.body).toHaveProperty('sleep');
      expect(response.body.sleep.efficiencyScore).toBe(89);
      expect(response.body).toHaveProperty('steps');
      expect(response.body.steps.count).toBe(8430);
    });

    it('POST /v1/health/metrics/batch - should ingest wearable batch telemetry', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/health/metrics/batch')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          metrics: [
            {
              type: 'HEART_RATE',
              value: 74,
              unit: 'bpm',
              source: 'WRISTBAND',
              timestamp: new Date().toISOString(),
            },
            {
              type: 'SPO2',
              value: 99.0,
              unit: '%',
              source: 'WRISTBAND',
              timestamp: new Date().toISOString(),
            },
          ],
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.recordsIngested).toBe(2);
    });
  });

  describe('4. Connected Devices Module', () => {
    it('GET /v1/devices - should return list of paired devices', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/devices')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(1);
      const wristband = response.body.find((d: any) => d.model === 'UU-WB2-PRO');
      expect(wristband).toBeDefined();
      expect(wristband.isDefault).toBe(true);
    });
  });

  describe('5. Doctor & Clinical Care Module', () => {
    it('GET /v1/doctor/overview - should return Dr. Sarah Jenkins profile and review status', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/doctor/overview')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.name).toContain('Dr. Sarah Jenkins');
      expect(response.body.clinicName).toContain('United Union Health Care Alliance');
      expect(response.body.isTelemetryActive).toBe(true);
    });

    it('GET /v1/doctor/notes - should return clinical consultation history', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/doctor/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
      expect(response.body[0].recommendations).toBeDefined();
    });
  });

  describe('6. Goals & Targets Module', () => {
    it('GET /v1/goals - should return active health targets', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/goals')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(4);
    });
  });

  describe('7. AI Wellness Advisor Module', () => {
    it('POST /v1/ai-advisor/chat - should return personalized context-grounded response', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/ai-advisor/chat')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          message: 'How is my sleep quality trending?',
        })
        .expect(201);

      expect(response.body).toHaveProperty('text');
      expect(response.body.text).toContain('Medical Notice');
      expect(response.body.isUser).toBe(false);
    });
  });

  describe('8. Nutrition & AI Scanner Module', () => {
    it('POST /v1/nutrition/scan - should return meal recognition breakdown with confidence', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/nutrition/scan')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          imageBase64: 'sample_base64_meal_image',
        })
        .expect(201);

      expect(response.body.foodName).toContain('Grilled Chicken Breast');
      expect(response.body.calories).toBe(380);
      expect(response.body.proteinGrams).toBe(42);
      expect(response.body.confidenceScore).toBe(0.94);
    });
  });

  describe('9. Global Health eSIM Module', () => {
    it('GET /v1/esim/status - should return cellular telemetry roaming details', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/esim/status')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.isActivated).toBe(true);
      expect(response.body.dataUsedGb).toBe(1.4);
      expect(response.body.dataTotalGb).toBe(5.0);
      expect(response.body.roamingTelemetryEnabled).toBe(true);
    });
  });
});
