import { Test, TestingModule } from '@nestjs/testing';
import { TerraService, TerraWebhookPayload } from './terra.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

describe('TerraService', () => {
  let service: TerraService;
  let prisma: any;
  let configService: any;

  const mockUser = {
    id: 'user-uuid-1234',
    email: 'elena@unitedunionhealth.com',
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(mockUser),
      },
      connectedDevice: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'dev-1' }),
        update: jest.fn().mockResolvedValue({ id: 'dev-1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      dailyStepActivity: {
        upsert: jest.fn().mockResolvedValue({ id: 'step-1' }),
      },
      sleepSummary: {
        create: jest.fn().mockResolvedValue({ id: 'sleep-1' }),
      },
      healthMetric: {
        create: jest.fn().mockResolvedValue({ id: 'metric-1' }),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'TERRA_WEBHOOK_SECRET') return 'test_secret_123';
        if (key === 'TERRA_API_KEY') return 'terra_key_xyz';
        if (key === 'TERRA_DEV_ID') return 'terra_dev_id_123';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TerraService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<TerraService>(TerraService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('verifyWebhookSignature', () => {
    it('should validate genuine HMAC SHA256 signature', () => {
      const payload = JSON.stringify({ type: 'daily', status: 'success' });
      const timestamp = '1727600000';
      const secret = 'test_secret_123';

      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}${payload}`)
        .digest('hex');

      const header = `t=${timestamp},v1=${expectedSignature}`;
      const isValid = service.verifyWebhookSignature(payload, header);

      expect(isValid).toBe(true);
    });

    it('should reject invalid or tampered signature', () => {
      const payload = JSON.stringify({ type: 'daily' });
      const header = 't=1727600000,v1=tampered_signature_hex';

      const isValid = service.verifyWebhookSignature(payload, header);
      expect(isValid).toBe(false);
    });

    it('should allow bypass if secret is dev_secret', () => {
      configService.get.mockReturnValue('dev_secret');
      const isValid = service.verifyWebhookSignature('{}', undefined);
      expect(isValid).toBe(true);
    });
  });

  describe('getSupportedProviders', () => {
    it('should list all Tier-1 supported providers', () => {
      const providers = service.getSupportedProviders();
      expect(providers.length).toBeGreaterThanOrEqual(5);

      const providerIds = providers.map((p) => p.id);
      expect(providerIds).toContain('OURA');
      expect(providerIds).toContain('WHOOP');
      expect(providerIds).toContain('GARMIN');
      expect(providerIds).toContain('FITBIT');
      expect(providerIds).toContain('WITHINGS');
    });
  });

  describe('processWebhook - Daily Telemetry Ingestion', () => {
    it('should ingest steps, calories, heart rate and SpO2 from Oura / Garmin', async () => {
      const payload: TerraWebhookPayload = {
        type: 'daily',
        user: {
          user_id: 'terra-user-1',
          reference_id: mockUser.id,
          provider: 'OURA',
        },
        data: [
          {
            metadata: { start_time: '2026-09-29T10:00:00Z' },
            distance_data: { steps: 9420, distance_meters: 6720 },
            calories_data: { net_activity_calories: 450 },
            heart_rate_data: {
              summary: {
                avg_hr_bpm: 68,
                resting_hr_bpm: 58,
                min_hr_bpm: 52,
                max_hr_bpm: 118,
              },
            },
            oxygen_data: { avg_saturation_percentage: 98.7 },
          },
        ],
      };

      const result = await service.processWebhook(payload);

      expect(result.success).toBe(true);
      expect(result.metricsIngested).toBeGreaterThanOrEqual(3);
      expect(prisma.dailyStepActivity.upsert).toHaveBeenCalled();
      expect(prisma.healthMetric.create).toHaveBeenCalled();
      expect(prisma.connectedDevice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockUser.id,
            model: 'OURA-TERRA-HUB',
          }),
        }),
      );
    });
  });

  describe('processWebhook - Sleep Architecture Ingestion', () => {
    it('should ingest sleep duration, stages, and efficiency', async () => {
      const payload: TerraWebhookPayload = {
        type: 'sleep',
        user: {
          user_id: 'terra-user-2',
          reference_id: mockUser.id,
          provider: 'WHOOP',
        },
        data: [
          {
            metadata: { start_time: '2026-09-29T06:00:00Z' },
            sleep_durations_data: {
              other: { total_sleep_duration_seconds: 28800 },
              asleep: {
                duration_deep_sleep_state_seconds: 7200,
                duration_rem_sleep_state_seconds: 6600,
                duration_light_sleep_state_seconds: 15000,
              },
              awake: { duration_awake_state_seconds: 1200 },
            },
            sleep_efficiency_percentage: 92.5,
          },
        ],
      };

      const result = await service.processWebhook(payload);

      expect(result.success).toBe(true);
      expect(prisma.sleepSummary.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockUser.id,
            totalDurationMinutes: 480,
            deepMinutes: 120,
            remMinutes: 110,
            sleepEfficiencyScore: 92.5,
          }),
        }),
      );
    });
  });

  describe('processWebhook - Deauthorization', () => {
    it('should mark connected device as disconnected on deauth event', async () => {
      const payload: TerraWebhookPayload = {
        type: 'deauth',
        user: {
          user_id: 'terra-user-3',
          reference_id: mockUser.id,
          provider: 'GARMIN',
        },
      };

      const result = await service.processWebhook(payload);

      expect(result.success).toBe(true);
      expect(prisma.connectedDevice.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUser.id, model: 'GARMIN-TERRA-HUB' },
          data: { status: 'DISCONNECTED' },
        }),
      );
    });
  });

  describe('generateWidgetSession', () => {
    it('should return onboarding session URL with reference_id', async () => {
      const session = await service.generateWidgetSession(mockUser.id, [
        'OURA',
        'WHOOP',
      ]);

      expect(session.sessionId).toBeDefined();
      expect(session.url).toContain(mockUser.id);
      expect(session.url).toContain('widget.tryterra.co');
    });
  });
});
