import { Injectable, Logger } from '@nestjs/common';

export interface OpenFoodFactsProduct {
  barcode: string;
  productName: string;
  brand?: string;
  servingSize: string;
  portionGrams: number;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatsGrams: number;
  waterMl?: number;
  fiberGrams?: number;
  sodiumMg?: number;
  source: string;
}

@Injectable()
export class OpenFoodFactsService {
  private readonly logger = new Logger(OpenFoodFactsService.name);
  private readonly baseUrl = 'https://world.openfoodfacts.org/api/v0/product';

  /**
   * Look up an Australian or international product by its EAN/UPC barcode string.
   */
  async lookupBarcode(barcode: string): Promise<OpenFoodFactsProduct | null> {
    const cleanBarcode = barcode.trim();
    if (!cleanBarcode) return null;

    try {
      const url = `${this.baseUrl}/${encodeURIComponent(cleanBarcode)}.json`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'UnitedUnionHealth - Australian Health App - v1.0',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(4500),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 1 && data.product) {
          const p = data.product;
          const nutriments = p.nutriments || {};

          // Energy in kcal (convert kJ if kcal not directly specified)
          let kcal = nutriments['energy-kcal_100g'];
          if (!kcal && nutriments['energy_100g']) {
            kcal = Math.round(Number(nutriments['energy_100g']) / 4.184);
          }

          // Serving size
          let portionGrams = 100;
          const servingText = p.serving_size || '100g serving';

          const matchGrams = servingText.match(/(\d+(?:\.\d+)?)\s*g/i);
          if (matchGrams) {
            portionGrams = parseFloat(matchGrams[1]);
          } else if (nutriments['serving_size_g']) {
            portionGrams = Number(nutriments['serving_size_g']);
          }

          const multiplier = portionGrams / 100;
          if (!Number.isFinite(Number(kcal)) || !p.product_name_en && !p.product_name) return null;
          const calories = Math.round(Number(kcal) * multiplier);
          const protein = +(
            (Number(nutriments['proteins_100g']) || 0) * multiplier
          ).toFixed(1);
          const carbs = +(
            (Number(nutriments['carbohydrates_100g']) || 0) * multiplier
          ).toFixed(1);
          const fats = +(
            (Number(nutriments['fat_100g']) || 0) * multiplier
          ).toFixed(1);
          const fiber = +(
            (Number(nutriments['fiber_100g']) || 0) * multiplier
          ).toFixed(1);
          const sodium = Math.round(
            (Number(nutriments['sodium_100g']) || 0) * 1000 * multiplier,
          );

          const productName =
            p.product_name_en || p.product_name || `Product #${cleanBarcode}`;
          const brandText = p.brands ? ` (${p.brands})` : '';

          this.logger.log(
            `OpenFoodFacts matched barcode ${cleanBarcode}: "${productName}${brandText}"`,
          );

          return {
            barcode: cleanBarcode,
            productName: `${productName}${brandText}`,
            brand: p.brands,
            servingSize: servingText,
            portionGrams,
            calories,
            proteinGrams: protein,
            carbsGrams: carbs,
            fatsGrams: fats,
            waterMl: undefined,
            fiberGrams: fiber,
            sodiumMg: sodium,
            source: 'OpenFoodFacts Global & Australian Food Database',
          };
        }
      }
    } catch (err: any) {
      this.logger.warn(
        `OpenFoodFacts API lookup error for barcode ${cleanBarcode}: ${err.message}`,
      );
    }

    return null;
  }
}
