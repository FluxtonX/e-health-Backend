import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('HealthService', () => {
  let service: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: {
            healthMetric: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              createMany: jest.fn(),
            },
            sleepSummary: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
            },
            dailyStepActivity: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
