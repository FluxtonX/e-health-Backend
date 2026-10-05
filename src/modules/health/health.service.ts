import { Injectable } from '@nestjs/common';
import {
  HealthDataSource,
  MetricType,
  Prisma,
  SyncStatus,
} from '@prisma/client';
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

    const [latestHr, latestSpo2, latestSleep, todayActivity] =
      await Promise.all([
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
            totalDurationHours: +(
              latestSleep.totalDurationMinutes / 60
            ).toFixed(1),
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
            progress: +(
              todayActivity.stepCount / todayActivity.stepGoal
            ).toFixed(2),
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

    if (query.days) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - Number(query.days));
      where.recordedAt = { gte: startDate };
    } else if (query.startDate || query.endDate) {
      where.recordedAt = {};
      if (query.startDate) where.recordedAt.gte = new Date(query.startDate);
      if (query.endDate) where.recordedAt.lte = new Date(query.endDate);
    }

    const data = await this.prisma.healthMetric.findMany({
      where,
      orderBy: { recordedAt: 'asc' },
      take: 1000,
    });

    if (query.type === MetricType.HEART_RATE && data.length > 0) {
      const values = data.map((d) => d.value);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);
      const sortedValues = [...values].sort((a, b) => a - b);
      const resting =
        sortedValues[Math.floor(sortedValues.length * 0.1)] || min;
      const active = sortedValues[Math.floor(sortedValues.length * 0.9)] || max;

      return {
        aggregates: {
          average: Math.round(avg),
          min: Math.round(min),
          max: Math.round(max),
          resting: Math.round(resting),
          active: Math.round(active),
        },
        data,
      };
    }

    if (query.type === MetricType.SPO2 && data.length > 0) {
      const values = data.map((d) => d.value);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);
      return {
        aggregates: {
          average: Math.round(avg * 10) / 10,
          min: Math.round(min * 10) / 10,
          max: Math.round(max * 10) / 10,
        },
        data,
      };
    }

    return { data };
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

    let activity = await this.prisma.dailyStepActivity.findFirst({
      where: {
        userId,
        date: { gte: todayStart },
      },
      orderBy: { date: 'desc' },
    });

    if (!activity) {
      // Check if latest STEPS was recorded today in healthMetric table
      const latestStep = await this.prisma.healthMetric.findFirst({
        where: {
          userId,
          type: MetricType.STEPS,
          recordedAt: { gte: todayStart },
        },
        orderBy: { recordedAt: 'desc' },
      });

      if (latestStep && latestStep.value !== undefined) {
        activity = await this.prisma.dailyStepActivity.upsert({
          where: {
            userId_date: {
              userId,
              date: todayStart,
            },
          },
          create: {
            userId,
            date: todayStart,
            stepCount: Math.round(latestStep.value),
            stepGoal: 10000,
            distanceKm: Number(((latestStep.value * 0.762) / 1000).toFixed(2)),
            activeCaloriesBurned: Math.round(latestStep.value * 0.04),
            activeMinutes: Math.round(latestStep.value / 100),
          },
          update: {
            stepCount: Math.round(latestStep.value),
          },
        });
      }
    }

    return activity;
  }

  async getActivityHistory(userId: string, limit = 7) {
    return this.prisma.dailyStepActivity.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: limit,
    });
  }

  async recordMetric(userId: string, dto: CreateMetricDto) {
    const metric = await this.prisma.healthMetric.create({
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

    if (dto.type === MetricType.STEPS && dto.value !== undefined) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await this.prisma.dailyStepActivity.upsert({
        where: {
          userId_date: {
            userId,
            date: today,
          },
        },
        create: {
          userId,
          date: today,
          stepCount: Math.round(dto.value),
          stepGoal: 10000,
          distanceKm: Number(((dto.value * 0.762) / 1000).toFixed(2)),
          activeCaloriesBurned: Math.round(dto.value * 0.04),
          activeMinutes: Math.round(dto.value / 100),
        },
        update: {
          stepCount: Math.round(dto.value),
          distanceKm: Number(((dto.value * 0.762) / 1000).toFixed(2)),
          activeCaloriesBurned: Math.round(dto.value * 0.04),
          activeMinutes: Math.round(dto.value / 100),
        },
      });
    }

    return metric;
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

    // Automatically synchronize dailyStepActivity if STEPS is included in batch
    const stepMetric = dto.metrics.find((m) => m.type === MetricType.STEPS);
    if (stepMetric && stepMetric.value !== undefined) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await this.prisma.dailyStepActivity.upsert({
        where: {
          userId_date: {
            userId,
            date: today,
          },
        },
        create: {
          userId,
          date: today,
          stepCount: Math.round(stepMetric.value),
          stepGoal: 10000,
          distanceKm: Number(((stepMetric.value * 0.762) / 1000).toFixed(2)),
          activeCaloriesBurned: Math.round(stepMetric.value * 0.04),
          activeMinutes: Math.round(stepMetric.value / 100),
        },
        update: {
          stepCount: Math.round(stepMetric.value),
          distanceKm: Number(((stepMetric.value * 0.762) / 1000).toFixed(2)),
          activeCaloriesBurned: Math.round(stepMetric.value * 0.04),
          activeMinutes: Math.round(stepMetric.value / 100),
        },
      });
    }

    return {
      success: true,
      recordsIngested: count.count,
      ingestedAt: new Date().toISOString(),
    };
  }
}
