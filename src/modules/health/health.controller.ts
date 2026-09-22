import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MetricType } from '@prisma/client';
import { HealthService } from './health.service';
import { CreateMetricDto } from './dto/create-metric.dto';
import { BatchMetricsDto } from './dto/batch-metrics.dto';
import { QueryMetricDto } from './dto/query-metric.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Health Metrics & Telemetry')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Get filtered or historical health telemetry points' })
  async getMetrics(
    @CurrentUser('id') userId: string,
    @Query() query: QueryMetricDto,
  ) {
    return this.healthService.getHistoricalMetrics(userId, query);
  }

  @Get('metrics/summary')
  @ApiOperation({ summary: 'Get core vitals summary for dashboard cards' })
  async getMetricsSummary(@CurrentUser('id') userId: string) {
    return this.healthService.getMetricsSummary(userId);
  }

  @Get('heart-rate/latest')
  @ApiOperation({ summary: 'Get latest heart rate observation' })
  async getLatestHeartRate(@CurrentUser('id') userId: string) {
    return this.healthService.getLatestMetric(userId, MetricType.HEART_RATE);
  }

  @Get('heart-rate')
  @ApiOperation({ summary: 'Get heart rate historical telemetry' })
  async getHeartRateHistory(
    @CurrentUser('id') userId: string,
    @Query() query: QueryMetricDto,
  ) {
    return this.healthService.getHistoricalMetrics(userId, {
      ...query,
      type: MetricType.HEART_RATE,
    });
  }

  @Get('spo2/latest')
  @ApiOperation({ summary: 'Get latest SpO2 oxygen saturation observation' })
  async getLatestSpO2(@CurrentUser('id') userId: string) {
    return this.healthService.getLatestMetric(userId, MetricType.SPO2);
  }

  @Get('spo2')
  @ApiOperation({ summary: 'Get SpO2 historical telemetry' })
  async getSpO2History(
    @CurrentUser('id') userId: string,
    @Query() query: QueryMetricDto,
  ) {
    return this.healthService.getHistoricalMetrics(userId, {
      ...query,
      type: MetricType.SPO2,
    });
  }

  @Get('sleep/latest')
  @ApiOperation({ summary: 'Get latest sleep analysis summary' })
  async getLatestSleep(@CurrentUser('id') userId: string) {
    return this.healthService.getLatestSleep(userId);
  }

  @Get('sleep')
  @ApiOperation({ summary: 'Get recent sleep session history' })
  async getSleepHistory(@CurrentUser('id') userId: string) {
    return this.healthService.getSleepHistory(userId);
  }

  @Get('activity/today')
  @ApiOperation({ summary: "Get today's active minutes, calories, and distance" })
  async getTodayActivity(@CurrentUser('id') userId: string) {
    return this.healthService.getTodayActivity(userId);
  }

  @Get('activity')
  @ApiOperation({ summary: 'Get recent daily activity logs' })
  async getActivityHistory(@CurrentUser('id') userId: string) {
    return this.healthService.getActivityHistory(userId);
  }

  @Get('steps/today')
  @ApiOperation({ summary: "Get today's step count and progress against goal" })
  async getTodaySteps(@CurrentUser('id') userId: string) {
    const activity = await this.healthService.getTodayActivity(userId);
    return {
      count: activity?.stepCount ?? 0,
      goal: activity?.stepGoal ?? 10000,
      progress: activity ? +(activity.stepCount / activity.stepGoal).toFixed(2) : 0,
    };
  }

  @Get('steps')
  @ApiOperation({ summary: 'Get step telemetry history' })
  async getStepsHistory(
    @CurrentUser('id') userId: string,
    @Query() query: QueryMetricDto,
  ) {
    return this.healthService.getHistoricalMetrics(userId, {
      ...query,
      type: MetricType.STEPS,
    });
  }

  @Post('metrics')
  @ApiOperation({ summary: 'Log a single health metric observation' })
  async recordMetric(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateMetricDto,
  ) {
    return this.healthService.recordMetric(userId, dto);
  }

  @Post('metrics/batch')
  @ApiOperation({ summary: 'Ingest a batch of wearable or sensor telemetry points' })
  async recordBatchMetrics(
    @CurrentUser('id') userId: string,
    @Body() dto: BatchMetricsDto,
  ) {
    return this.healthService.recordBatchMetrics(userId, dto);
  }
}
