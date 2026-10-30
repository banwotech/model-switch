import { useMemo, useState } from 'react';
import type {
  GeminiCliProviderConfig,
  AppState,
  ClientType,
  ClaudeProviderConfig,
  CodexProviderConfig,
  OpencodeProviderConfig,
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

interface SimpleClientMeta {
  client: Exclude<ClientType, 'claudeCode'>;
  label: string;
  officialLabel: string;
}

const SIMPLE_CLIENT_META: Record<Exclude<ClientType, 'claudeCode'>, SimpleClientMeta> = {
  codex: { client: 'codex', label: 'Codex', officialLabel: 'Codex 官方' },
  geminiCli: { client: 'geminiCli', label: 'Gemini CLI', officialLabel: 'Gemini CLI 官方' },
  opencode: { client: 'opencode', label: 'OpenCode', officialLabel: 'OpenCode 官方' }
};

const TAB_ORDER: ClientType[] = ['claudeCode', 'codex', 'geminiCli', 'opencode'];
const TAB_LABEL: Record<ClientType, string> = {
  claudeCode: 'Claude Code',
  codex: 'Codex',
  geminiCli: 'Gemini CLI',
  opencode: 'OpenCode'
};

// Brand icons sourced from @lobehub/icons-static-svg, all single-color paths
// rendered with currentColor so they pick up the active/inactive tab text color.
function ClaudeCodeIcon() {
  return (
    <svg className="tab-icon" viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" aria-hidden="true">
      <path d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z" />
    </svg>
  );
}

function CodexIcon() {
  return (
    <svg className="tab-icon" viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" aria-hidden="true">
      <path clipRule="evenodd" d="M8.086.457a6.105 6.105 0 013.046-.415c1.333.153 2.521.72 3.564 1.7a.117.117 0 00.107.029c1.408-.346 2.762-.224 4.061.366l.063.03.154.076c1.357.703 2.33 1.77 2.918 3.198.278.679.418 1.388.421 2.126a5.655 5.655 0 01-.18 1.631.167.167 0 00.04.155 5.982 5.982 0 011.578 2.891c.385 1.901-.01 3.615-1.183 5.14l-.182.22a6.063 6.063 0 01-2.934 1.851.162.162 0 00-.108.102c-.255.736-.511 1.364-.987 1.992-1.199 1.582-2.962 2.462-4.948 2.451-1.583-.008-2.986-.587-4.21-1.736a.145.145 0 00-.14-.032c-.518.167-1.04.191-1.604.185a5.924 5.924 0 01-2.595-.622 6.058 6.058 0 01-2.146-1.781c-.203-.269-.404-.522-.551-.821a7.74 7.74 0 01-.495-1.283 6.11 6.11 0 01-.017-3.064.166.166 0 00.008-.074.115.115 0 00-.037-.064 5.958 5.958 0 01-1.38-2.202 5.196 5.196 0 01-.333-1.589 6.915 6.915 0 01.188-2.132c.45-1.484 1.309-2.648 2.577-3.493.282-.188.55-.334.802-.438.286-.12.573-.22.861-.304a.129.129 0 00.087-.087A6.016 6.016 0 015.635 2.31C6.315 1.464 7.132.846 8.086.457zm-.804 7.85a.848.848 0 00-1.473.842l1.694 2.965-1.688 2.848a.849.849 0 001.46.864l1.94-3.272a.849.849 0 00.007-.854l-1.94-3.393zm5.446 6.24a.849.849 0 000 1.695h4.848a.849.849 0 000-1.696h-4.848z" />
    </svg>
  );
}

function GeminiCliIcon() {
  return (
    <svg className="tab-icon" viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" aria-hidden="true">
      <path d="M12 0L7.74 8.26 0 12l7.74 3.74L12 24l4.26-8.26L24 12l-7.74-3.74z" />
    </svg>
  );
}

function OpencodeIcon() {
  return (
    <svg className="tab-icon" viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" aria-hidden="true">
      <path d="M16 6H8v12h8V6zm4 16H4V2h16v20z" />
    </svg>
  );
}

const TAB_ICON: Record<ClientType, () => JSX.Element> = {
  claudeCode: ClaudeCodeIcon,
  codex: CodexIcon,
  geminiCli: GeminiCliIcon,
  opencode: OpencodeIcon
};

type SimpleProviderConfig = CodexProviderConfig | GeminiCliProviderConfig | OpencodeProviderConfig;

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

function emptySimpleConfig(): SimpleProviderConfig {
  return { apiBase: '', model: '' };
}

function cloneClaudeConfig(config?: ClaudeProviderConfig): ClaudeProviderConfig {
  const source = config || emptyClaudeConfig();
  return {
    ...source,
    models: { ...source.models }
  };
}

function cloneSimpleConfig(config?: SimpleProviderConfig): SimpleProviderConfig {
  const source = config || emptySimpleConfig();
  return { ...source };
}

function isClaudeConfigReady(config?: ClaudeProviderConfig): boolean {
  return Boolean(config?.apiBase?.trim() && config?.models?.defaultModel);
}

function isSimpleConfigReady(config?: SimpleProviderConfig): boolean {
  return Boolean(config?.apiBase?.trim() && config?.model);
}

function getActiveProviderId(state: AppState, client: ClientType): string {
  return state.clientConfig[client].activeProviderId;
}

function getSimpleClientConfig(state: AppState, client: Exclude<ClientType, 'claudeCode'>) {
  return state.clientConfig[client] as {
    activeProviderId: string;
    providerConfigs: Record<string, SimpleProviderConfig>;
  };
}

function getSimpleProviderConfig(
  state: AppState,
  client: Exclude<ClientType, 'claudeCode'>,
  providerId: string
): SimpleProviderConfig | undefined {
  return getSimpleClientConfig(state, client).providerConfigs[providerId];
}

export function ClientConfig({ state, onChange, onActivate, onGoProviderManager }: Props) {
  const [activeTab, setActiveTab] = useState<ClientType>('claudeCode');
  const [editingProviderId, setEditingProviderId] = useState<string>('');
  const [draftClaudeConfig, setDraftClaudeConfig] = useState<ClaudeProviderConfig | null>(null);
  const [draftSimpleConfig, setDraftSimpleConfig] = useState<SimpleProviderConfig | null>(null);

  const hasProvider = state.providers.length > 0;

  const activeProviderId = getActiveProviderId(state, activeTab);

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

  const updateSimpleConfig = (
    client: Exclude<ClientType, 'claudeCode'>,
    providerId: string,
    updater: (cfg: SimpleProviderConfig) => SimpleProviderConfig
  ) => {
    const current = getSimpleProviderConfig(state, client, providerId) || emptySimpleConfig();
    const nextCfg = updater(current);
    const clientCfg = getSimpleClientConfig(state, client);
    onChange({
      ...state,
      clientConfig: {
        ...state.clientConfig,
        [client]: {
          ...clientCfg,
          providerConfigs: {
            ...clientCfg.providerConfigs,
            [providerId]: nextCfg
          }
        }
      }
    } as AppState);
  };

  const activateProvider = (providerId: string) => {
    const clientCfg = state.clientConfig[activeTab];
    onChange({
      ...state,
      clientConfig: {
        ...state.clientConfig,
        [activeTab]: { ...clientCfg, activeProviderId: providerId }
      }
    } as AppState);
    void onActivate(activeTab, providerId);
  };

  const closeEditor = () => {
    setEditingProviderId('');
    setDraftClaudeConfig(null);
    setDraftSimpleConfig(null);
  };

  const openEditor = (providerId: string) => {
    if (activeTab === 'claudeCode') {
      setDraftClaudeConfig(
        cloneClaudeConfig(state.clientConfig.claudeCode.providerConfigs[providerId])
      );
      setDraftSimpleConfig(null);
    } else {
      setDraftSimpleConfig(
        cloneSimpleConfig(getSimpleProviderConfig(state, activeTab, providerId))
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

    if (!draftSimpleConfig) return;
    updateSimpleConfig(activeTab, editingProviderId, () => ({
      ...draftSimpleConfig,
      apiBase: draftSimpleConfig.apiBase.trim()
    }));
    closeEditor();
  };

  const isDraftReady =
    activeTab === 'claudeCode'
      ? isClaudeConfigReady(draftClaudeConfig || undefined)
      : isSimpleConfigReady(draftSimpleConfig || undefined);

  const officialActive = activeProviderId === OFFICIAL_PROVIDER_ID;
  const officialLabel =
    activeTab === 'claudeCode' ? 'Claude Code 官方' : SIMPLE_CLIENT_META[activeTab].officialLabel;

  return (
    <>
      <header className="panel-head">
        <div className="tab-wrap">
          {TAB_ORDER.map((tab) => {
            const Icon = TAB_ICON[tab];
            return (
              <button
                key={tab}
                className={`btn tab-btn ${activeTab === tab ? 'primary' : ''}`}
                onClick={() => {
                  setActiveTab(tab);
                  closeEditor();
                }}
              >
                <Icon />
                {TAB_LABEL[tab]}
              </button>
            );
          })}
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
              : isSimpleConfigReady(getSimpleProviderConfig(state, activeTab, provider.id));

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

              {activeTab !== 'claudeCode' && draftSimpleConfig ? (
                <div className="config-block">
                  <label>
                    API 地址
                    <input
                      value={draftSimpleConfig.apiBase}
                      onChange={(e) =>
                        setDraftSimpleConfig((cfg) => {
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
                      value={draftSimpleConfig.model}
                      onChange={(e) =>
                        setDraftSimpleConfig((cfg) => {
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
    </>
  );
}
