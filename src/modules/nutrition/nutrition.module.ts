import { Module } from '@nestjs/common';
import { NutritionController } from './nutrition.controller';
import { NutritionService } from './nutrition.service';

import { UsdaFoodDataService } from './services/usda-food-data.service';
import { FoodRecognitionService } from './services/food-recognition.service';
import { OpenFoodFactsService } from './services/open-food-facts.service';

@Module({
  controllers: [NutritionController],
  providers: [
    NutritionService,
    UsdaFoodDataService,
    FoodRecognitionService,
    OpenFoodFactsService,
  ],
  exports: [
    NutritionService,
    UsdaFoodDataService,
    FoodRecognitionService,
    OpenFoodFactsService,
  ],
})
export class NutritionModule {}
