import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { GoalsService } from './goals.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Health Targets & Goals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Get()
  @ApiOperation({ summary: 'Get active personal and clinical health goals' })
  async getGoals(@CurrentUser('id') userId: string) {
    return this.goalsService.getGoals(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new health goal target' })
  async createGoal(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateGoalDto,
  ) {
    return this.goalsService.createGoal(userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update progress on an active health goal' })
  async updateGoal(
    @CurrentUser('id') userId: string,
    @Param('id') goalId: string,
    @Body() dto: UpdateGoalDto,
  ) {
    return this.goalsService.updateGoal(userId, goalId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove/Archive a health goal' })
  async deleteGoal(
    @CurrentUser('id') userId: string,
    @Param('id') goalId: string,
  ) {
    return this.goalsService.deleteGoal(userId, goalId);
  }
}
