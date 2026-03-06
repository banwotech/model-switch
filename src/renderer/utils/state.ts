import type { AppState, ClaudeProviderConfig, CodexProviderConfig } from '../types';

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

  if (!providerIds.has(state.clientConfig.claudeCode.activeProviderId)) {
    state.clientConfig.claudeCode.activeProviderId = '';
  }

  if (!providerIds.has(state.clientConfig.codex.activeProviderId)) {
    state.clientConfig.codex.activeProviderId = '';
  }

  state.clientConfig.claudeCode.providerConfigs = nextClaudeProviderConfigs;
  state.clientConfig.codex.providerConfigs = nextCodexProviderConfigs;

  state.providers.forEach((provider) => {
    if (!state.clientConfig.claudeCode.providerConfigs[provider.id]) {
      state.clientConfig.claudeCode.providerConfigs[provider.id] = emptyClaudeProviderConfig();
    }
    if (!state.clientConfig.codex.providerConfigs[provider.id]) {
      state.clientConfig.codex.providerConfigs[provider.id] = emptyCodexProviderConfig();
    }
  });

  return state;
}
