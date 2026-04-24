import type { AppState, ClaudeProviderConfig, CodexProviderConfig } from '../types';
import { OFFICIAL_PROVIDER_ID } from '../types';

function emptyClaudeProviderConfig(): ClaudeProviderConfig {
  return {
    apiBase: '',
    models: {
      defaultModel: '',
      reasoningModel: '',
      haikuModel: '',
      sonnetModel: '',
      opusModel: ''
    }
  };
}

function emptyCodexProviderConfig(): CodexProviderConfig {
  return {
    apiBase: '',
    model: ''
  };
}

export function ensureValidClientConfig(state: AppState): AppState {
  const providerIds = new Set(state.providers.map((p) => p.id));

  const nextClaudeProviderConfigs: Record<string, ClaudeProviderConfig> = {};
  Object.entries(state.clientConfig.claudeCode.providerConfigs || {}).forEach(([providerId, cfg]) => {
    if (!providerIds.has(providerId)) return;

    const provider = state.providers.find((p) => p.id === providerId);
    const providerModels = new Set(provider?.models ?? []);
    const models = {
      defaultModel: cfg?.models?.defaultModel || '',
      reasoningModel: cfg?.models?.reasoningModel || '',
      haikuModel: cfg?.models?.haikuModel || '',
      sonnetModel: cfg?.models?.sonnetModel || '',
      opusModel: cfg?.models?.opusModel || ''
    };

    (Object.keys(models) as Array<keyof typeof models>).forEach((key) => {
      if (models[key] && !providerModels.has(models[key])) {
        models[key] = '';
      }
    });

    nextClaudeProviderConfigs[providerId] = {
      apiBase: cfg?.apiBase || '',
      models
    };
  });

  const nextCodexProviderConfigs: Record<string, CodexProviderConfig> = {};
  Object.entries(state.clientConfig.codex.providerConfigs || {}).forEach(([providerId, cfg]) => {
    if (!providerIds.has(providerId)) return;

    const provider = state.providers.find((p) => p.id === providerId);
    const providerModels = new Set(provider?.models ?? []);
    const model = cfg?.model || '';

    nextCodexProviderConfigs[providerId] = {
      apiBase: cfg?.apiBase || '',
      model: model && providerModels.has(model) ? model : ''
    };
  });

  state.providers.forEach((provider) => {
    if (!nextClaudeProviderConfigs[provider.id]) {
      nextClaudeProviderConfigs[provider.id] = emptyClaudeProviderConfig();
    }
    if (!nextCodexProviderConfigs[provider.id]) {
      nextCodexProviderConfigs[provider.id] = emptyCodexProviderConfig();
    }
  });

  const isValidActive = (id: string) => id === OFFICIAL_PROVIDER_ID || providerIds.has(id);

  const claudeActive = isValidActive(state.clientConfig.claudeCode.activeProviderId)
    ? state.clientConfig.claudeCode.activeProviderId
    : '';
  const codexActive = isValidActive(state.clientConfig.codex.activeProviderId)
    ? state.clientConfig.codex.activeProviderId
    : '';

  return {
    ...state,
    clientConfig: {
      claudeCode: {
        activeProviderId: claudeActive,
        providerConfigs: nextClaudeProviderConfigs
      },
      codex: {
        activeProviderId: codexActive,
        providerConfigs: nextCodexProviderConfigs
      }
    }
  };
}
