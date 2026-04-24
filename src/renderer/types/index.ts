export type ClientType = 'claudeCode' | 'codex';

// Sentinel activeProviderId meaning "use the client's built-in / official
// endpoint". Selecting it strips switch-managed fields from the client's
// config file (see clearClaudeConfig / clearCodexConfig in electron/main.cjs).
export const OFFICIAL_PROVIDER_ID = '__official__';

export interface Provider {
  id: string;
  name: string;
  apiKey: string;
  models: string[];
}

// Preset entry loaded from src/renderer/data/presets.json. Choosing a preset
// when adding a provider pre-fills the name and the apiBase of whichever
// client(s) the preset supports.
export interface Preset {
  id: string;
  name: string;
  codexBase?: string;
  claudeBase?: string;
}

export interface ClaudeProviderConfig {
  apiBase: string;
  models: {
    defaultModel: string;
    reasoningModel: string;
    haikuModel: string;
    sonnetModel: string;
    opusModel: string;
  };
}

export interface CodexProviderConfig {
  apiBase: string;
  model: string;
}

export interface ClaudeCodeConfig {
  activeProviderId: string;
  providerConfigs: Record<string, ClaudeProviderConfig>;
}

export interface CodexConfig {
  activeProviderId: string;
  providerConfigs: Record<string, CodexProviderConfig>;
}

export interface AppState {
  providers: Provider[];
  clientConfig: {
    claudeCode: ClaudeCodeConfig;
    codex: CodexConfig;
  };
}

export interface ActivateResult {
  success: boolean;
  target: string;
}

declare global {
  interface Window {
    switchAPI: {
      readState: () => Promise<AppState>;
      saveState: (state: AppState) => Promise<AppState>;
      activateConfig: (client: ClientType, providerId: string, state?: AppState) => Promise<ActivateResult>;
      showError: (payload: { title: string; message: string }) => Promise<boolean>;
    };
  }
}
