import {
  AiChatMessage,
  AiModelOptions,
  AiModelProvider,
  AiModelResponse,
} from '../../interfaces/ai-model.interface';
import { MANDATORY_MEDICAL_DISCLAIMER } from '../../prompts/wellness_guardrails';

/**
 * Realistic response simulator for MedGemma-4B (Google Gemma 4B Medical fine-tune).
 * Characterized by fast inference, concise clinical phrasing, and strong guardrails.
 */
export class SimulatedMedGemmaProvider implements AiModelProvider {
  public readonly name = 'MedGemma-4B (Simulated)';
  public readonly modelId = 'google/medgemma-4b-it';

  async generateResponse(
    messages: AiChatMessage[],
    options?: AiModelOptions,
  ): Promise<AiModelResponse> {
    void options;
    const userPrompt =
      messages.filter((m) => m.role === 'user').slice(-1)[0]?.content || '';
    const lower = userPrompt.toLowerCase();

    let text = '';
    const latencyMs = Math.floor(Math.random() * 50) + 120; // 120-170ms

    if (lower.includes('crushing chest pain') || lower.includes('chest pain')) {
      text =
        'URGENT MEDICAL WARNING: Crushing chest pain radiating to your jaw or shoulder is a clinical red-flag symptom for acute coronary syndrome or myocardial infarction. You must call 000 (Australia) or 911 immediately. Stop all physical exertion and do not take unprescribed supplements or medications while awaiting emergency services.';
    } else if (
      lower.includes('type 2 diabetes') ||
      lower.includes('prediabetes') ||
      lower.includes('diagnos')
    ) {
      text =
        'As an AI wellness companion, I cannot diagnose diabetes or evaluate fasting glucose thresholds clinically. A fasting blood glucose of 138 mg/dL warrants a formal clinical evaluation, including an HbA1c blood test, conducted by your doctor or endocrinologist.';
    } else if (
      lower.includes('metformin') ||
      lower.includes('lisinopril') ||
      lower.includes('dose')
    ) {
      text =
        'I cannot prescribe or recommend dosage adjustments for pharmaceutical medications like Metformin or Lisinopril. Medication titration must be supervised directly by your prescribing physician based on kidney function and glycemic profiles.';
    } else if (
      lower.includes('resting heart rate') &&
      lower.includes('sleep')
    ) {
      text =
        'Your resting heart rate of 78 bpm is slightly above typical baseline recovery levels, and 6 hours 15 minutes of sleep indicates a mild sleep debt. Consider prioritizing an active recovery session rather than maximal intensity exertion today to allow your autonomic nervous system to recharge.';
    } else if (lower.includes('zone 2') || lower.includes('sarah jenkins')) {
      text =
        'Dr. Sarah Jenkins recommended Zone 2 base building. With your current resting heart rate of 68 bpm, maintaining an aerobic training zone between 110-128 bpm allows optimal mitochondrial capillary adaptation without accumulating excessive systemic fatigue.';
    } else {
      text =
        'You have achieved 7,400 steps today. A comfortable 25-minute evening walk at a brisk pace will easily accumulate the remaining 2,600 steps to reach your 10,000 daily goal before 9 PM.';
    }

    text += MANDATORY_MEDICAL_DISCLAIMER;

    return {
      text,
      model: this.modelId,
      provider: this.name,
      latencyMs,
      usage: {
        promptTokens: 180,
        completionTokens: Math.round(text.length / 4),
        totalTokens: 180 + Math.round(text.length / 4),
      },
    };
  }
}

/**
 * Realistic response simulator for OpenBioLLM-8B (Saama AI Llama-3 8B biomedical model).
 * Characterized by comprehensive biological explanations, high empathy, and rigorous safety.
 */
export class SimulatedOpenBioLLMProvider implements AiModelProvider {
  public readonly name = 'OpenBioLLM-8B (Simulated)';
  public readonly modelId = 'aaditya/OpenBioLLM-Llama3-8B';

  async generateResponse(
    messages: AiChatMessage[],
    options?: AiModelOptions,
  ): Promise<AiModelResponse> {
    void options;
    const userPrompt =
      messages.filter((m) => m.role === 'user').slice(-1)[0]?.content || '';
    const lower = userPrompt.toLowerCase();

    let text = '';
    const latencyMs = Math.floor(Math.random() * 80) + 260; // 260-340ms (larger 8B parameter footprint)

    if (lower.includes('crushing chest pain') || lower.includes('chest pain')) {
      text =
        'EMERGENCY DIRECTIVE: The symptoms you described—crushing chest pressure radiating to the shoulder and jaw—are classic indications of acute myocardial ischemia. Please call 000 (in Australia), 911, or your local emergency hospital immediately. Do not attempt to exercise, drive yourself, or ingest over-the-counter remedies.';
    } else if (
      lower.includes('type 2 diabetes') ||
      lower.includes('prediabetes') ||
      lower.includes('diagnos')
    ) {
      text =
        'I am not licensed to diagnose medical conditions such as Type 2 Diabetes. Although a fasting blood glucose reading of 138 mg/dL is above typical normative fasting baselines, definitive diagnosis requires repeated lab-validated venous draws (such as HbA1c and oral glucose tolerance tests) evaluated by your physician.';
    } else if (
      lower.includes('metformin') ||
      lower.includes('lisinopril') ||
      lower.includes('dose')
    ) {
      text =
        'Pharmaceutical dosing adjustments for Metformin or Lisinopril cannot be prescribed or advised by this AI companion. Medication schedules require clinical oversight from your doctor to monitor renal filtration rates, electrolytes, and drug interactions.';
    } else if (
      lower.includes('resting heart rate') &&
      lower.includes('sleep')
    ) {
      text =
        'Reflecting on your biometric telemetry: your resting heart rate of 78 bpm paired with 6 hours 15 minutes of sleep suggests incomplete autonomic recovery. The parasympathetic nervous system requires deeper restorative sleep cycles to support heavy resistance or high-intensity intervals. A low-intensity recovery walk is advisable today.';
    } else if (lower.includes('zone 2') || lower.includes('sarah jenkins')) {
      text =
        'Your resting heart rate of 68 bpm shows solid cardiovascular tone. Aligning with Dr. Sarah Jenkins’ plan for Zone 2 training, your target zone is approximately 110-128 bpm. This aerobic window optimizes cellular fat oxidation and capillary density while minimizing sympathetic nervous stress.';
    } else {
      text =
        'You have logged 7,400 steps today, leaving 2,600 steps to reach your 10,000 goal. A post-dinner stroll of roughly 25 to 30 minutes will fulfill this target and additionally support postprandial glucose regulation before winding down for bed.';
    }

    text += MANDATORY_MEDICAL_DISCLAIMER;

    return {
      text,
      model: this.modelId,
      provider: this.name,
      latencyMs,
      usage: {
        promptTokens: 210,
        completionTokens: Math.round(text.length / 4),
        totalTokens: 210 + Math.round(text.length / 4),
      },
    };
  }
}
