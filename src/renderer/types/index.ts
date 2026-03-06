export type ClientType = 'claudeCode' | 'codex';

export interface Provider {
  id: string;
  name: string;
  apiKey: string;
  models: string[];
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
