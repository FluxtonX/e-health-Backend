import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NutritionService } from './nutrition.service';
import { UpdateNutritionTargetsDto } from './dto/update-nutrition-targets.dto';
import { LogMealDto, ScanFoodDto } from './dto/scan-food.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Nutrition & Food Scanner')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('nutrition')
export class NutritionController {
  constructor(private readonly nutritionService: NutritionService) {}

  @Get('targets')
  @ApiOperation({ summary: 'Get daily macro targets and consumed totals for today' })
  async getTargets(@CurrentUser('id') userId: string) {
    return this.nutritionService.getTargets(userId);
  }

  @Put('targets')
  @ApiOperation({ summary: 'Update personal daily macro and calorie targets' })
  async updateTargets(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateNutritionTargetsDto,
  ) {
    return this.nutritionService.updateTargets(userId, dto);
  }

  @Get('guidance')
  @ApiOperation({ summary: 'Get clinical nutrition and meal timing guidance' })
  async getGuidance(@CurrentUser('id') userId: string) {
    return this.nutritionService.getGuidance(userId);
  }

  @Post('scan')
  @ApiOperation({ summary: 'Analyze meal image via Vision AI and estimate nutrients' })
  async scanFood(
    @CurrentUser('id') userId: string,
    @Body() dto: ScanFoodDto,
  ) {
    return this.nutritionService.scanFood(userId, dto);
  }

  @Post('log')
  @ApiOperation({ summary: 'Log a recognized or custom meal to daily intake' })
  async logMeal(
    @CurrentUser('id') userId: string,
    @Body() dto: LogMealDto,
  ) {
    return this.nutritionService.logMeal(userId, dto);
  }
}
