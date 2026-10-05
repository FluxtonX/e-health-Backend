import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { MetricType } from '@prisma/client';
import { HealthService } from './health.service';
import { DoctorService } from '../doctor/doctor.service';
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
  constructor(
    private readonly healthService: HealthService,
    private readonly doctorService: DoctorService,
  ) {}

  @Get('metrics')
  @ApiOperation({
    summary: 'Get filtered or historical health telemetry points',
  })
  async getMetrics(
    @CurrentUser() user: any,
    @Query() query: QueryMetricDto,
    @Query('patientId') patientId?: string,
  ) {
    const targetId = await this.resolveTargetId(user, patientId, 'health_metrics');
    return this.healthService.getHistoricalMetrics(targetId, query);
  }

  @Get('metrics/summary')
  @ApiOperation({ summary: 'Get core vitals summary for dashboard cards' })
  async getMetricsSummary(
    @CurrentUser() user: any,
    @Query('patientId') patientId?: string,
  ) {
    const targetId = await this.resolveTargetId(user, patientId, 'health_summary');
    return this.healthService.getMetricsSummary(targetId);
  }

  @Get('heart-rate/latest')
  @ApiOperation({ summary: 'Get latest heart rate observation' })
  async getLatestHeartRate(
    @CurrentUser() user: any,
    @Query('patientId') patientId?: string,
  ) {
    const targetId = await this.resolveTargetId(user, patientId, 'heart_rate');
    return this.healthService.getLatestMetric(targetId, MetricType.HEART_RATE);
  }

  @Get('heart-rate')
  @ApiOperation({ summary: 'Get heart rate historical telemetry' })
  async getHeartRateHistory(
    @CurrentUser() user: any,
    @Query() query: QueryMetricDto,
    @Query('patientId') patientId?: string,
  ) {
    const targetId = await this.resolveTargetId(user, patientId, 'heart_rate');
    return this.healthService.getHistoricalMetrics(targetId, {
      ...query,
      type: MetricType.HEART_RATE,
    });
  }

  @Get('spo2/latest')
  @ApiOperation({ summary: 'Get latest SpO2 oxygen saturation observation' })
  async getLatestSpO2(
    @CurrentUser() user: any,
    @Query('patientId') patientId?: string,
  ) {
    const targetId = await this.resolveTargetId(user, patientId, 'spo2');
    return this.healthService.getLatestMetric(targetId, MetricType.SPO2);
  }

  @Get('spo2')
  @ApiOperation({ summary: 'Get SpO2 historical telemetry' })
  async getSpO2History(
    @CurrentUser() user: any,
    @Query() query: QueryMetricDto,
    @Query('patientId') patientId?: string,
  ) {
    const targetId = await this.resolveTargetId(user, patientId, 'spo2');
    return this.healthService.getHistoricalMetrics(targetId, {
      ...query,
      type: MetricType.SPO2,
    });
  }

  @Get('sleep/latest')
  @ApiOperation({ summary: 'Get latest sleep analysis summary' })
  async getLatestSleep(
    @CurrentUser() user: any,
    @Query('patientId') patientId?: string,
  ) {
    const targetId = await this.resolveTargetId(user, patientId, 'sleep_summary');
    return this.healthService.getLatestSleep(targetId);
  }

  @Get('sleep/summary')
  @ApiOperation({ summary: 'Get recent sleep session history' })
  async getSleepHistory(
    @CurrentUser() user: any,
    @Query('patientId') patientId?: string,
  ) {
    const targetId = await this.resolveTargetId(user, patientId, 'sleep_history');
    return this.healthService.getSleepHistory(targetId);
  }

  @Get('activity/today')
  @ApiOperation({
    summary: "Get today's active minutes, calories, and distance",
  })
  async getTodayActivity(
    @CurrentUser() user: any,
    @Query('patientId') patientId?: string,
  ) {
    const targetId = await this.resolveTargetId(user, patientId, 'activity');
    return this.healthService.getTodayActivity(targetId);
  }

  @Get('steps/daily')
  @ApiOperation({ summary: 'Get recent daily activity logs' })
  async getActivityHistory(
    @CurrentUser() user: any,
    @Query('patientId') patientId?: string,
  ) {
    const targetId = await this.resolveTargetId(user, patientId, 'steps');
    return this.healthService.getActivityHistory(targetId);
  }

  @Get('steps/today')
  @ApiOperation({ summary: "Get today's step count and progress against goal" })
  async getTodaySteps(
    @CurrentUser() user: any,
    @Query('patientId') patientId?: string,
  ) {
    const targetId = await this.resolveTargetId(user, patientId, 'steps_history');
    const activity = await this.healthService.getTodayActivity(targetId);
    return {
      count: activity?.stepCount ?? 0,
      goal: activity?.stepGoal ?? 10000,
      progress: activity
        ? +(activity.stepCount / activity.stepGoal).toFixed(2)
        : 0,
    };
  }

  @Get('steps')
  @ApiOperation({ summary: 'Get step telemetry history' })
  async getStepsHistory(
    @CurrentUser() user: any,
    @Query() query: QueryMetricDto,
    @Query('patientId') patientId?: string,
  ) {
    const targetId = user.role === 'DOCTOR' && patientId ? patientId : user.id;
    return this.healthService.getHistoricalMetrics(targetId, {
      ...query,
      type: MetricType.STEPS,
    });
  }

  @Post('metric')
  @ApiOperation({ summary: 'Log a single health metric observation' })
  async recordMetric(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateMetricDto,
  ) {
    return this.healthService.recordMetric(userId, dto);
  }

  @Post('metrics/bulk')
  @ApiOperation({
    summary: 'Ingest a batch of wearable or sensor telemetry points (bulk)',
  })
  async recordBatchMetricsBulk(
    @CurrentUser('id') userId: string,
    @Body() dto: BatchMetricsDto,
  ) {
    return this.healthService.recordBatchMetrics(userId, dto);
  }

  @Post('metrics/batch')
  @ApiOperation({
    summary: 'Ingest a batch of wearable or sensor telemetry points (batch)',
  })
  async recordBatchMetrics(
    @CurrentUser('id') userId: string,
    @Body() dto: BatchMetricsDto,
  ) {
    return this.healthService.recordBatchMetrics(userId, dto);
  }

  private async resolveTargetId(
    user: { id: string; role: string },
    patientId: string | undefined,
    resource: string,
  ): Promise<string> {
    if (user.role !== 'DOCTOR' || !patientId) return user.id;
    await this.doctorService.assertDoctorCanAccessPatient(
      user.id,
      patientId,
      'VIEW',
      resource,
    );
    return patientId;
  }
}
