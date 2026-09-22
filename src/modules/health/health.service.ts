import { Injectable } from '@nestjs/common';
import { HealthDataSource, MetricType, Prisma, SyncStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMetricDto } from './dto/create-metric.dto';
import { BatchMetricsDto } from './dto/batch-metrics.dto';
import { QueryMetricDto } from './dto/query-metric.dto';

@Injectable()
export class HealthService {
  constructor(private prisma: PrismaService) {}

  async getLatestMetric(userId: string, type: MetricType) {
    return this.prisma.healthMetric.findFirst({
      where: { userId, type },
      orderBy: { recordedAt: 'desc' },
    });
  }

  async getMetricsSummary(userId: string) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [latestHr, latestSpo2, latestSleep, todayActivity] = await Promise.all([
      this.getLatestMetric(userId, MetricType.HEART_RATE),
      this.getLatestMetric(userId, MetricType.SPO2),
      this.prisma.sleepSummary.findFirst({
        where: { userId },
        orderBy: { recordedAt: 'desc' },
      }),
      this.prisma.dailyStepActivity.findFirst({
        where: {
          userId,
          date: { gte: todayStart },
        },
        orderBy: { date: 'desc' },
      }),
    ]);

    return {
      heartRate: latestHr
        ? {
            id: latestHr.id,
            bpm: Math.round(latestHr.value),
            restingBpm: (latestHr.metadata as any)?.restingBpm ?? 64,
            minBpm: (latestHr.metadata as any)?.minBpm ?? 58,
            maxBpm: (latestHr.metadata as any)?.maxBpm ?? 124,
            source: latestHr.source,
            timestamp: latestHr.recordedAt,
          }
        : null,
      spo2: latestSpo2
        ? {
            id: latestSpo2.id,
            percentage: latestSpo2.value,
            source: latestSpo2.source,
            timestamp: latestSpo2.recordedAt,
          }
        : null,
      sleep: latestSleep
        ? {
            id: latestSleep.id,
            totalDurationHours: +(latestSleep.totalDurationMinutes / 60).toFixed(1),
            totalDurationMinutes: latestSleep.totalDurationMinutes,
            deepMinutes: latestSleep.deepMinutes,
            remMinutes: latestSleep.remMinutes,
            lightMinutes: latestSleep.lightMinutes,
            awakeMinutes: latestSleep.awakeMinutes,
            efficiencyScore: latestSleep.sleepEfficiencyScore,
            source: latestSleep.source,
            timestamp: latestSleep.recordedAt,
          }
        : null,
      steps: todayActivity
        ? {
            id: todayActivity.id,
            count: todayActivity.stepCount,
            goal: todayActivity.stepGoal,
            progress: +(todayActivity.stepCount / todayActivity.stepGoal).toFixed(2),
            date: todayActivity.date,
          }
        : null,
      activity: todayActivity
        ? {
            id: todayActivity.id,
            activeMinutes: todayActivity.activeMinutes,
            activeCaloriesBurned: todayActivity.activeCaloriesBurned,
            distanceKm: todayActivity.distanceKm,
            date: todayActivity.date,
          }
        : null,
    };
  }

  async getHistoricalMetrics(userId: string, query: QueryMetricDto) {
    const where: Prisma.HealthMetricWhereInput = { userId };

    if (query.type) {
      where.type = query.type;
    }

    if (query.startDate || query.endDate) {
      where.recordedAt = {};
      if (query.startDate) where.recordedAt.gte = new Date(query.startDate);
      if (query.endDate) where.recordedAt.lte = new Date(query.endDate);
    }

    return this.prisma.healthMetric.findMany({
      where,
      orderBy: { recordedAt: 'asc' },
      take: 100,
    });
  }

  async getLatestSleep(userId: string) {
    return this.prisma.sleepSummary.findFirst({
      where: { userId },
      orderBy: { recordedAt: 'desc' },
    });
  }

  async getSleepHistory(userId: string, limit = 7) {
    return this.prisma.sleepSummary.findMany({
      where: { userId },
      orderBy: { recordedAt: 'desc' },
      take: limit,
    });
  }

  async getTodayActivity(userId: string) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    return this.prisma.dailyStepActivity.findFirst({
      where: {
        userId,
        date: { gte: todayStart },
      },
      orderBy: { date: 'desc' },
    });
  }

  async getActivityHistory(userId: string, limit = 7) {
    return this.prisma.dailyStepActivity.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: limit,
    });
  }

  async recordMetric(userId: string, dto: CreateMetricDto) {
    return this.prisma.healthMetric.create({
      data: {
        userId,
        type: dto.type,
        value: dto.value,
        unit: dto.unit,
        source: dto.source ?? HealthDataSource.WRISTBAND,
        syncStatus: dto.syncStatus ?? SyncStatus.SYNCED,
        metadata: dto.metadata,
        recordedAt: dto.timestamp ? new Date(dto.timestamp) : new Date(),
      },
    });
  }

  async recordBatchMetrics(userId: string, dto: BatchMetricsDto) {
    const count = await this.prisma.healthMetric.createMany({
      data: dto.metrics.map((m) => ({
        userId,
        type: m.type,
        value: m.value,
        unit: m.unit,
        source: m.source ?? HealthDataSource.WRISTBAND,
        syncStatus: m.syncStatus ?? SyncStatus.SYNCED,
        metadata: m.metadata,
        recordedAt: m.timestamp ? new Date(m.timestamp) : new Date(),
      })),
    });

    return {
      success: true,
      recordsIngested: count.count,
      ingestedAt: new Date().toISOString(),
    };
  }
}
