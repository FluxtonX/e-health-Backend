import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';

@Injectable()
export class GoalsService {
  constructor(private prisma: PrismaService) {}

  async getGoals(userId: string) {
    return this.prisma.healthGoal.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createGoal(userId: string, dto: CreateGoalDto) {
    return this.prisma.healthGoal.create({
      data: {
        userId,
        title: dto.title,
        target: dto.target,
        current: dto.current,
        progress: dto.progress ?? 0.0,
        iconName: dto.iconName,
        setBy: dto.setBy ?? 'Personal Goal',
      },
    });
  }

  async updateGoal(userId: string, goalId: string, dto: UpdateGoalDto) {
    const goal = await this.prisma.healthGoal.findFirst({
      where: { id: goalId, userId },
    });
    if (!goal) {
      throw new NotFoundException('Health goal not found');
    }

    return this.prisma.healthGoal.update({
      where: { id: goalId },
      data: {
        current: dto.current ?? goal.current,
        progress: dto.progress ?? goal.progress,
        target: dto.target ?? goal.target,
      },
    });
  }

  async deleteGoal(userId: string, goalId: string) {
    const goal = await this.prisma.healthGoal.findFirst({
      where: { id: goalId, userId },
    });
    if (!goal) {
      throw new NotFoundException('Health goal not found');
    }

    await this.prisma.healthGoal.update({
      where: { id: goalId },
      data: { isActive: false },
    });

    return { success: true, message: 'Goal marked inactive' };
  }
}
