export type ProviderAdapter =
  | "openai-compatible"
  | "azure-openai"
  | "ollama"
  | "anthropic"
  | "gemini"
  | "manual";

export type ModelDiscoveryMode =
  | "openai-models"
  | "ollama-tags"
  | "anthropic-models"
  | "gemini-models"
  | "manual"
  | "none";

export interface ProviderDefinition {
  id: string;
  labelVi: string;
  labelEn: string;
  adapter: ProviderAdapter;
  defaultBaseUrl: string;
  defaultChatPath?: string;
  defaultModelsPath?: string;
  supportsModelDiscovery: boolean;
  supportsChat: boolean;
  requiresApiKey: boolean;
  supportsExtraHeaders?: boolean;
  modelDiscoveryMode: ModelDiscoveryMode;
  noteVi?: string;
  noteEn?: string;
}

export const PROVIDER_REGISTRY: ProviderDefinition[] = [
  {
    id: "custom-openai-compatible",
    labelVi: "Tùy chỉnh OpenAI-compatible",
    labelEn: "Custom OpenAI-compatible",
    adapter: "openai-compatible",
    defaultBaseUrl: "",
    supportsModelDiscovery: true,
    supportsChat: true,
    requiresApiKey: true,
    supportsExtraHeaders: true,
    modelDiscoveryMode: "openai-models",
    noteVi: "Dùng cho routerapi, gateway riêng, hoặc API tương thích OpenAI.",
    noteEn: "Use for routerapi, custom gateways, or OpenAI-compatible APIs.",
  },
  {
    id: "openai",
    labelVi: "OpenAI",
    labelEn: "OpenAI",
    adapter: "openai-compatible",
    defaultBaseUrl: "https://api.openai.com/v1",
    supportsModelDiscovery: true,
    supportsChat: true,
    requiresApiKey: true,
    modelDiscoveryMode: "openai-models",
  },
  {
    id: "openrouter",
    labelVi: "OpenRouter",
    labelEn: "OpenRouter",
    adapter: "openai-compatible",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    supportsModelDiscovery: true,
    supportsChat: true,
    requiresApiKey: true,
    supportsExtraHeaders: true,
    modelDiscoveryMode: "openai-models",
  },
  {
    id: "groq",
    labelVi: "Groq",
    labelEn: "Groq",
    adapter: "openai-compatible",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    supportsModelDiscovery: true,
    supportsChat: true,
    requiresApiKey: true,
    modelDiscoveryMode: "openai-models",
  },
  {
    id: "deepseek",
    labelVi: "DeepSeek",
    labelEn: "DeepSeek",
    adapter: "openai-compatible",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    supportsModelDiscovery: true,
    supportsChat: true,
    requiresApiKey: true,
    modelDiscoveryMode: "openai-models",
  },
  {
    id: "together",
    labelVi: "Together AI",
    labelEn: "Together AI",
    adapter: "openai-compatible",
    defaultBaseUrl: "https://api.together.xyz/v1",
    supportsModelDiscovery: true,
    supportsChat: true,
    requiresApiKey: true,
    modelDiscoveryMode: "openai-models",
  },
  {
    id: "fireworks",
    labelVi: "Fireworks AI",
    labelEn: "Fireworks AI",
    adapter: "openai-compatible",
    defaultBaseUrl: "https://api.fireworks.ai/inference/v1",
    supportsModelDiscovery: true,
    supportsChat: true,
    requiresApiKey: true,
    modelDiscoveryMode: "openai-models",
  },
  {
    id: "mistral",
    labelVi: "Mistral",
    labelEn: "Mistral",
    adapter: "openai-compatible",
    defaultBaseUrl: "https://api.mistral.ai/v1",
    supportsModelDiscovery: true,
    supportsChat: true,
    requiresApiKey: true,
    modelDiscoveryMode: "openai-models",
  },
  {
    id: "perplexity",
    labelVi: "Perplexity",
    labelEn: "Perplexity",
    adapter: "openai-compatible",
    defaultBaseUrl: "https://api.perplexity.ai",
    supportsModelDiscovery: true,
    supportsChat: true,
    requiresApiKey: true,
    modelDiscoveryMode: "openai-models",
  },
  {
    id: "xai",
    labelVi: "xAI",
    labelEn: "xAI",
    adapter: "openai-compatible",
    defaultBaseUrl: "https://api.x.ai/v1",
    supportsModelDiscovery: true,
    supportsChat: true,
    requiresApiKey: true,
    modelDiscoveryMode: "openai-models",
  },
  {
    id: "cerebras",
    labelVi: "Cerebras",
    labelEn: "Cerebras",
    adapter: "openai-compatible",
    defaultBaseUrl: "https://api.cerebras.ai/v1",
    supportsModelDiscovery: true,
    supportsChat: true,
    requiresApiKey: true,
    modelDiscoveryMode: "openai-models",
  },
  {
    id: "sambanova",
    labelVi: "SambaNova",
    labelEn: "SambaNova",
    adapter: "openai-compatible",
    defaultBaseUrl: "https://api.sambanova.ai/v1",
    supportsModelDiscovery: true,
    supportsChat: true,
    requiresApiKey: true,
    modelDiscoveryMode: "openai-models",
  },
  {
    id: "siliconflow",
    labelVi: "SiliconFlow",
    labelEn: "SiliconFlow",
    adapter: "openai-compatible",
    defaultBaseUrl: "https://api.siliconflow.cn/v1",
    supportsModelDiscovery: true,
    supportsChat: true,
    requiresApiKey: true,
    modelDiscoveryMode: "openai-models",
  },
  {
    id: "azure-openai",
    labelVi: "Azure OpenAI",
    labelEn: "Azure OpenAI",
    adapter: "azure-openai",
    defaultBaseUrl: "",
    supportsModelDiscovery: false,
    supportsChat: false,
    requiresApiKey: true,
    modelDiscoveryMode: "none",
    noteVi: "Azure OpenAI cần endpoint deployment riêng.",
    noteEn: "Azure OpenAI requires a deployment-specific endpoint.",
  },
  {
    id: "lm-studio",
    labelVi: "LM Studio local",
    labelEn: "LM Studio local",
    adapter: "openai-compatible",
    defaultBaseUrl: "http://localhost:1234/v1",
    supportsModelDiscovery: true,
    supportsChat: true,
    requiresApiKey: false,
    modelDiscoveryMode: "openai-models",
  },
  {
    id: "localai",
    labelVi: "LocalAI",
    labelEn: "LocalAI",
    adapter: "openai-compatible",
    defaultBaseUrl: "http://localhost:8080/v1",
    supportsModelDiscovery: true,
    supportsChat: true,
    requiresApiKey: false,
    modelDiscoveryMode: "openai-models",
  },
  {
    id: "ollama",
    labelVi: "Ollama local",
    labelEn: "Ollama local",
    adapter: "ollama",
    defaultBaseUrl: "http://localhost:11434",
    supportsModelDiscovery: true,
    supportsChat: false,
    requiresApiKey: false,
    modelDiscoveryMode: "ollama-tags",
    noteVi: "Tải model local được, chat cần adapter Ollama riêng nếu chưa có.",
    noteEn: "Local model loading supported, chat requires a dedicated Ollama adapter if configured.",
  },
  {
    id: "anthropic",
    labelVi: "Anthropic Claude",
    labelEn: "Anthropic Claude",
    adapter: "anthropic",
    defaultBaseUrl: "https://api.anthropic.com",
    supportsModelDiscovery: false,
    supportsChat: false,
    requiresApiKey: true,
    modelDiscoveryMode: "none",
    noteVi: "Claude dùng API native, không phải OpenAI-compatible mặc định.",
    noteEn: "Claude uses a native API, not standard OpenAI-compatible.",
  },
  {
    id: "gemini",
    labelVi: "Google Gemini",
    labelEn: "Google Gemini",
    adapter: "gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com",
    supportsModelDiscovery: false,
    supportsChat: true,
    requiresApiKey: true,
    modelDiscoveryMode: "none",
    noteVi: "Gemini dùng API native, cần adapter riêng.",
    noteEn: "Gemini uses a native API, requiring a dedicated adapter.",
  },
  {
    id: "manual",
    labelVi: "Nhập model thủ công",
    labelEn: "Manual provider / Manual model",
    adapter: "manual",
    defaultBaseUrl: "",
    supportsModelDiscovery: false,
    supportsChat: true, // we will fallback to openai-compatible chat if user enters url
    requiresApiKey: false,
    modelDiscoveryMode: "manual",
    noteVi: "Dùng khi nhà cung cấp không có API liệt kê model.",
    noteEn: "Use when the provider does not expose a model list.",
  },
];

export function getProviderById(id: string): ProviderDefinition | undefined {
  return PROVIDER_REGISTRY.find((p) => p.id === id);
}
