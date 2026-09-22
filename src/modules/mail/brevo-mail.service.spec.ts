import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BrevoMailService } from './brevo-mail.service';

describe('BrevoMailService', () => {
  let service: BrevoMailService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrevoMailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'BREVO_API_KEY') return '';
              if (key === 'BREVO_SENDER_EMAIL') return 'no-reply@unitedunionhealth.com';
              if (key === 'BREVO_SENDER_NAME') return 'United Union Health';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<BrevoMailService>(BrevoMailService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should handle verification email gracefully with dev fallback', async () => {
    const result = await service.sendVerificationEmail('test@example.com', 'Test User', '123456');
    expect(result).toBe(true);
  });

  it('should handle password reset email gracefully with dev fallback', async () => {
    const result = await service.sendPasswordResetEmail('test@example.com', 'Test User', '654321');
    expect(result).toBe(true);
  });
});
