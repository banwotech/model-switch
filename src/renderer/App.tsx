import { useEffect, useMemo, useState } from 'react';
import { ProviderManager } from './components/ProviderManager';
import { ClientConfig } from './components/ClientConfig';
import type { AppState, ClientType } from './types';
import { ensureValidClientConfig } from './utils/state';

type MainMenu = 'clientConfig' | 'providerManager';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface IconProps {
  className?: string;
}

function ClientConfigIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 9h10M7 15h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ProviderManagerIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 20V8l8-4 8 4v12" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 20v-5h6v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 4v16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.45" />
    </svg>
  );
}

const EMPTY_STATE: AppState = {
  providers: [],
  clientConfig: {
    claudeCode: {
      activeProviderId: '',
      providerConfigs: {}
    },
    codex: {
      activeProviderId: '',
      providerConfigs: {}
    }
  }
};

const MENU_META: Record<MainMenu, { title: string }> = {
  clientConfig: {
    title: '客户端配置'
  },
  providerManager: {
    title: '服务商管理'
  }
};

export function App() {
  const [state, setState] = useState<AppState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [mainMenu, setMainMenu] = useState<MainMenu>('clientConfig');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  useEffect(() => {
    window.switchAPI
      .readState()
      .then((result) => {
        setState(ensureValidClientConfig(result));
      })
      .catch(async (error) => {
        await window.switchAPI.showError({
          title: '加载失败',
          message: String(error)
        });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading) return;

    setSaveStatus('saving');
    const id = setTimeout(async () => {
      try {
        await window.switchAPI.saveState(state);
        setSaveStatus('saved');
      } catch {
        setSaveStatus('error');
      }
    }, 180);

    return () => clearTimeout(id);
  }, [state, loading]);

  const handleStateChange = (nextState: AppState) => {
    const cleanedProviders = nextState.providers.map((provider) => ({
      ...provider,
      models: provider.models.map((m) => m.trim())
    }));

    setState(
      ensureValidClientConfig({
        ...nextState,
        providers: cleanedProviders
      })
    );
  };

  const handleProviderChange = (providers: AppState['providers']) => {
    handleStateChange({ ...state, providers });
  };

  const validateBeforeActivate = (client: ClientType, providerId: string): string | null => {
    const provider = state.providers.find((p) => p.id === providerId);
    if (!provider) return '服务商不存在';

    if (client === 'claudeCode') {
      const cfg = state.clientConfig.claudeCode.providerConfigs[providerId];
      if (!cfg?.apiBase?.trim()) return 'Claude Code 的 API 地址不能为空';
      if (!cfg.models.defaultModel) return 'Claude Code 的默认模型不能为空';
      return null;
    }

    const cfg = state.clientConfig.codex.providerConfigs[providerId];
    if (!cfg?.apiBase?.trim()) return 'Codex 的 API 地址不能为空';
    if (!cfg.model) return 'Codex 模型不能为空';
    return null;
  };

  const handleActivate = async (client: ClientType, providerId: string) => {
    const error = validateBeforeActivate(client, providerId);
    if (error) {
      await window.switchAPI.showError({ title: '参数不完整', message: error });
      return;
    }

    try {
      const result = await window.switchAPI.activateConfig(client, providerId, state);
      const label = client === 'claudeCode' ? 'Claude Code' : 'Codex';
      const providerName = state.providers.find((p) => p.id === providerId)?.name || '未命名服务商';
      setNotice(`${label} 已启用服务商 ${providerName}，配置写入：${result.target}`);
      setTimeout(() => setNotice(''), 4200);
    } catch (activateError) {
      await window.switchAPI.showError({
        title: '启用失败',
        message: String(activateError)
      });
    }
  };

  const titleIcon = mainMenu === 'clientConfig'
    ? <ClientConfigIcon className="page-title-icon" />
    : <ProviderManagerIcon className="page-title-icon" />;

  if (loading) {
    return (
      <main className="loading-view">
        <p>加载中...</p>
      </main>
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <h1>Model Switch</h1>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${mainMenu === 'clientConfig' ? 'active' : ''}`}
            onClick={() => setMainMenu('clientConfig')}
          >
            <span className="nav-title">
              <ClientConfigIcon className="nav-icon" />
              客户端配置
            </span>
          </button>

          <button
            className={`nav-item ${mainMenu === 'providerManager' ? 'active' : ''}`}
            onClick={() => setMainMenu('providerManager')}
          >
            <span className="nav-title">
              <ProviderManagerIcon className="nav-icon" />
              服务商管理
            </span>
          </button>
        </nav>
      </aside>

      <main className="main-area">
        <header className="main-header">
          <div>
            <h2 className="page-title">
              {titleIcon}
              {MENU_META[mainMenu].title}
            </h2>
          </div>
          {notice ? <p className="notice">{notice}</p> : null}
        </header>

        <section className="canvas">
          <div className="content-wrap">
            {mainMenu === 'clientConfig' ? (
              <ClientConfig
                state={state}
                onChange={handleStateChange}
                onActivate={handleActivate}
                onGoProviderManager={() => setMainMenu('providerManager')}
              />
            ) : (
              <ProviderManager providers={state.providers} onChange={handleProviderChange} />
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
