import { Logger } from '@nestjs/common';
import OpenAI from 'openai';
import {
  AiChatMessage,
  AiModelOptions,
  AiModelProvider,
  AiModelResponse,
} from '../interfaces/ai-model.interface';

export interface OpenAiCompatibleConfig {
  name: string;
  modelId: string;
  apiKey?: string;
  baseURL?: string;
  timeoutMs?: number;
}

export class OpenAiCompatibleProvider implements AiModelProvider {
  private readonly logger: Logger;
  private readonly client: OpenAI;
  public readonly name: string;
  public readonly modelId: string;

  constructor(private readonly config: OpenAiCompatibleConfig) {
    this.name = config.name;
    this.modelId = config.modelId;
    this.logger = new Logger(`AiProvider:${config.name}`);

    this.client = new OpenAI({
      apiKey: config.apiKey || process.env.AI_API_KEY || 'dummy-key-for-local',
      baseURL: config.baseURL || process.env.AI_API_BASE_URL || undefined,
      timeout: config.timeoutMs || 25000,
    });
  }

  async generateResponse(
    messages: AiChatMessage[],
    options?: AiModelOptions,
  ): Promise<AiModelResponse> {
    const startTime = Date.now();

    try {
      const response = await this.client.chat.completions.create({
        model: this.modelId,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.maxTokens ?? 512,
      });

      const latencyMs = Date.now() - startTime;
      const choice = response.choices[0];
      const text = choice?.message?.content?.trim() || '';

      return {
        text,
        model: response.model || this.modelId,
        provider: this.name,
        latencyMs,
        usage: {
          promptTokens: response.usage?.prompt_tokens ?? 0,
          completionTokens: response.usage?.completion_tokens ?? 0,
          totalTokens: response.usage?.total_tokens ?? 0,
        },
      };
    } catch (error: any) {
      this.logger.warn(
        `Failed to call provider ${this.name} (${this.modelId}): ${error.message}`,
      );
      throw error;
    }
  }
}
