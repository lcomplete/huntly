/**
 * AI Provider Types and Interfaces
 */

// Supported AI provider types
export type ProviderType =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'deepseek'
  | 'zhipu'
  | 'minimax'
  | 'groq'
  | 'ollama'
  | 'azure-openai'
  | 'azure-ai'
  | 'huntly-server';

// AI Provider configuration
export interface AIProviderConfig {
  type: ProviderType;
  apiKey: string;
  baseUrl?: string;
  enabledModels: string[];
  enabled: boolean;
  updatedAt: number;
}

// All AI providers storage structure
export interface AIProvidersStorage {
  providers: Record<ProviderType, AIProviderConfig | null>;
  defaultProvider: ProviderType | null;
}

// Provider metadata for UI display
export interface ProviderMeta {
  type: ProviderType;
  displayName: string;
  description: string;
  icon: string;
  requiresApiKey: boolean;
  supportsCustomUrl: boolean;
  defaultBaseUrl: string;
  defaultModels: ModelInfo[];
}

// Model information
export interface ModelInfo {
  id: string;
  name?: string; // Optional display name, defaults to id if not provided
  description?: string;
}

// Connection test result
export interface ConnectionTestResult {
  success: boolean;
  message: string;
  models?: string[];
}

// Provider metadata registry
export const PROVIDER_REGISTRY: Record<ProviderType, ProviderMeta> = {
  openai: {
    type: 'openai',
    displayName: 'OpenAI',
    description: 'GPT-5.2, GPT-4.1, o3, o4-mini and more',
    icon: 'openai',
    requiresApiKey: true,
    supportsCustomUrl: true,
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModels: [
      { id: 'gpt-5.2' },
      { id: 'gpt-5' },
      { id: 'gpt-5-mini' },
      { id: 'o4-mini' },
      { id: 'o3-pro' },
      { id: 'o3' },
      { id: 'o3-mini' },
      { id: 'gpt-4.1' },
      { id: 'gpt-4.1-mini' },
      { id: 'gpt-4.1-nano' },
      { id: 'gpt-4o' },
      { id: 'gpt-4o-mini' },
    ],
  },
  deepseek: {
    type: 'deepseek',
    displayName: 'DeepSeek',
    description: 'DeepSeek V3.2, R1, V3 and more',
    icon: 'deepseek',
    requiresApiKey: true,
    supportsCustomUrl: true,
    defaultBaseUrl: 'https://api.deepseek.com',
    defaultModels: [
      { id: 'deepseek-v3.2' },
      { id: 'deepseek-v3.1' },
      { id: 'deepseek-r1-0528' },
      { id: 'deepseek-v3-0324' },
      { id: 'deepseek-reasoner' },
      { id: 'deepseek-chat' },
    ],
  },
  groq: {
    type: 'groq',
    displayName: 'Groq',
    description: 'Ultra-fast inference with Llama, Qwen, DeepSeek',
    icon: 'groq',
    requiresApiKey: true,
    supportsCustomUrl: false,
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    defaultModels: [
      { id: 'groq/compound-mini' },
      { id: 'qwen/qwen3-32b' },
      { id: 'qwen-qwq-32b' },
      { id: 'llama-3.3-70b-versatile' },
      { id: 'deepseek-r1-distill-llama-70b' },
      { id: 'llama-3.1-8b-instant' },
      { id: 'qwen-2.5-32b' },
      { id: 'llama3-70b-8192' },
      { id: 'gemma2-9b-it' },
    ],
  },
  google: {
    type: 'google',
    displayName: 'Google (Gemini)',
    description: 'Gemini 3 Pro/Flash, 2.5 Pro/Flash',
    icon: 'google',
    requiresApiKey: true,
    supportsCustomUrl: true,
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModels: [
      { id: 'gemini-3-pro-preview' },
      { id: 'gemini-3-flash' },
      { id: 'gemini-2.5-pro' },
      { id: 'gemini-2.5-pro-preview' },
      { id: 'gemini-2.5-flash' },
      { id: 'gemini-2.5-flash-preview' },
      { id: 'gemini-2.5-flash-lite' },
    ],
  },
  ollama: {
    type: 'ollama',
    displayName: 'Ollama',
    description: 'Run local models on your machine',
    icon: 'ollama',
    requiresApiKey: false,
    supportsCustomUrl: true,
    defaultBaseUrl: 'http://localhost:11434',
    defaultModels: [
      { id: 'qwq:32b' },
      { id: 'phi4' },
      { id: 'gemma3' },
      { id: 'deepseek-r1:14b' },
      { id: 'qwen3:8b' },
      { id: 'llama3.3' },
      { id: 'llama3.2' },
      { id: 'deepseek-coder-v2' },
      { id: 'mistral' },
      { id: 'codellama' },
    ],
  },
  anthropic: {
    type: 'anthropic',
    displayName: 'Anthropic (Claude)',
    description: 'Claude Opus 4.5, Sonnet 4.5, Haiku 4.5 and more',
    icon: 'anthropic',
    requiresApiKey: true,
    supportsCustomUrl: true,
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    defaultModels: [
      { id: 'claude-opus-4-5-20250929' },
      { id: 'claude-sonnet-4-5-20250929' },
      { id: 'claude-haiku-4-5-20251015' },
      { id: 'claude-opus-4-20250514' },
      { id: 'claude-sonnet-4-20250514' },
      { id: 'claude-3-5-sonnet-20241022' },
      { id: 'claude-3-5-haiku-20241022' },
    ],
  },
  'azure-openai': {
    type: 'azure-openai',
    displayName: 'Azure OpenAI',
    description: 'OpenAI models on Azure',
    icon: 'azure',
    requiresApiKey: true,
    supportsCustomUrl: true,
    defaultBaseUrl: '',
    defaultModels: [
      { id: 'gpt-5.2' },
      { id: 'gpt-5' },
      { id: 'gpt-5-mini' },
      { id: 'o4-mini' },
      { id: 'o3' },
      { id: 'gpt-4.1' },
      { id: 'gpt-4o' },
      { id: 'gpt-4o-mini' },
    ],
  },
  'azure-ai': {
    type: 'azure-ai',
    displayName: 'Azure AI',
    description: 'Azure AI Foundry models',
    icon: 'azure',
    requiresApiKey: true,
    supportsCustomUrl: true,
    defaultBaseUrl: '',
    defaultModels: [
      { id: 'Mistral-small-2503' },
      { id: 'DeepSeek-V3' },
      { id: 'DeepSeek-R1' },
      { id: 'Llama-3.3-70B-Instruct' },
      { id: 'Phi-4' },
      { id: 'Phi-4-mini' },
      { id: 'Mistral-large-2411' },
    ],
  },
  zhipu: {
    type: 'zhipu',
    displayName: 'Zhipu AI (智谱)',
    description: 'GLM-4.7, GLM-Z1 and more',
    icon: 'zhipu',
    requiresApiKey: true,
    supportsCustomUrl: true,
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModels: [
      { id: 'glm-4.7' },
      { id: 'glm-4.6' },
      { id: 'glm-4.5' },
      { id: 'glm-z1-rumination' },
      { id: 'glm-z1-32b' },
      { id: 'glm-z1-airx' },
      { id: 'glm-z1-air' },
      { id: 'glm-z1-flash' },
      { id: 'glm-z1-9b' },
      { id: 'glm-4-flashx' },
    ],
  },
  minimax: {
    type: 'minimax',
    displayName: 'MiniMax',
    description: 'MiniMax M2, M1, Text-01 and more',
    icon: 'minimax',
    requiresApiKey: true,
    supportsCustomUrl: true,
    defaultBaseUrl: 'https://api.minimax.chat/v1',
    defaultModels: [
      { id: 'minimax-m2.1' },
      { id: 'minimax-m2' },
      { id: 'minimax-m1' },
      { id: 'MiniMax-VL-01' },
      { id: 'MiniMax-Text-01' },
      { id: 'abab6.5s-chat' },
      { id: 'abab6.5g-chat' },
    ],
  },
  'huntly-server': {
    type: 'huntly-server',
    displayName: 'Huntly Server',
    description: 'Use AI configured on your Huntly server',
    icon: 'huntly',
    requiresApiKey: false,
    supportsCustomUrl: false,
    defaultBaseUrl: '',
    defaultModels: [
      { id: 'server-default' },
    ],
  },
};

// Get all provider types in display order (Huntly Server first, then by influence/popularity)
export const PROVIDER_ORDER: ProviderType[] = [
  'huntly-server',
  'openai',
  'anthropic',
  'google',
  'deepseek',
  'zhipu',
  'minimax',
  'groq',
  'ollama',
  'azure-openai',
  'azure-ai',
];

// Default empty storage
export const DEFAULT_AI_STORAGE: AIProvidersStorage = {
  providers: {
    openai: null,
    anthropic: null,
    google: null,
    deepseek: null,
    zhipu: null,
    minimax: null,
    groq: null,
    ollama: null,
    'azure-openai': null,
    'azure-ai': null,
    'huntly-server': null,
  },
  defaultProvider: null,
};
