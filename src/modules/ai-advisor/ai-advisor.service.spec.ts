import { Test, TestingModule } from '@nestjs/testing';
import { AiAdvisorService } from './ai-advisor.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MockFallbackProvider } from './providers/mock-fallback.provider';

describe('AiAdvisorService - 7-Day Trend Insights & Chat Auditing (Phase 6.3 & 6.5)', () => {
  let service: AiAdvisorService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
    },
    healthMetric: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    sleepSummary: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    dailyStepActivity: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    aiInteraction: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiAdvisorService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AiAdvisorService>(AiAdvisorService);
    service.onModuleInit();
  });

  it('should generate personalized high-priority sleep suggestion when 7-day average sleep < 7 hours', async () => {
    mockPrisma.sleepSummary.findMany.mockResolvedValue([
      {
        totalDurationMinutes: 360,
        sleepEfficiencyScore: 78,
        recordedAt: new Date(),
      },
      {
        totalDurationMinutes: 380,
        sleepEfficiencyScore: 80,
        recordedAt: new Date(),
      },
    ]);
    mockPrisma.healthMetric.findMany.mockResolvedValue([
      { value: 68, recordedAt: new Date() },
    ]);
    mockPrisma.dailyStepActivity.findMany.mockResolvedValue([
      { stepCount: 9000, date: new Date() },
    ]);

    const suggestions = await service.getSuggestions('user-123');

    expect(suggestions).toHaveLength(4);
    const sleepSuggestion = suggestions.find(
      (s) => s.category === 'Sleep Quality',
    );
    expect(sleepSuggestion).toBeDefined();
    expect(sleepSuggestion?.priority).toBe('HIGH');
    expect(sleepSuggestion?.title).toBe('Sleep Debt Restoration');
    expect(sleepSuggestion?.suggestion).toContain(
      'average sleep duration is 6h 10m',
    );
  });

  it('should generate elevated HR recommendation when 7-day average HR > 80 bpm', async () => {
    mockPrisma.sleepSummary.findMany.mockResolvedValue([
      {
        totalDurationMinutes: 480,
        sleepEfficiencyScore: 92,
        recordedAt: new Date(),
      },
    ]);
    mockPrisma.healthMetric.findMany.mockResolvedValue([
      { value: 86, recordedAt: new Date() },
      { value: 84, recordedAt: new Date() },
    ]);
    mockPrisma.dailyStepActivity.findMany.mockResolvedValue([
      { stepCount: 8500, date: new Date() },
    ]);

    const suggestions = await service.getSuggestions('user-123');

    const hrSuggestion = suggestions.find(
      (s) => s.category === 'Cardiovascular',
    );
    expect(hrSuggestion).toBeDefined();
    expect(hrSuggestion?.priority).toBe('HIGH');
    expect(hrSuggestion?.title).toBe('Parasympathetic Recovery');
    expect(hrSuggestion?.suggestion).toContain('85 bpm');
  });

  it('should generate step booster suggestion when 7-day average steps < 7500', async () => {
    mockPrisma.sleepSummary.findMany.mockResolvedValue([
      {
        totalDurationMinutes: 450,
        sleepEfficiencyScore: 90,
        recordedAt: new Date(),
      },
    ]);
    mockPrisma.healthMetric.findMany.mockResolvedValue([
      { value: 65, recordedAt: new Date() },
    ]);
    mockPrisma.dailyStepActivity.findMany.mockResolvedValue([
      { stepCount: 5200, date: new Date() },
      { stepCount: 5800, date: new Date() },
    ]);

    const suggestions = await service.getSuggestions('user-123');

    const stepsSuggestion = suggestions.find(
      (s) => s.category === 'Physical Activity',
    );
    expect(stepsSuggestion).toBeDefined();
    expect(stepsSuggestion?.priority).toBe('HIGH');
    expect(stepsSuggestion?.title).toBe('Daily Movement Momentum');
    expect(stepsSuggestion?.suggestion).toContain('5,500 steps/day');
  });

  it('should record AI interaction and audit log in database with compliance flags (Task 6.5)', async () => {
    service.setProvider(
      new MockFallbackProvider('TestGuardrails', 'test-model'),
    );

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-audit-1',
      firstName: 'Elena',
      consent: { aiAdvisorProcessing: true },
    });
    mockPrisma.healthMetric.findFirst.mockResolvedValue(null);
    mockPrisma.sleepSummary.findFirst.mockResolvedValue(null);
    mockPrisma.dailyStepActivity.findFirst.mockResolvedValue(null);

    const fakeRecord = {
      id: 'ai-interaction-999',
      userId: 'user-audit-1',
      prompt: 'I have severe chest pain',
      response: 'CRITICAL ALERT...',
      model: 'fallback-deterministic-v1',
      provider: 'ClinicalGuardrailsFallback',
      latencyMs: 15,
      hasEmergencyFlag: true,
      hasDiagnosticRefusal: false,
      createdAt: new Date(),
    };

    mockPrisma.aiInteraction.create.mockResolvedValue(fakeRecord);
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-log-1' });

    const result = await service.processChat('user-audit-1', {
      message: 'I am feeling severe crushing chest pain',
    });

    expect(result).toBeDefined();
    expect(result.id).toBe('ai-interaction-999');

    // Assert that interaction was saved to database
    expect(mockPrisma.aiInteraction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-audit-1',
        prompt: 'I am feeling severe crushing chest pain',
        hasEmergencyFlag: true,
        hasDiagnosticRefusal: false,
      }),
    });

    // Assert that general audit log was created
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'user-audit-1',
        action: 'AI_ADVISOR_INTERACTION',
        resource: 'ai_interactions',
      }),
    });
  });

  it('should query interaction logs for clinical audit review', async () => {
    const fakeInteractions = [
      {
        id: 'log-1',
        userId: 'user-1',
        prompt: 'What dose of Metformin?',
        hasEmergencyFlag: false,
        hasDiagnosticRefusal: true,
      },
    ];

    mockPrisma.aiInteraction.findMany.mockResolvedValue(fakeInteractions);

    const logs = await service.getAuditLogsForReview({
      hasDiagnosticRefusal: true,
    });

    expect(logs).toEqual(fakeInteractions);
    expect(mockPrisma.aiInteraction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { hasDiagnosticRefusal: true },
      }),
    );
  });
});
