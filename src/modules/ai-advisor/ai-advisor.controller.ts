import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AiAdvisorService } from './ai-advisor.service';
import { AiChatDto } from './dto/ai-chat.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('AI Wellness Advisor')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai-advisor')
export class AiAdvisorController {
  constructor(private readonly aiAdvisorService: AiAdvisorService) {}

  @Post('chat')
  @ApiOperation({ summary: 'Send a prompt to the AI wellness companion' })
  async chat(
    @CurrentUser('id') userId: string,
    @Body() dto: AiChatDto,
  ) {
    return this.aiAdvisorService.processChat(userId, dto);
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'Get automated lifestyle recommendations based on telemetry' })
  async getSuggestions(@CurrentUser('id') userId: string) {
    return this.aiAdvisorService.getSuggestions(userId);
  }
}
