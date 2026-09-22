import { ForbiddenException, Injectable } from '@nestjs/common';
import { MetricType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AiChatDto } from './dto/ai-chat.dto';

@Injectable()
export class AiAdvisorService {
  constructor(private prisma: PrismaService) {}

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
      ? `${Math.floor(latestSleep.totalDurationMinutes / 60)}h ${latestSleep.totalDurationMinutes % 60}m`
      : '7h 42m';
    const stepsCount = todayActivity ? todayActivity.stepCount : 8430;

    const lowerQuery = dto.message.toLowerCase();
    let replyText = '';

    if (lowerQuery.includes('sleep') || lowerQuery.includes('rest')) {
      replyText = `Based on your recent sleep telemetry, you recorded **${sleepDuration}** of restful sleep with an efficiency score of **${
        latestSleep?.sleepEfficiencyScore ?? 89
      }%**. Your deep sleep cycles were solid. Maintaining a consistent wind-down window 30 minutes before bed will help maintain this optimal baseline.`;
    } else if (lowerQuery.includes('heart') || lowerQuery.includes('bpm') || lowerQuery.includes('cardio')) {
      replyText = `Your latest resting heart rate is **${hrVal} bpm**, which is right within your optimal baseline range established with Dr. Sarah Jenkins. Your zone 2 aerobic sessions are showing a positive cardiovascular adaptation.`;
    } else if (lowerQuery.includes('step') || lowerQuery.includes('activity') || lowerQuery.includes('walk')) {
      replyText = `You have logged **${stepsCount} steps** today, reaching **${Math.round(
        (stepsCount / 10000) * 100,
      )}%** of your 10,000 daily goal. A brief 15-minute evening stroll will easily complete your target!`;
    } else {
      replyText = `Hello ${user?.firstName ?? 'there'}. I reviewed your recent biometric streams: Resting Heart Rate is steady at **${hrVal} bpm**, your latest sleep lasted **${sleepDuration}**, and you've achieved **${stepsCount} steps** today. Keep up the balanced aerobic routine!`;
    }

    const disclaimer =
      '\n\n*Medical Notice: I am an AI wellness companion, not a licensed physician. My insights support lifestyle coaching and do not constitute clinical diagnosis or prescriptive medical advice.*';

    return {
      id: `ai_msg_${Date.now()}`,
      text: replyText + disclaimer,
      isUser: false,
      timestamp: new Date().toISOString(),
    };
  }

  async getSuggestions(userId: string) {
    return [
      {
        id: 'sug_01',
        title: 'Optimal Wind-Down Window',
        category: 'Sleep Quality',
        suggestion:
          'Dim ambient blue light at 10:00 PM to support the circadian sleep efficiency score you achieved yesterday.',
        priority: 'MEDIUM',
      },
      {
        id: 'sug_02',
        title: 'Zone 2 Heart Rate Training',
        category: 'Cardiovascular',
        suggestion:
          'Maintain your brisk walking pace between 110-125 bpm for 40 minutes to align with Dr. Sarah Jenkins recommendations.',
        priority: 'HIGH',
      },
      {
        id: 'sug_03',
        title: 'Post-Workout Hydration',
        category: 'Recovery',
        suggestion:
          'Target 500ml water intake following your afternoon activity session to maintain optimal SpO2 stability.',
        priority: 'LOW',
      },
    ];
  }
}
