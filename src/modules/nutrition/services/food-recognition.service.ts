import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharp = require('sharp');

export interface FoodRecognitionResult {
  foodName: string;
  confidence: number;
  breakdown: Array<{ label: string; confidence: number }>;
}

@Injectable()
export class FoodRecognitionService {
  private readonly logger = new Logger(FoodRecognitionService.name);
  private readonly pythonVisionUrl =
    process.env.FOOD_VISION_URL ?? 'http://127.0.0.1:8001';
  private readonly ollamaUrl =
    process.env.OLLAMA_HOST ?? 'http://localhost:11434';
  private readonly threshold = Number(
    process.env.FOOD_RECOGNITION_THRESHOLD ?? '0.40',
  );

  async recognize(
    imageBase64?: string,
    foodQuery?: string,
  ): Promise<FoodRecognitionResult | null> {
    // 1. Explicit text query has priority
    if (foodQuery && foodQuery.trim().length > 0) {
      const name = this.cleanFoodName(foodQuery.trim());
      return {
        foodName: name,
        confidence: 0.98,
        breakdown: [{ label: name, confidence: 0.98 }],
      };
    }

    if (!imageBase64 || imageBase64.length < 50) {
      return null;
    }

    this.logger.log('Image received for local food-model inference');

    // 2. Try dedicated Python food-vision service if running
    try {
      const pyResult = await this.tryPythonVisionService(imageBase64);
      if (pyResult) {
        return pyResult;
      }
    } catch {
      // Fall through to local Ollama vision model
    }

    // 3. Run local Ollama Moondream Vision Model
    try {
      const ollamaResult = await this.tryOllamaVisionModel(imageBase64);
      if (ollamaResult) {
        return ollamaResult;
      }
    } catch (err: any) {
      this.logger.warn(`Local Ollama vision model error: ${err.message}`);
    }

    return null;
  }

  private async tryPythonVisionService(
    imageBase64: string,
  ): Promise<FoodRecognitionResult | null> {
    const response = await fetch(`${this.pythonVisionUrl}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageBase64 }),
      signal: AbortSignal.timeout(3000), // 3s fast-check
    });

    if (response.ok) {
      const payload = (await response.json()) as {
        predictions?: Array<{ label: string; score: number }>;
      };
      const predictions = (payload.predictions ?? []).filter(
        (p) => typeof p.label === 'string' && Number.isFinite(p.score),
      );
      const top = predictions[0];
      if (top && top.score >= this.threshold) {
        const cleanedLabel = this.cleanFoodName(top.label);
        return {
          foodName: cleanedLabel,
          confidence: top.score,
          breakdown: predictions.map((p) => ({
            label: this.cleanFoodName(p.label),
            confidence: p.score,
          })),
        };
      }
    }
    return null;
  }

  private async tryOllamaVisionModel(
    imageBase64: string,
  ): Promise<FoodRecognitionResult | null> {
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(cleanBase64, 'base64');

    // Preprocess & resize to 320x240 JPEG for rapid inference
    const resizedBuffer = await sharp(imageBuffer)
      .resize(320, 240, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    const resizedBase64 = resizedBuffer.toString('base64');

    this.logger.log(
      `Dispatching preprocessed frame (${Math.round(resizedBase64.length / 1024)}KB) to Ollama Moondream...`,
    );

    const response = await fetch(`${this.ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'moondream',
        prompt: 'What food is shown in this picture?',
        images: [resizedBase64],
        stream: false,
      }),
      signal: AbortSignal.timeout(35000),
    });

    if (response.ok) {
      const data = (await response.json()) as { response?: string };
      const rawText = (data.response || '').trim();
      this.logger.log(`Ollama Moondream vision output: "${rawText}"`);

      if (rawText.length >= 3) {
        // Step 2: Use fast local LLM (qwen2.5-coder:1.5b) to extract exact dish name
        let dishName = await this.extractDishNameWithQwen(rawText);
        if (!dishName || dishName.length < 3) {
          dishName = this.cleanFoodName(rawText);
        }

        if (dishName && dishName.length >= 3) {
          return {
            foodName: dishName,
            confidence: 0.94,
            breakdown: [{ label: dishName, confidence: 0.94 }],
          };
        }
      }
    }

    return null;
  }

  private async extractDishNameWithQwen(description: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'qwen2.5-coder:1.5b',
          prompt: `Extract the food dish name from this description in 1 to 3 words: "${description}". Output only the food name.`,
          stream: false,
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (response.ok) {
        const data = (await response.json()) as { response?: string };
        const raw = (data.response || '').trim().replace(/["'*\n]/g, '').trim();
        if (raw.length >= 3) {
          return this.cleanFoodName(raw);
        }
      }
    } catch {
      // Fall through to regex extraction
    }
    return null;
  }

  private cleanFoodName(raw: string): string {
    let text = (raw || '').trim();
    // Remove introductory prefixes
    text = text.replace(
      /^(the image shows|this is|here is|there is|a photo of|an image of|a picture of|a plate of|a plate filled with|a bowl of|a dish of|a serving of|a close-up view of a plate filled with|a close-up view of|a|an)\s+/i,
      '',
    );
    // Remove trailing period or punctuation
    text = text.replace(/[.;:!?]+$/, '').trim();
    // Keep first sentence or line
    text = text.split(/[.\n,]/)[0].trim();
    // Capitalize words
    return text
      .split(' ')
      .filter((w) => w.length > 0)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
}
