import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateNutritionTargetsDto } from './dto/update-nutrition-targets.dto';
import { LogMealDto, ScanFoodDto } from './dto/scan-food.dto';
import { LogWaterDto } from './dto/daily-summary.dto';
import { UsdaFoodDataService } from './services/usda-food-data.service';
import { FoodRecognitionService } from './services/food-recognition.service';
import { OpenFoodFactsService } from './services/open-food-facts.service';

@Injectable()
export class NutritionService {
  constructor(
    private prisma: PrismaService,
    private usdaFoodDataService: UsdaFoodDataService,
    private foodRecognitionService: FoodRecognitionService,
    private openFoodFactsService: OpenFoodFactsService,
  ) {}

  /**
   * Comprehensive daily summary engine computing macronutrient and water progress
   * against user-defined goals for a given date.
   */
  async getDailySummary(userId: string, dateStr?: string) {
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    // Fetch or create user's nutrition targets
    let target = await this.prisma.nutritionTarget.findUnique({
      where: { userId },
    });
    if (!target) {
      target = await this.prisma.nutritionTarget.create({
        data: { userId },
      });
    }

    // Fetch all food and fluid logs for the selected date
    const meals = await this.prisma.foodLog.findMany({
      where: {
        userId,
        loggedAt: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
      orderBy: { loggedAt: 'desc' },
    });

    // Sum consumed totals with exact precision
    const consumed = meals.reduce(
      (acc, meal) => ({
        calories: acc.calories + meal.calories,
        proteinGrams: +(acc.proteinGrams + meal.proteinGrams).toFixed(1),
        carbsGrams: +(acc.carbsGrams + meal.carbsGrams).toFixed(1),
        fatsGrams: +(acc.fatsGrams + meal.fatsGrams).toFixed(1),
        waterMl: +(acc.waterMl + (meal.waterMl ?? 0)).toFixed(1),
      }),
      { calories: 0, proteinGrams: 0, carbsGrams: 0, fatsGrams: 0, waterMl: 0 },
    );

    // Calculate remaining amounts (clamped at 0)
    const remaining = {
      calories: Math.max(0, target.dailyCaloriesKcal - consumed.calories),
      proteinGrams: +Math.max(
        0,
        target.proteinGrams - consumed.proteinGrams,
      ).toFixed(1),
      carbsGrams: +Math.max(0, target.carbsGrams - consumed.carbsGrams).toFixed(
        1,
      ),
      fatsGrams: +Math.max(0, target.fatsGrams - consumed.fatsGrams).toFixed(1),
      waterMl: +Math.max(
        0,
        (target.waterMl ?? 2500) - consumed.waterMl,
      ).toFixed(1),
    };

    // Calculate progress percentages (e.g. 85%)
    const progressPercentages = {
      calories: Math.min(
        150,
        Math.round((consumed.calories / target.dailyCaloriesKcal) * 100),
      ),
      protein: Math.min(
        150,
        Math.round((consumed.proteinGrams / target.proteinGrams) * 100),
      ),
      carbs: Math.min(
        150,
        Math.round((consumed.carbsGrams / target.carbsGrams) * 100),
      ),
      fats: Math.min(
        150,
        Math.round((consumed.fatsGrams / target.fatsGrams) * 100),
      ),
      water: Math.min(
        150,
        Math.round((consumed.waterMl / (target.waterMl ?? 2500)) * 100),
      ),
    };

    return {
      date: dayStart.toISOString().split('T')[0],
      targets: {
        dailyCaloriesKcal: target.dailyCaloriesKcal,
        proteinGrams: target.proteinGrams,
        carbsGrams: target.carbsGrams,
        fatsGrams: target.fatsGrams,
        waterMl: target.waterMl ?? 2500,
      },
      consumed,
      remaining,
      progressPercentages,
      meals: meals.map((m) => ({
        id: m.id,
        foodName: m.foodName,
        portionDescription: m.portionDescription,
        portionGrams: m.portionGrams,
        calories: m.calories,
        proteinGrams: m.proteinGrams,
        carbsGrams: m.carbsGrams,
        fatsGrams: m.fatsGrams,
        waterMl: m.waterMl,
        mealType: m.mealType,
        barcode: m.barcode,
        confidenceScore: m.confidenceScore,
        loggedAt: m.loggedAt,
      })),
      totalLoggedItems: meals.length,
    };
  }

  async getTargets(userId: string) {
    const summary = await this.getDailySummary(userId);
    return {
      targets: summary.targets,
      todayConsumed: {
        calories: summary.consumed.calories,
        protein: summary.consumed.proteinGrams,
        carbs: summary.consumed.carbsGrams,
        fats: summary.consumed.fatsGrams,
        water: summary.consumed.waterMl,
      },
      remaining: {
        calories: summary.remaining.calories,
        protein: summary.remaining.proteinGrams,
        carbs: summary.remaining.carbsGrams,
        fats: summary.remaining.fatsGrams,
        water: summary.remaining.waterMl,
      },
    };
  }

  async updateTargets(userId: string, dto: UpdateNutritionTargetsDto) {
    return this.prisma.nutritionTarget.upsert({
      where: { userId },
      create: {
        userId,
        ...dto,
      },
      update: {
        ...dto,
      },
    });
  }

  async scanFood(userId: string, dto: ScanFoodDto) {
    // 0. If barcode provided, query OpenFoodFacts API for Australian/global packaged foods
    if (dto.barcode && dto.barcode.trim().length > 0) {
      const offProduct = await this.openFoodFactsService.lookupBarcode(
        dto.barcode,
      );
      if (offProduct) {
        return {
          success: true,
          food: {
            name: offProduct.productName,
            confidence: null,
          },
          nutrition: {
            calories: offProduct.calories,
            protein: offProduct.proteinGrams,
            carbs: offProduct.carbsGrams,
            fat: offProduct.fatsGrams,
            servingGrams: offProduct.portionGrams,
          },
          source: offProduct.source,
          portionMultiplier: 1.0,
          foodName: offProduct.productName,
          portionDescription: `Serving Size: ${offProduct.servingSize}`,
          portionGrams: offProduct.portionGrams,
          calories: offProduct.calories,
          proteinGrams: offProduct.proteinGrams,
          carbsGrams: offProduct.carbsGrams,
          fatsGrams: offProduct.fatsGrams,
          waterMl:
            offProduct.waterMl ?? Math.round(offProduct.portionGrams * 0.1),
          mealType: dto.mealType || 'SNACK',
          confidenceScore: null,
          barcode: offProduct.barcode,
          classificationBreakdown: [],
          micronutrients: {
            sodiumMg: offProduct.sodiumMg ?? 180,
            fiberG: offProduct.fiberGrams ?? 2.5,
          },
        };
      }
    }

    if (!dto.imageBase64 && !dto.foodQuery) return { success: false, reason: 'IMAGE_REQUIRED' };
    const recognition = await this.foodRecognitionService.recognize(dto.imageBase64, dto.foodQuery);
    if (!recognition) return { success: false, reason: 'LOW_CONFIDENCE' };
    const profile = await this.usdaFoodDataService.lookupFood(recognition.foodName);
    if (!profile) return { success: false, reason: 'NUTRITION_NOT_FOUND', recognition };

    // 2. Assemble clinical telemetry response adhering to Phase 5 contract
    return {
      success: true,
      food: {
        name: recognition.foodName,
        confidence: recognition.confidence,
      },
      nutrition: {
        calories: profile.calories, protein: profile.proteinGrams, carbs: profile.carbsGrams, fat: profile.fatsGrams, servingGrams: profile.portionGrams,
      },
      source: profile.source,
      portionMultiplier: 1.0,
      foodName: recognition.foodName, portionDescription: `Nutrition per ${profile.portionGrams}g`, portionGrams: profile.portionGrams, calories: profile.calories, proteinGrams: profile.proteinGrams, carbsGrams: profile.carbsGrams, fatsGrams: profile.fatsGrams, waterMl: profile.waterMl ?? 0,
      mealType: dto.mealType || 'LUNCH',
      confidenceScore: recognition.confidence, classificationBreakdown: recognition.breakdown,
      micronutrients: { potassiumMg: profile.potassiumMg, sodiumMg: profile.sodiumMg, fiberG: profile.fiberGrams },
    };
  }

  async logMeal(userId: string, dto: LogMealDto) {
    return this.prisma.foodLog.create({
      data: {
        userId,
        foodName: dto.foodName,
        portionDescription: dto.portionDescription,
        portionGrams: dto.portionGrams,
        calories: dto.calories,
        proteinGrams: dto.proteinGrams,
        carbsGrams: dto.carbsGrams,
        fatsGrams: dto.fatsGrams,
        waterMl: dto.waterMl ?? 0,
        mealType: dto.mealType ?? 'MEAL',
        barcode: dto.barcode,
        confidenceScore: dto.confidenceScore,
        loggedAt: new Date(),
      },
    });
  }

  async logWater(userId: string, dto: LogWaterDto) {
    return this.prisma.foodLog.create({
      data: {
        userId,
        foodName: `Hydration (${dto.amountMl}ml)`,
        portionDescription: `${dto.amountMl}ml of clean water`,
        portionGrams: dto.amountMl,
        calories: 0,
        proteinGrams: 0,
        carbsGrams: 0,
        fatsGrams: 0,
        waterMl: dto.amountMl,
        mealType: 'WATER',
        confidenceScore: 1.0,
        loggedAt: new Date(),
      },
    });
  }

  async deleteMeal(userId: string, logId: string) {
    const log = await this.prisma.foodLog.findFirst({
      where: { id: logId, userId },
    });
    if (!log) {
      throw new NotFoundException('Food log entry not found');
    }
    return this.prisma.foodLog.delete({
      where: { id: logId },
    });
  }

  async getGuidance() {
    return {
      recommendations: [
        {
          title: 'Protein Distribution',
          description:
            'Aim for 30-40g protein per major meal to optimize muscle protein synthesis and post-exercise cardiovascular recovery.',
        },
        {
          title: 'Hydration & Electrolytes',
          description:
            'Pair your hydration with subtle sodium and magnesium intake on days with zone 2 aerobic sessions exceeding 45 minutes.',
        },
        {
          title: 'Evening Carbohydrate Timing',
          description:
            'A low glycemic evening meal supports deeper sleep phases and stabilizes nighttime resting heart rate.',
        },
      ],
    };
  }
}
