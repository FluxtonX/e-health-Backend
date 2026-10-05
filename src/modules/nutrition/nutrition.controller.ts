import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { NutritionService } from './nutrition.service';
import { UpdateNutritionTargetsDto } from './dto/update-nutrition-targets.dto';
import { LogMealDto, ScanFoodDto } from './dto/scan-food.dto';
import { DailySummaryQueryDto, LogWaterDto } from './dto/daily-summary.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Nutrition & Food Scanner')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('nutrition')
export class NutritionController {
  constructor(private readonly nutritionService: NutritionService) {}

  @Get('daily-summary')
  @ApiOperation({
    summary:
      'Get exact daily macronutrient, calorie, and water totals against targets',
  })
  async getDailySummary(
    @CurrentUser('id') userId: string,
    @Query() query: DailySummaryQueryDto,
  ) {
    return this.nutritionService.getDailySummary(userId, query.date);
  }

  @Get('targets')
  @ApiOperation({
    summary: 'Get daily macro targets and consumed totals for today',
  })
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
  async getGuidance() {
    return this.nutritionService.getGuidance();
  }

  @Post('scan')
  @ApiOperation({
    summary: 'Analyze meal image via Vision AI and estimate nutrients',
  })
  async scanFood(@CurrentUser('id') userId: string, @Body() dto: ScanFoodDto) {
    return this.nutritionService.scanFood(userId, dto);
  }

  @Post('log')
  @ApiOperation({ summary: 'Log a recognized or custom meal to daily intake' })
  async logMeal(@CurrentUser('id') userId: string, @Body() dto: LogMealDto) {
    return this.nutritionService.logMeal(userId, dto);
  }

  @Post('water')
  @ApiOperation({ summary: 'Log water intake volume in milliliters' })
  async logWater(@CurrentUser('id') userId: string, @Body() dto: LogWaterDto) {
    return this.nutritionService.logWater(userId, dto);
  }

  @Delete('meals/:id')
  @ApiOperation({ summary: 'Delete a food log entry by id' })
  async deleteMeal(
    @CurrentUser('id') userId: string,
    @Param('id') logId: string,
  ) {
    return this.nutritionService.deleteMeal(userId, logId);
  }
}
