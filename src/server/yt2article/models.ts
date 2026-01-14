export interface AIModel {
  id: string;
  name: string;
  provider: string;
}

export const AVAILABLE_MODELS: AIModel[] = [
  {
    id: "google/gemini-3-flash-preview",
    name: "Gemini 3 Flash",
    provider: "Google",
  },
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "Google",
  },
  {
    id: "z-ai/glm-4.7",
    name: "GLM 4.7",
    provider: "Z-AI",
  },
  {
    id: "deepseek/deepseek-v3.2",
    name: "DeepSeek V3.2",
    provider: "DeepSeek",
  },
  {
    id: "moonshotai/kimi-k2-0905",
    name: "Kimi K2",
    provider: "Moonshot AI",
  },
  {
    id: "moonshotai/kimi-k2-thinking",
    name: "Kimi K2 Thinking",
    provider: "Moonshot AI",
  }
];

export function getModelById(id: string): AIModel | undefined {
  return AVAILABLE_MODELS.find((model) => model.id === id);
}

export function isValidModelId(id: string): boolean {
  return AVAILABLE_MODELS.some((model) => model.id === id);
}

export const DEFAULT_MODEL_ID = "google/gemini-3-flash-preview";
