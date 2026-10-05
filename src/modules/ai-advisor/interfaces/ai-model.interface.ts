export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiModelOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface AiModelResponse {
  text: string;
  model: string;
  provider: string;
  latencyMs: number;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AiModelProvider {
  readonly name: string;
  readonly modelId: string;
  generateResponse(
    messages: AiChatMessage[],
    options?: AiModelOptions,
  ): Promise<AiModelResponse>;
}
