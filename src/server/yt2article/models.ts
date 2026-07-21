export interface AIModel {
  id: string;
  name: string;
  provider: string;
}

export const AVAILABLE_MODELS: AIModel[] = [
  {
    id: "google/gemini-3.6-flash",
    name: "Gemini 3.6 Flash",
    provider: "Google",
  },
  {
    id: "z-ai/glm-5.2",
    name: "GLM 5.2",
    provider: "Z-AI",
  },
  {
    id: "deepseek/deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    provider: "DeepSeek",
  },
  {
    id: "anthropic/claude-sonnet-5",
    name: "Sonnet 5",
    provider: "Anthropic",
  },
  {
    id: "moonshotai/kimi-k3",
    name: "Kimi K3",
    provider: "Moonshot AI",
  },
  {
    id: "openai/gpt-5.6-sol",
    name: "GPT 5.6 Sol",
    provider: "OpenAI",
  },
  {
    id: "sakana/fugu-ultra",
    name: "Fugu Ultra",
    provider: "Sakana",
  }
] as const;

export function getModelById(id: string): AIModel | undefined {
  return AVAILABLE_MODELS.find((model) => model.id === id);
}

export function isValidModelId(id: string): boolean {
  return AVAILABLE_MODELS.some((model) => model.id === id);
}

export const DEFAULT_MODEL_ID = "deepseek/deepseek-v4-pro";
