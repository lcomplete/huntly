import { getAIProvidersStorage } from "../../ai/storage";
import { PROVIDER_ORDER, PROVIDER_REGISTRY } from "../../ai/types";
import type { AIProviderConfig } from "../../ai/types";
import { createLanguageModel } from "../modelBridge";
import type { HuntlyModelInfo } from "../types";

export async function loadModels(): Promise<HuntlyModelInfo[]> {
  const storage = await getAIProvidersStorage();
  const results: HuntlyModelInfo[] = [];

  for (const type of PROVIDER_ORDER) {
    if (type === "huntly-server") continue;

    const config = storage.providers[type] as AIProviderConfig | null;
    if (!config?.enabled) continue;

    const meta = PROVIDER_REGISTRY[type];

    for (const modelId of config.enabledModels) {
      const model = createLanguageModel(
        {
          type,
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          enabledModels: config.enabledModels,
          enabled: config.enabled,
          apiFormat: config.apiFormat,
        },
        modelId
      );
      if (!model) continue;

      results.push({
        model,
        modelId,
        provider: type,
        displayName: `${meta.displayName} / ${modelId}`,
      });
    }
  }

  return results;
}
