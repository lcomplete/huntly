import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createGroq } from '@ai-sdk/groq';
import { createAzure } from '@ai-sdk/azure';
import { generateText, LanguageModel } from 'ai';
import {
  AIProviderConfig,
  ConnectionTestResult,
  PROVIDER_REGISTRY,
} from './types';
import {
  getOpenAICompatibleBaseUrl,
  getOllamaBaseUrl,
  getOllamaOpenAIBaseUrl,
} from './openAICompatibleProviders';

export function createProviderModel(
  config: AIProviderConfig,
  modelId?: string
): LanguageModel | null {
  const model = modelId || config.enabledModels[0];
  if (!model) return null;

  const meta = PROVIDER_REGISTRY[config.type];

  switch (config.type) {
    case 'openai': {
      const provider = createOpenAI({
        apiKey: config.apiKey,
        baseURL: getOpenAICompatibleBaseUrl(config),
      });
      return provider(model) as LanguageModel;
    }

    case 'anthropic': {
      const provider = createAnthropic({
        apiKey: config.apiKey,
        baseURL: config.baseUrl || undefined,
        headers: {
          'anthropic-dangerous-direct-browser-access': 'true',
        },
      });
      return provider(model) as LanguageModel;
    }

    case 'google': {
      const provider = createGoogleGenerativeAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl || undefined,
      });
      return provider(model) as LanguageModel;
    }

    case 'deepseek': {
      const provider = createDeepSeek({
        apiKey: config.apiKey,
        baseURL: config.baseUrl || undefined,
      });
      return provider(model) as LanguageModel;
    }

    case 'groq': {
      const provider = createGroq({
        apiKey: config.apiKey,
      });
      return provider(model) as LanguageModel;
    }

    case 'ollama': {
      const provider = createOpenAI({
        apiKey: config.apiKey || 'ollama',
        baseURL: getOllamaOpenAIBaseUrl(config.baseUrl),
      });
      return provider(model) as LanguageModel;
    }

    case 'azure-openai':
    case 'azure-ai': {
      if (!config.baseUrl) return null;
      const provider = createAzure({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
      });
      return provider(model) as LanguageModel;
    }

    case 'qwen': {
      // Qwen uses OpenAI-compatible API (DashScope)
      const provider = createOpenAI({
        apiKey: config.apiKey,
        baseURL: getOpenAICompatibleBaseUrl(config),
      });
      return provider(model) as LanguageModel;
    }

    case 'zhipu': {
      // Zhipu AI uses OpenAI-compatible API
      const provider = createOpenAI({
        apiKey: config.apiKey,
        baseURL: getOpenAICompatibleBaseUrl(config),
      });
      return provider(model) as LanguageModel;
    }

    case 'minimax': {
      // MiniMax uses OpenAI-compatible API
      const provider = createOpenAI({
        apiKey: config.apiKey,
        baseURL: getOpenAICompatibleBaseUrl(config),
      });
      return provider(model) as LanguageModel;
    }

    case 'huntly-server': {
      // Huntly Server is a special provider that uses the server's AI
      // It doesn't use the AI SDK directly, but through SSE streaming
      // Return null here as it's handled separately
      return null;
    }

    default:
      return null;
  }
}

export async function testProviderConnection(
  config: AIProviderConfig
): Promise<ConnectionTestResult> {
  try {
    // Huntly Server doesn't use the AI SDK directly
    if (config.type === 'huntly-server') {
      return {
        success: true,
        message: 'Huntly Server provider uses server-side AI configuration',
      };
    }

    // Check API key requirement (ollama doesn't require one)
    if (config.type !== 'ollama' && !config.apiKey) {
      return {
        success: false,
        message: 'API Key is required',
      };
    }

    if (
      (config.type === 'azure-openai' || config.type === 'azure-ai') &&
      !config.baseUrl
    ) {
      return {
        success: false,
        message: 'API URL is required for Azure',
      };
    }

    const meta = PROVIDER_REGISTRY[config.type];
    const testModel =
      config.enabledModels[0] || meta.defaultModels[0]?.id;

    if (!testModel) {
      return {
        success: false,
        message: 'No model available for testing',
      };
    }

    const model = createProviderModel(
      { ...config, enabledModels: [testModel] },
      testModel
    );

    if (!model) {
      return {
        success: false,
        message: 'Failed to create provider instance',
      };
    }

    const result = await generateText({
      model,
      prompt: 'Say "OK" in one word.',
      maxOutputTokens: 5,
    });

    // Check if we got a valid response - result.text can be empty string for some models
    // Also check finishReason to ensure the request actually completed
    if (result.text !== undefined && result.text !== null) {
      const responseText = result.text.trim();
      return {
        success: true,
        message: responseText
          ? `Connected! Response: ${responseText}`
          : `Connected! (Model responded with empty content, finishReason: ${result.finishReason || 'unknown'})`,
      };
    }

    return {
      success: false,
      message: 'No response received',
    };
  } catch (error: any) {
    let message = error.message || 'Connection failed';
    
    if (message.includes('401') || message.includes('Unauthorized')) {
      message = 'Invalid API Key';
    } else if (message.includes('403') || message.includes('Forbidden')) {
      message = 'Access denied. Check your API Key permissions.';
    } else if (message.includes('404')) {
      message = 'API endpoint not found. Check your API URL.';
    } else if (message.includes('CORS')) {
      message = 'CORS error. The API may not support browser access.';
    } else if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
      message = 'Network error. Check your connection and API URL.';
    }

    return {
      success: false,
      message,
    };
  }
}

export async function fetchOllamaModels(baseUrl?: string): Promise<string[]> {
  try {
    const url = getOllamaBaseUrl(baseUrl) + '/api/tags';
    const response = await fetch(url);
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    return (data.models || []).map((m: any) => m.name || m.model);
  } catch {
    return [];
  }
}
