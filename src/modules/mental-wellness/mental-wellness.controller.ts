import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { MentalWellnessService } from './mental-wellness.service';
import { CreateMoodLogDto } from './dto/create-mood-log.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Mental Wellness & Reflection')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('mental-wellness')
export class MentalWellnessController {
  constructor(private readonly mentalWellnessService: MentalWellnessService) {}

  @Get('moods')
  @ApiOperation({ summary: 'Get recent mood reflection logs' })
  async getMoodLogs(@CurrentUser('id') userId: string) {
    return this.mentalWellnessService.getMoodLogs(userId);
  }

  @Post('moods')
  @ApiOperation({ summary: 'Log a daily mood check-in and private reflection' })
  async createMoodLog(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateMoodLogDto,
  ) {
    return this.mentalWellnessService.createMoodLog(userId, dto);
  }

  @Get('sessions')
  @ApiOperation({
    summary: 'List guided mindfulness, breathwork, and NSDR sessions',
  })
  async getSessions() {
    return this.mentalWellnessService.getSessions();
  }
}
