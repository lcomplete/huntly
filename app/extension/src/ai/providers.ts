import { generateText, LanguageModel } from 'ai';
import {
  AIProviderConfig,
  ConnectionTestResult,
  PROVIDER_REGISTRY,
} from './types';
import {
  getOllamaBaseUrl,
} from './openAICompatibleProviders';
import { createLanguageModel } from '../sidepanel/modelBridge';

export function createProviderModel(
  config: AIProviderConfig,
  modelId?: string
): LanguageModel | null {
  const model = modelId || config.enabledModels[0];
  if (!model) return null;

  // Huntly Server is handled separately via SSE; no AI SDK model is created.
  if (config.type === 'huntly-server') return null;

  return createLanguageModel(
    {
      type: config.type,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      enabledModels: config.enabledModels,
      enabled: config.enabled,
      apiFormat: config.apiFormat,
    },
    model
  ) as LanguageModel | null;
}

export async function testProviderConnection(
  config: AIProviderConfig
): Promise<ConnectionTestResult> {
  try {
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
