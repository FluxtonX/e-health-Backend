import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EsimService {
  constructor(private prisma: PrismaService) {}

  async getStatus(userId: string) {
    const plan = await this.prisma.esimPlan.findUnique({
      where: { userId },
    });

    if (!plan) {
      return this.prisma.esimPlan.create({
        data: {
          userId,
          planName: 'United Union Global Health eSIM',
          isActivated: true,
          dataUsedGb: 1.4,
          dataTotalGb: 5.0,
          iccid: '89014103211118510720',
          status: 'Active',
        },
      });
    }

    return {
      ...plan,
      remainingGb: +(plan.dataTotalGb - plan.dataUsedGb).toFixed(2),
      usagePercent: +((plan.dataUsedGb / plan.dataTotalGb) * 100).toFixed(1),
      roamingTelemetryEnabled: true,
      coverageRegion: 'Global 140+ Countries',
    };
  }

  async activateEsim(userId: string) {
    const plan = await this.prisma.esimPlan.upsert({
      where: { userId },
      create: {
        userId,
        isActivated: true,
        status: 'Active',
        dataUsedGb: 0.0,
        dataTotalGb: 5.0,
        iccid: `890141${Math.floor(10000000000000 + Math.random() * 90000000000000)}`,
      },
      update: {
        isActivated: true,
        status: 'Active',
      },
    });

    return {
      success: true,
      message: 'eSIM telemetry profile downloaded and activated.',
      plan,
    };
  }
}
