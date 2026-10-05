import { Test, TestingModule } from '@nestjs/testing';
import { NutritionService } from './nutrition.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

import { UsdaFoodDataService } from './services/usda-food-data.service';
import { FoodRecognitionService } from './services/food-recognition.service';
import { OpenFoodFactsService } from './services/open-food-facts.service';

describe('NutritionService - Food Logging Engine (Phase 7.1)', () => {
  jest.setTimeout(15000);
  let service: NutritionService;

  const mockPrisma = {
    nutritionTarget: {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
    foodLog: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    foodNutritionCache: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };
  const mockRecognition = { recognize: jest.fn() };
  const mockUsda = { lookupFood: jest.fn() };
  const mockOff = { lookupBarcode: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NutritionService,
        { provide: UsdaFoodDataService, useValue: mockUsda },
        { provide: FoodRecognitionService, useValue: mockRecognition },
        { provide: OpenFoodFactsService, useValue: mockOff },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<NutritionService>(NutritionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should calculate exact daily macronutrient and water progress against user targets', async () => {
    const mockTarget = {
      userId: 'user-nutri-1',
      dailyCaloriesKcal: 2000,
      proteinGrams: 150,
      carbsGrams: 200,
      fatsGrams: 60,
      waterMl: 2500,
    };

    const mockMeals = [
      {
        id: 'meal-1',
        foodName: 'Oatmeal & Whey Protein',
        portionDescription: '1 bowl',
        portionGrams: 250,
        calories: 450,
        proteinGrams: 35.5,
        carbsGrams: 55.2,
        fatsGrams: 7.8,
        waterMl: 200,
        mealType: 'BREAKFAST',
        barcode: null,
        confidenceScore: 0.95,
        loggedAt: new Date(),
      },
      {
        id: 'meal-2',
        foodName: 'Grilled Chicken Salad',
        portionDescription: '300g plate',
        portionGrams: 300,
        calories: 550,
        proteinGrams: 48.0,
        carbsGrams: 22.4,
        fatsGrams: 16.2,
        waterMl: 150,
        mealType: 'LUNCH',
        barcode: '9300633852109',
        confidenceScore: 0.92,
        loggedAt: new Date(),
      },
      {
        id: 'meal-3',
        foodName: 'Hydration (500ml)',
        portionDescription: '500ml water',
        portionGrams: 500,
        calories: 0,
        proteinGrams: 0,
        carbsGrams: 0,
        fatsGrams: 0,
        waterMl: 500,
        mealType: 'WATER',
        barcode: null,
        confidenceScore: 1.0,
        loggedAt: new Date(),
      },
    ];

    mockPrisma.nutritionTarget.findUnique.mockResolvedValue(mockTarget);
    mockPrisma.foodLog.findMany.mockResolvedValue(mockMeals);

    const summary = await service.getDailySummary('user-nutri-1', '2026-09-29');

    expect(summary).toBeDefined();
    expect(summary.totalLoggedItems).toBe(3);

    // Exact sums
    expect(summary.consumed.calories).toBe(1000);
    expect(summary.consumed.proteinGrams).toBe(83.5);
    expect(summary.consumed.carbsGrams).toBe(77.6);
    expect(summary.consumed.fatsGrams).toBe(24.0);
    expect(summary.consumed.waterMl).toBe(850.0);

    // Remaining calculations
    expect(summary.remaining.calories).toBe(1000);
    expect(summary.remaining.proteinGrams).toBe(66.5);
    expect(summary.remaining.carbsGrams).toBe(122.4);
    expect(summary.remaining.fatsGrams).toBe(36.0);
    expect(summary.remaining.waterMl).toBe(1650.0);

    // Progress percentages
    expect(summary.progressPercentages.calories).toBe(50); // 1000 / 2000
    expect(summary.progressPercentages.protein).toBe(56); // 83.5 / 150
    expect(summary.progressPercentages.water).toBe(34); // 850 / 2500
  });

  it('should log a meal with exact macronutrient numbers', async () => {
    const mealDto = {
      foodName: 'Greek Yogurt with Blueberries',
      portionDescription: '200g bowl',
      portionGrams: 200,
      calories: 180,
      proteinGrams: 20.0,
      carbsGrams: 16.5,
      fatsGrams: 3.5,
      waterMl: 50,
      mealType: 'SNACK',
      barcode: '9310022345678',
      confidenceScore: 0.97,
    };

    mockPrisma.foodLog.create.mockResolvedValue({
      id: 'log-created-1',
      userId: 'user-nutri-1',
      ...mealDto,
      loggedAt: new Date(),
    });

    const result = await service.logMeal('user-nutri-1', mealDto);

    expect(result.id).toBe('log-created-1');
    expect(mockPrisma.foodLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-nutri-1',
          foodName: 'Greek Yogurt with Blueberries',
          calories: 180,
          proteinGrams: 20.0,
          waterMl: 50,
          mealType: 'SNACK',
        }),
      }),
    );
  });

  it('should log water intake standalone', async () => {
    mockPrisma.foodLog.create.mockResolvedValue({
      id: 'water-log-1',
      userId: 'user-nutri-1',
      foodName: 'Hydration (350ml)',
      waterMl: 350,
      calories: 0,
      loggedAt: new Date(),
    });

    const result = await service.logWater('user-nutri-1', { amountMl: 350 });

    expect(result.id).toBe('water-log-1');
    expect(mockPrisma.foodLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-nutri-1',
          waterMl: 350,
          mealType: 'WATER',
        }),
      }),
    );
  });

  it('should throw NotFoundException when deleting non-existent meal', async () => {
    mockPrisma.foodLog.findFirst.mockResolvedValue(null);

    await expect(
      service.deleteMeal('user-nutri-1', 'non-existent-id'),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns model recognition with authoritative USDA nutrition', async () => {
    mockRecognition.recognize.mockResolvedValue({ foodName: 'pizza', confidence: 0.91, breakdown: [{ label: 'pizza', confidence: 0.91 }] });
    mockUsda.lookupFood.mockResolvedValue({ foodName: 'Pizza', servingSize: '100g', portionGrams: 100, calories: 266, proteinGrams: 11, carbsGrams: 33, fatsGrams: 10, fdcId: 123, source: 'USDA' });
    const result = await service.scanFood('user-nutri-1', {
      imageBase64: 'data:image/jpeg;base64,valid-test-image',
      mealType: 'DINNER',
    });

    expect(result).toMatchObject({ success: true, foodName: 'pizza', calories: 266, portionGrams: 100, source: 'USDA', confidenceScore: 0.91 });
  });

  it('rejects low-confidence images instead of inventing a food', async () => {
    mockRecognition.recognize.mockResolvedValue(null);
    const result = await service.scanFood('user-nutri-1', {
      imageBase64: 'data:image/jpeg;base64,uncertain-image',
    });
    expect(result).toEqual({ success: false, reason: 'LOW_CONFIDENCE' });
  });

  it('should resolve OpenFoodFacts data when genuine Australian barcode is provided (Phase 7.3)', async () => {
    mockOff.lookupBarcode.mockResolvedValue({ barcode: '9300652009491', productName: 'Weet-Bix', servingSize: '33g', portionGrams: 33, calories: 107, proteinGrams: 4.1, carbsGrams: 21.7, fatsGrams: 0.4, source: 'OpenFoodFacts' });
    const result = await service.scanFood('user-nutri-1', {
      barcode: '9300652009491',
    });

    expect(result.barcode).toBe('9300652009491');
    expect(result.foodName.toLowerCase()).toContain('weet');
    expect(result.calories).toBeGreaterThan(0);
    expect(result.proteinGrams).toBeGreaterThan(0);
    expect(result.carbsGrams).toBeGreaterThan(0);
    expect(result.source).toContain('OpenFoodFacts');
  });
});
