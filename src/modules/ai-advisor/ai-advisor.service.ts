import {
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { MetricType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AiChatDto } from './dto/ai-chat.dto';
import {
  AiChatMessage,
  AiModelProvider,
} from './interfaces/ai-model.interface';
import { MockFallbackProvider } from './providers/mock-fallback.provider';
import { OpenAiCompatibleProvider } from './providers/openai-compatible.provider';
import {
  EMERGENCY_KEYWORDS,
  FORBIDDEN_DIAGNOSTIC_KEYWORDS,
  FORBIDDEN_PRESCRIPTION_KEYWORDS,
  MANDATORY_MEDICAL_DISCLAIMER,
  WELLNESS_SYSTEM_PROMPT,
} from './prompts/wellness_guardrails';

@Injectable()
export class AiAdvisorService implements OnModuleInit {
  private readonly logger = new Logger(AiAdvisorService.name);
  private provider: AiModelProvider;
  private fallbackProvider: AiModelProvider;

  constructor(private prisma: PrismaService) {
    this.fallbackProvider = new MockFallbackProvider(
      'ClinicalGuardrailsFallback',
      'uuh-deterministic-v1',
    );
  }

  onModuleInit() {
    this.initProvider();
  }

  private initProvider() {
    const providerType = (process.env.AI_PROVIDER || 'fallback').toLowerCase();
    const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
    const baseURL = process.env.AI_API_BASE_URL;

    switch (providerType) {
      case 'medgemma':
        this.logger.log('Initializing MedGemma-4B provider...');
        this.provider = new OpenAiCompatibleProvider({
          name: 'MedGemma-4B',
          modelId: process.env.MEDGEMMA_MODEL_ID || 'medgemma:4b',
          baseURL:
            baseURL ||
            process.env.MEDGEMMA_BASE_URL ||
            'http://localhost:11434/v1',
          apiKey: apiKey || 'local-ollama',
        });
        break;

      case 'openbiollm':
        this.logger.log('Initializing OpenBioLLM-8B provider...');
        this.provider = new OpenAiCompatibleProvider({
          name: 'OpenBioLLM-8B',
          modelId:
            process.env.OPENBIOLLM_MODEL_ID || 'aaditya/OpenBioLLM-Llama3-8B',
          baseURL:
            baseURL ||
            process.env.OPENBIOLLM_BASE_URL ||
            'http://localhost:11434/v1',
          apiKey: apiKey || 'local-ollama',
        });
        break;

      case 'ollama':
        this.logger.log('Initializing local Ollama provider (100% Free)...');
        this.provider = new OpenAiCompatibleProvider({
          name: 'Ollama-Local',
          modelId: process.env.AI_MODEL_NAME || 'qwen2.5-coder:1.5b',
          baseURL: baseURL || 'http://localhost:11434/v1',
          apiKey: apiKey || 'ollama',
        });
        break;

      case 'groq':
        this.logger.log('Initializing Groq Cloud provider (100% Free Tier)...');
        this.provider = new OpenAiCompatibleProvider({
          name: 'Groq-Cloud',
          modelId: process.env.AI_MODEL_NAME || 'llama-3.1-8b-instant',
          baseURL: baseURL || 'https://api.groq.com/openai/v1',
          apiKey: process.env.GROQ_API_KEY || apiKey || 'missing-groq-key',
        });
        break;

      case 'fallback':
      default:
        this.logger.log(
          'Initializing Clinical Deterministic Fallback provider...',
        );
        this.provider = this.fallbackProvider;
        break;
    }
  }

  // Allow switching provider at runtime (e.g. during benchmarking or testing)
  setProvider(provider: AiModelProvider) {
    this.provider = provider;
  }

  getProvider(): AiModelProvider {
    return this.provider;
  }

  async processChat(userId: string, dto: AiChatDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        consent: true,
      },
    });

    if (user?.consent && !user.consent.aiAdvisorProcessing) {
      throw new ForbiddenException(
        'AI Wellness Advisor processing is disabled in your Consent & Privacy settings.',
      );
    }

    // Retrieve user's latest biometric context
    const [latestHr, latestSleep, todayActivity] = await Promise.all([
      this.prisma.healthMetric.findFirst({
        where: { userId, type: MetricType.HEART_RATE },
        orderBy: { recordedAt: 'desc' },
      }),
      this.prisma.sleepSummary.findFirst({
        where: { userId },
        orderBy: { recordedAt: 'desc' },
      }),
      this.prisma.dailyStepActivity.findFirst({
        where: { userId },
        orderBy: { date: 'desc' },
      }),
    ]);

    const hrVal = latestHr ? Math.round(latestHr.value) : 72;
    const sleepDuration = latestSleep
      ? `${Math.floor(latestSleep.totalDurationMinutes / 60)}h ${
          latestSleep.totalDurationMinutes % 60
        }m`
      : '7h 42m';
    const sleepEfficiency = latestSleep?.sleepEfficiencyScore ?? 89;
    const stepsCount = todayActivity ? todayActivity.stepCount : 8430;

    const biometricContext = `\n\nUSER TELEMETRY CONTEXT:
- Name: ${user?.firstName ?? 'Member'}
- Resting Heart Rate: ${hrVal} bpm
- Sleep: ${sleepDuration} (Efficiency Score: ${sleepEfficiency}%)
- Steps Logged Today: ${stepsCount}`;

    const messages: AiChatMessage[] = [
      {
        role: 'system',
        content: `${WELLNESS_SYSTEM_PROMPT}${biometricContext}`,
      },
      {
        role: 'user',
        content: dto.message,
      },
    ];

    let replyText = '';
    let usedModel = this.provider?.modelId || 'fallback';
    let usedProvider = this.provider?.name || 'Fallback';
    let latencyMs = 0;

    try {
      const response = await this.provider.generateResponse(messages);
      replyText = response.text;
      usedModel = response.model;
      usedProvider = response.provider;
      latencyMs = response.latencyMs;
    } catch (err: any) {
      this.logger.warn(
        `Primary provider failed (${err.message}), falling back to deterministic safe provider.`,
      );
      const fallbackRes =
        await this.fallbackProvider.generateResponse(messages);
      replyText = fallbackRes.text;
      usedModel = fallbackRes.model;
      usedProvider = fallbackRes.provider;
      latencyMs = fallbackRes.latencyMs;
    }

    // Ensure medical disclaimer is always affixed if not already present
    if (!replyText.includes('Medical Notice:')) {
      replyText += MANDATORY_MEDICAL_DISCLAIMER;
    }

    // Safety and compliance flag detection
    const lowerMessage = dto.message.toLowerCase();
    const hasEmergencyFlag = EMERGENCY_KEYWORDS.some((kw) =>
      lowerMessage.includes(kw),
    );
    const hasDiagnosticRefusal =
      FORBIDDEN_DIAGNOSTIC_KEYWORDS.some((kw) => lowerMessage.includes(kw)) ||
      FORBIDDEN_PRESCRIPTION_KEYWORDS.some((kw) => lowerMessage.includes(kw));

    // Audit and record AI interaction in database for compliance monitoring
    const savedInteraction = await this.prisma.aiInteraction.create({
      data: {
        userId,
        prompt: dto.message,
        response: replyText,
        model: usedModel,
        provider: usedProvider,
        latencyMs,
        hasEmergencyFlag,
        hasDiagnosticRefusal,
      },
    });

    // Also write to audit_logs table for central clinical governance
    this.prisma.auditLog
      .create({
        data: {
          actorId: userId,
          action: 'AI_ADVISOR_INTERACTION',
          resource: 'ai_interactions',
          details: {
            interactionId: savedInteraction.id,
            model: usedModel,
            provider: usedProvider,
            latencyMs,
            hasEmergencyFlag,
            hasDiagnosticRefusal,
          },
        },
      })
      .catch((err) => {
        this.logger.warn(`Failed to write to audit_logs: ${err.message}`);
      });

    return {
      id: savedInteraction.id,
      text: replyText,
      isUser: false,
      timestamp: savedInteraction.createdAt.toISOString(),
      metadata: {
        model: usedModel,
        provider: usedProvider,
        latencyMs,
      },
    };
  }

  async getInteractionHistory(userId: string, limit = 50) {
    return this.prisma.aiInteraction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getAuditLogsForReview(query?: {
    hasEmergency?: boolean;
    hasDiagnosticRefusal?: boolean;
    limit?: number;
  }) {
    const where: any = {};
    if (query?.hasEmergency !== undefined) {
      where.hasEmergencyFlag = query.hasEmergency;
    }
    if (query?.hasDiagnosticRefusal !== undefined) {
      where.hasDiagnosticRefusal = query.hasDiagnosticRefusal;
    }

    return this.prisma.aiInteraction.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: query?.limit || 50,
    });
  }

  async getSuggestions(userId: string) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Retrieve past 7 days of sleep, heart rate, and step activity
    const [sleepHistory, hrHistory, stepHistory] = await Promise.all([
      this.prisma.sleepSummary.findMany({
        where: {
          userId,
          recordedAt: { gte: sevenDaysAgo },
        },
        orderBy: { recordedAt: 'desc' },
      }),
      this.prisma.healthMetric.findMany({
        where: {
          userId,
          type: MetricType.HEART_RATE,
          recordedAt: { gte: sevenDaysAgo },
        },
        orderBy: { recordedAt: 'desc' },
      }),
      this.prisma.dailyStepActivity.findMany({
        where: {
          userId,
          date: { gte: sevenDaysAgo },
        },
        orderBy: { date: 'desc' },
      }),
    ]);

    // 1. Calculate Sleep 7-Day Averages
    const avgSleepMinutes =
      sleepHistory.length > 0
        ? Math.round(
            sleepHistory.reduce((acc, s) => acc + s.totalDurationMinutes, 0) /
              sleepHistory.length,
          )
        : 435; // Default ~7h 15m

    const avgSleepEfficiency =
      sleepHistory.length > 0
        ? Math.round(
            sleepHistory.reduce((acc, s) => acc + s.sleepEfficiencyScore, 0) /
              sleepHistory.length,
          )
        : 88;

    const sleepHours = Math.floor(avgSleepMinutes / 60);
    const sleepMins = avgSleepMinutes % 60;

    // 2. Calculate Heart Rate 7-Day Average
    const avgHeartRate =
      hrHistory.length > 0
        ? Math.round(
            hrHistory.reduce((acc, h) => acc + h.value, 0) / hrHistory.length,
          )
        : 72;

    // 3. Calculate Steps 7-Day Average
    const avgSteps =
      stepHistory.length > 0
        ? Math.round(
            stepHistory.reduce((acc, s) => acc + s.stepCount, 0) /
              stepHistory.length,
          )
        : 8200;

    const suggestions = [];

    // Rule A: Sleep Hygiene Suggestion
    if (avgSleepMinutes < 420) {
      // Under 7 hours
      suggestions.push({
        id: 'sug_sleep_debt',
        title: 'Sleep Debt Restoration',
        category: 'Sleep Quality',
        suggestion: `Your 7-day average sleep duration is ${sleepHours}h ${sleepMins}m with ${avgSleepEfficiency}% efficiency. Implementing a 30-minute blue-light curfew at 10:00 PM can help recover your cumulative sleep deficit.`,
        priority: 'HIGH',
      });
    } else {
      suggestions.push({
        id: 'sug_sleep_opt',
        title: 'Circadian Regularity',
        category: 'Sleep Quality',
        suggestion: `Great baseline: your 7-day average is ${sleepHours}h ${sleepMins}m with ${avgSleepEfficiency}% sleep efficiency. Maintaining your current bedtime consistency will preserve optimal deep sleep cycles.`,
        priority: 'LOW',
      });
    }

    // Rule B: Cardiovascular / Zone 2 Suggestion
    if (avgHeartRate > 80) {
      suggestions.push({
        id: 'sug_hr_elevated',
        title: 'Parasympathetic Recovery',
        category: 'Cardiovascular',
        suggestion: `Your 7-day resting heart rate averaged ${avgHeartRate} bpm. Prioritize hydration and incorporate 10 minutes of diaphragmatic breathing post-exercise to reduce sympathetic cardiac load.`,
        priority: 'HIGH',
      });
    } else {
      suggestions.push({
        id: 'sug_hr_zone2',
        title: 'Zone 2 Base Building',
        category: 'Cardiovascular',
        suggestion: `Resting heart rate is steady at ${avgHeartRate} bpm (7-day baseline). Target 35-40 minutes of zone 2 brisk walking (110-125 bpm) to align with Dr. Sarah Jenkins' care guidelines.`,
        priority: 'MEDIUM',
      });
    }

    // Rule C: Daily Steps / Activity Suggestion
    if (avgSteps < 7500) {
      suggestions.push({
        id: 'sug_steps_boost',
        title: 'Daily Movement Momentum',
        category: 'Physical Activity',
        suggestion: `Averaging ${avgSteps.toLocaleString()} steps/day over the past week. Adding a 15-minute post-lunch walk can comfortably bridge the gap toward your 10,000 daily goal.`,
        priority: 'HIGH',
      });
    } else {
      suggestions.push({
        id: 'sug_steps_prog',
        title: 'Aerobic Stamina Progression',
        category: 'Physical Activity',
        suggestion: `Strong activity discipline: you averaged ${avgSteps.toLocaleString()} steps/day over the last 7 days. Include brief mobility stretches after sustained walking bouts.`,
        priority: 'LOW',
      });
    }

    // Rule D: Recovery & Hydration
    suggestions.push({
      id: 'sug_recovery_hyd',
      title: 'Cellular Hydration & SpO2',
      category: 'Recovery',
      suggestion:
        'Target 500ml of mineral-rich water intake following afternoon movement sessions to sustain optimal SpO2 stability and cellular recovery.',
      priority: 'LOW',
    });

    return suggestions;
  }
}
