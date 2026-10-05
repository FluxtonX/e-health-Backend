import { BenchmarkRunner } from './benchmark-runner';
import { UNITED_UNION_BENCHMARK_DATASET } from './benchmark.dataset';
import { MockFallbackProvider } from '../providers/mock-fallback.provider';
import { OpenAiCompatibleProvider } from '../providers/openai-compatible.provider';

describe('AI Wellness Architecture & Benchmark Suite (Phase 6.1)', () => {
  it('should have a robust United Union Health benchmark question dataset', () => {
    expect(UNITED_UNION_BENCHMARK_DATASET.length).toBeGreaterThanOrEqual(6);

    const emergencyQuestion = UNITED_UNION_BENCHMARK_DATASET.find(
      (q) => q.category === 'CLINICAL_EMERGENCY',
    );
    expect(emergencyQuestion).toBeDefined();
    expect(emergencyQuestion?.expectedBehavior.shouldTriggerEmergency).toBe(
      true,
    );

    const diagnosisQuestion = UNITED_UNION_BENCHMARK_DATASET.find(
      (q) => q.category === 'FORBIDDEN_DIAGNOSIS',
    );
    expect(diagnosisQuestion).toBeDefined();
    expect(diagnosisQuestion?.expectedBehavior.shouldRefuseClinicalAction).toBe(
      true,
    );

    const prescriptionQuestion = UNITED_UNION_BENCHMARK_DATASET.find(
      (q) => q.category === 'FORBIDDEN_PRESCRIPTION',
    );
    expect(prescriptionQuestion).toBeDefined();
    expect(
      prescriptionQuestion?.expectedBehavior.shouldRefuseClinicalAction,
    ).toBe(true);
  });

  it('should evaluate candidate model provider and generate safety metrics', async () => {
    const fallbackProvider = new MockFallbackProvider(
      'BaselineClinicalGuardrails',
      'uuh-deterministic-v1',
    );

    const result = await BenchmarkRunner.evaluateModel(
      fallbackProvider,
      UNITED_UNION_BENCHMARK_DATASET,
    );

    expect(result.providerName).toBe('BaselineClinicalGuardrails');
    expect(result.totalQuestions).toBe(UNITED_UNION_BENCHMARK_DATASET.length);
    expect(result.safetyScorePercent).toBe(100);
    expect(result.passedAllSafetyChecks).toBe(true);
    expect(result.biometricGroundingScorePercent).toBeGreaterThanOrEqual(50);
    expect(result.averageLatencyMs).toBeGreaterThan(0);
  });

  it('should generate structured markdown comparison for MedGemma and OpenBioLLM', async () => {
    const medGemmaMock = new MockFallbackProvider('MedGemma-4B', 'medgemma:4b');
    const openBioMock = new MockFallbackProvider(
      'OpenBioLLM-8B',
      'openbiollm:8b',
    );

    const [res1, res2] = await Promise.all([
      BenchmarkRunner.evaluateModel(medGemmaMock),
      BenchmarkRunner.evaluateModel(openBioMock),
    ]);

    const markdown = BenchmarkRunner.generateComparisonMarkdown([res1, res2]);
    expect(markdown).toContain('MedGemma-4B');
    expect(markdown).toContain('OpenBioLLM-8B');
    expect(markdown).toContain('Safety Score');
    expect(markdown).toContain('Biometric Grounding');
  });

  it('should configure OpenAI-compatible provider with custom base URL', () => {
    const provider = new OpenAiCompatibleProvider({
      name: 'OpenBioLLM-Local',
      modelId: 'aaditya/OpenBioLLM-Llama3-8B',
      baseURL: 'http://localhost:11434/v1',
      apiKey: 'test-key',
    });

    expect(provider.name).toBe('OpenBioLLM-Local');
    expect(provider.modelId).toBe('aaditya/OpenBioLLM-Llama3-8B');
  });
});
