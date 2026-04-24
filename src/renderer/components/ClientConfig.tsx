import { useMemo, useState } from 'react';
import type {
  AppState,
  ClientType,
  ClaudeProviderConfig,
  CodexProviderConfig,
  Provider
} from '../types';
import { OFFICIAL_PROVIDER_ID } from '../types';

interface Props {
  state: AppState;
  onChange: (state: AppState) => void;
  onActivate: (client: ClientType, providerId: string) => Promise<void>;
  onGoProviderManager: () => void;
}

const CLAUDE_FIELDS = [
  ['defaultModel', '默认模型'],
  ['reasoningModel', '推理模型'],
  ['haikuModel', 'Haiku 默认模型'],
  ['sonnetModel', 'Sonnet 默认模型'],
  ['opusModel', 'Opus 默认模型']
] as const;

function providerModels(providers: Provider[], providerId: string): string[] {
  return providers.find((p) => p.id === providerId)?.models.filter(Boolean) ?? [];
}

function emptyClaudeConfig(): ClaudeProviderConfig {
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

function emptyCodexConfig(): CodexProviderConfig {
  return {
    apiBase: '',
    model: ''
  };
}

function cloneClaudeConfig(config?: ClaudeProviderConfig): ClaudeProviderConfig {
  const source = config || emptyClaudeConfig();
  return {
    ...source,
    models: {
      ...source.models
    }
  };
}

function cloneCodexConfig(config?: CodexProviderConfig): CodexProviderConfig {
  const source = config || emptyCodexConfig();
  return {
    ...source
  };
}

function isClaudeConfigReady(config?: ClaudeProviderConfig): boolean {
  return Boolean(config?.apiBase?.trim() && config?.models?.defaultModel);
}

function isCodexConfigReady(config?: CodexProviderConfig): boolean {
  return Boolean(config?.apiBase?.trim() && config?.model);
}

export function ClientConfig({ state, onChange, onActivate, onGoProviderManager }: Props) {
  const [activeTab, setActiveTab] = useState<ClientType>('claudeCode');
  const [editingProviderId, setEditingProviderId] = useState<string>('');
  const [draftClaudeConfig, setDraftClaudeConfig] = useState<ClaudeProviderConfig | null>(null);
  const [draftCodexConfig, setDraftCodexConfig] = useState<CodexProviderConfig | null>(null);

  const hasProvider = state.providers.length > 0;

  const activeProviderId =
    activeTab === 'claudeCode'
      ? state.clientConfig.claudeCode.activeProviderId
      : state.clientConfig.codex.activeProviderId;

  const models = useMemo(
    () => providerModels(state.providers, editingProviderId),
    [state.providers, editingProviderId]
  );

  const updateClaudeConfig = (
    providerId: string,
    updater: (cfg: ClaudeProviderConfig) => ClaudeProviderConfig
  ) => {
    const nextCfg = updater(
      state.clientConfig.claudeCode.providerConfigs[providerId] || emptyClaudeConfig()
    );

    onChange({
      ...state,
      clientConfig: {
        ...state.clientConfig,
        claudeCode: {
          ...state.clientConfig.claudeCode,
          providerConfigs: {
            ...state.clientConfig.claudeCode.providerConfigs,
            [providerId]: nextCfg
          }
        }
      }
    });
  };

  const updateCodexConfig = (
    providerId: string,
    updater: (cfg: CodexProviderConfig) => CodexProviderConfig
  ) => {
    const nextCfg = updater(
      state.clientConfig.codex.providerConfigs[providerId] || emptyCodexConfig()
    );

    onChange({
      ...state,
      clientConfig: {
        ...state.clientConfig,
        codex: {
          ...state.clientConfig.codex,
          providerConfigs: {
            ...state.clientConfig.codex.providerConfigs,
            [providerId]: nextCfg
          }
        }
      }
    });
  };

  const activateProvider = (providerId: string) => {
    if (activeTab === 'claudeCode') {
      onChange({
        ...state,
        clientConfig: {
          ...state.clientConfig,
          claudeCode: {
            ...state.clientConfig.claudeCode,
            activeProviderId: providerId
          }
        }
      });
      void onActivate('claudeCode', providerId);
      return;
    }

    onChange({
      ...state,
      clientConfig: {
        ...state.clientConfig,
        codex: {
          ...state.clientConfig.codex,
          activeProviderId: providerId
        }
      }
    });
    void onActivate('codex', providerId);
  };

  const closeEditor = () => {
    setEditingProviderId('');
    setDraftClaudeConfig(null);
    setDraftCodexConfig(null);
  };

  const openEditor = (providerId: string) => {
    if (activeTab === 'claudeCode') {
      setDraftClaudeConfig(
        cloneClaudeConfig(state.clientConfig.claudeCode.providerConfigs[providerId])
      );
      setDraftCodexConfig(null);
    } else {
      setDraftCodexConfig(
        cloneCodexConfig(state.clientConfig.codex.providerConfigs[providerId])
      );
      setDraftClaudeConfig(null);
    }
    setEditingProviderId(providerId);
  };

  const saveEditor = () => {
    if (!editingProviderId) return;

    if (activeTab === 'claudeCode') {
      if (!draftClaudeConfig) return;
      updateClaudeConfig(editingProviderId, () => ({
        ...draftClaudeConfig,
        apiBase: draftClaudeConfig.apiBase.trim()
      }));
      closeEditor();
      return;
    }

    if (!draftCodexConfig) return;
    updateCodexConfig(editingProviderId, () => ({
      ...draftCodexConfig,
      apiBase: draftCodexConfig.apiBase.trim()
    }));
    closeEditor();
  };

  const isDraftReady =
    activeTab === 'claudeCode'
      ? isClaudeConfigReady(draftClaudeConfig || undefined)
      : isCodexConfigReady(draftCodexConfig || undefined);

  const officialActive = activeProviderId === OFFICIAL_PROVIDER_ID;
  const officialLabel = activeTab === 'claudeCode' ? 'Claude Code 官方' : 'Codex 官方';

  return (
    <section className="panel">
      <header className="panel-head">
        <div className="tab-wrap">
          <button
            className={`btn ${activeTab === 'claudeCode' ? 'primary' : ''}`}
            onClick={() => {
              setActiveTab('claudeCode');
              closeEditor();
            }}
          >
            Claude Code
          </button>
          <button
            className={`btn ${activeTab === 'codex' ? 'primary' : ''}`}
            onClick={() => {
              setActiveTab('codex');
              closeEditor();
            }}
          >
            Codex
          </button>
        </div>
      </header>

      <div className="provider-config-list">
        <div className="provider-config-head provider-config-row">
          <span>服务商名称</span>
          <span>操作</span>
        </div>

        <div key="__official__" className="provider-config-row">
          <span>
            {officialLabel}
            {officialActive ? <em className="active-tag">已启用</em> : null}
          </span>
          <div className="provider-config-actions">
            <button
              className="btn success"
              onClick={() => activateProvider(OFFICIAL_PROVIDER_ID)}
              disabled={officialActive}
            >
              {officialActive ? '已启用' : '启用'}
            </button>
          </div>
        </div>

        {state.providers.map((provider) => {
          const isActive = provider.id === activeProviderId;
          const isReady =
            activeTab === 'claudeCode'
              ? isClaudeConfigReady(state.clientConfig.claudeCode.providerConfigs[provider.id])
              : isCodexConfigReady(state.clientConfig.codex.providerConfigs[provider.id]);

          return (
            <div key={provider.id} className="provider-config-row">
              <span>
                {provider.name || '未命名服务商'}
                {isActive ? <em className="active-tag">已启用</em> : null}
                {!isReady ? <em className="warn-tag">待配置</em> : null}
              </span>
              <div className="provider-config-actions">
                <button
                  className="btn"
                  onClick={() => openEditor(provider.id)}
                >
                  编辑
                </button>
                {isReady ? (
                  <button
                    className="btn success"
                    onClick={() => activateProvider(provider.id)}
                    disabled={isActive}
                  >
                    {isActive ? '已启用' : '启用'}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}

        {!hasProvider ? (
          <p className="muted provider-empty">
            想接入第三方服务？
            <button className="btn" onClick={onGoProviderManager}>前往服务商管理</button>
          </p>
        ) : null}
      </div>

      {editingProviderId ? (
        <div className="modal-mask" role="dialog" aria-modal="true">
          <div className="modal-card">
            <header className="panel-head">
              <h3>编辑配置：{state.providers.find((p) => p.id === editingProviderId)?.name || '未命名服务商'}</h3>
            </header>

            <div className="modal-content">
              {activeTab === 'claudeCode' && draftClaudeConfig ? (
                <div className="config-block">
                  <label>
                    API 地址
                    <input
                      value={draftClaudeConfig.apiBase}
                      onChange={(e) =>
                        setDraftClaudeConfig((cfg) => {
                          if (!cfg) return cfg;
                          return {
                            ...cfg,
                            apiBase: e.target.value
                          };
                        })
                      }
                      placeholder="https://api.example.com/v1"
                    />
                  </label>

                  <div className="grid-2">
                    {CLAUDE_FIELDS.map(([field, label]) => (
                      <label key={field}>
                        {label}
                        <select
                          value={draftClaudeConfig.models[field]}
                          onChange={(e) =>
                            setDraftClaudeConfig((cfg) => {
                              if (!cfg) return cfg;
                              return {
                                ...cfg,
                                models: {
                                  ...cfg.models,
                                  [field]: e.target.value
                                }
                              };
                            })
                          }
                        >
                          <option value="">请选择模型</option>
                          {models.map((model) => (
                            <option key={model} value={model}>
                              {model}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              {activeTab === 'codex' && draftCodexConfig ? (
                <div className="config-block">
                  <label>
                    API 地址
                    <input
                      value={draftCodexConfig.apiBase}
                      onChange={(e) =>
                        setDraftCodexConfig((cfg) => {
                          if (!cfg) return cfg;
                          return {
                            ...cfg,
                            apiBase: e.target.value
                          };
                        })
                      }
                      placeholder="https://api.example.com/v1"
                    />
                  </label>

                  <label>
                    模型
                    <select
                      value={draftCodexConfig.model}
                      onChange={(e) =>
                        setDraftCodexConfig((cfg) => {
                          if (!cfg) return cfg;
                          return {
                            ...cfg,
                            model: e.target.value
                          };
                        })
                      }
                    >
                      <option value="">请选择模型</option>
                      {models.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}
            </div>

            <footer className="modal-foot">
              <button className="btn" onClick={closeEditor}>取消</button>
              <button className="btn primary" onClick={saveEditor} disabled={!isDraftReady}>保存</button>
            </footer>
          </div>
        </div>
      ) : null}
    </section>
  );
}
