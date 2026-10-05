import {
  AiChatMessage,
  AiModelOptions,
  AiModelProvider,
  AiModelResponse,
} from '../interfaces/ai-model.interface';
import {
  EMERGENCY_KEYWORDS,
  FORBIDDEN_DIAGNOSTIC_KEYWORDS,
  FORBIDDEN_PRESCRIPTION_KEYWORDS,
  MANDATORY_MEDICAL_DISCLAIMER,
} from '../prompts/wellness_guardrails';

export class MockFallbackProvider implements AiModelProvider {
  public readonly name: string;
  public readonly modelId: string;

  constructor(name = 'MockFallback', modelId = 'fallback-deterministic-v1') {
    this.name = name;
    this.modelId = modelId;
  }

  async generateResponse(
    messages: AiChatMessage[],
    options?: AiModelOptions,
  ): Promise<AiModelResponse> {
    void options;
    const startTime = Date.now();
    const lastUserMessage =
      messages
        .filter((m) => m.role === 'user')
        .slice(-1)[0]
        ?.content?.toLowerCase() || '';

    let text = '';

    // Check emergency red flags
    if (EMERGENCY_KEYWORDS.some((kw) => lastUserMessage.includes(kw))) {
      text =
        'CRITICAL ALERT: If you are experiencing chest pain, difficulty breathing, or symptoms of a stroke or medical emergency, please IMMEDIATELY call emergency services (000 in Australia, 911 in the US) or go to the nearest emergency hospital. Do not wait or rely on this wellness app.';
    } else if (
      FORBIDDEN_DIAGNOSTIC_KEYWORDS.some((kw) => lastUserMessage.includes(kw))
    ) {
      text =
        'As an AI wellness companion, I cannot diagnose medical conditions or illnesses. Please share these symptoms and lab results directly with your primary care doctor for clinical evaluation and diagnostic testing.';
    } else if (
      FORBIDDEN_PRESCRIPTION_KEYWORDS.some((kw) => lastUserMessage.includes(kw))
    ) {
      text =
        'I cannot prescribe medications or adjust dosages. Any modifications to your prescription regimen should only be directed and reviewed by your prescribing doctor or pharmacist.';
    } else if (
      lastUserMessage.includes('sleep') ||
      lastUserMessage.includes('rest')
    ) {
      text =
        'Looking at your recent sleep cycles, your sleep efficiency and deep sleep duration provide a strong foundation for physical recovery. For optimal circadian rhythm support, try dimming blue light exposure 45 minutes prior to sleep and keeping a regular wake window.';
    } else if (
      lastUserMessage.includes('heart') ||
      lastUserMessage.includes('bpm') ||
      lastUserMessage.includes('cardio')
    ) {
      text =
        'Your resting heart rate trends reflect steady cardiovascular stability. If engaging in Zone 2 training, staying within your personalized aerobic heart rate threshold will foster mitochondrial endurance without overtaxing your recovery capacity.';
    } else if (
      lastUserMessage.includes('step') ||
      lastUserMessage.includes('activity') ||
      lastUserMessage.includes('walk')
    ) {
      text =
        'Great progress on your daily activity. Steady daily steps support glycemic regulation and cardiovascular stamina. Breaking up sedentary desk periods with 5-minute brisk walking bursts is an effective way to reach your daily movement targets.';
    } else {
      text =
        'Welcome! I am reviewing your connected wearable biometric metrics. Maintain your consistent activity routine, stay well hydrated, and feel free to ask about your sleep, activity, or resting vitals.';
    }

    if (!text.includes('Medical Notice:')) {
      text += MANDATORY_MEDICAL_DISCLAIMER;
    }

    const latencyMs = Math.max(15, Date.now() - startTime);

    return {
      text,
      model: this.modelId,
      provider: this.name,
      latencyMs,
      usage: {
        promptTokens: Math.round(lastUserMessage.length / 4),
        completionTokens: Math.round(text.length / 4),
        totalTokens: Math.round((lastUserMessage.length + text.length) / 4),
      },
    };
  }
}
