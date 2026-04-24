import { useState } from 'react';
import type { Preset, Provider } from '../types';
import presetsData from '../data/presets.json';

const PRESETS: Preset[] = presetsData as Preset[];

interface Props {
  providers: Provider[];
  onChange: (providers: Provider[]) => void;
  onAddFromPreset: (provider: Provider, preset: Preset) => void;
}

type DialogMode = 'create' | 'edit' | '';
type CreateTab = 'preset' | 'custom';

function createProvider(): Provider {
  return {
    id: crypto.randomUUID(),
    name: '',
    apiKey: '',
    models: ['']
  };
}

function cloneProvider(provider: Provider): Provider {
  return {
    ...provider,
    models: [...provider.models]
  };
}

export function ProviderManager({ providers, onChange, onAddFromPreset }: Props) {
  const [dialogMode, setDialogMode] = useState<DialogMode>('');
  const [draftProvider, setDraftProvider] = useState<Provider | null>(null);
  const [createTab, setCreateTab] = useState<CreateTab>('preset');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');

  const closeDialog = () => {
    setDialogMode('');
    setDraftProvider(null);
    setCreateTab('preset');
    setSelectedPresetId('');
  };

  const addProvider = () => {
    setDialogMode('create');
    setDraftProvider(createProvider());
    setCreateTab('preset');
    setSelectedPresetId('');
  };

  const editProvider = (provider: Provider) => {
    setDialogMode('edit');
    setDraftProvider(cloneProvider(provider));
  };

  const deleteProvider = (provider: Provider) => {
    const providerName = provider.name.trim() || '未命名服务商';
    const confirmed = window.confirm(`确认删除服务商「${providerName}」吗？`);
    if (!confirmed) return;

    onChange(providers.filter((p) => p.id !== provider.id));
  };

  const addModelRow = () => {
    if (!draftProvider) return;
    setDraftProvider({
      ...draftProvider,
      models: [...draftProvider.models, '']
    });
  };

  const updateDraft = (updater: (provider: Provider) => Provider) => {
    if (!draftProvider) return;
    setDraftProvider(updater(draftProvider));
  };

  const selectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset || !draftProvider) return;
    setDraftProvider({ ...draftProvider, name: preset.name });
  };

  const switchCreateTab = (tab: CreateTab) => {
    if (tab === createTab) return;
    setCreateTab(tab);
    setSelectedPresetId('');
    // Don't let name/apiKey leak between tabs — a preset's prefilled name or
    // a key typed for one provider shouldn't carry into the other flow.
    if (draftProvider) {
      setDraftProvider({ ...draftProvider, name: '', apiKey: '' });
    }
  };

  const updateModel = (index: number, value: string) => {
    updateDraft((provider) => {
      const next = [...provider.models];
      next[index] = value;
      return { ...provider, models: next };
    });
  };

  const deleteModel = (index: number) => {
    updateDraft((provider) => {
      const next = [...provider.models];
      next.splice(index, 1);
      return { ...provider, models: next.length > 0 ? next : [''] };
    });
  };

  const hasEmptyModel = draftProvider ? draftProvider.models.some((model) => !model.trim()) : false;
  const isPresetCreate = dialogMode === 'create' && createTab === 'preset';
  const selectedPreset = isPresetCreate
    ? PRESETS.find((p) => p.id === selectedPresetId)
    : undefined;
  const disableSave =
    !draftProvider || hasEmptyModel || (isPresetCreate && !selectedPreset);

  const saveProvider = () => {
    if (!draftProvider) return;
    if (hasEmptyModel) return;

    const cleanedModels = draftProvider.models
      .map((model) => model.trim())
      .filter(Boolean);

    const nextProvider: Provider = {
      ...draftProvider,
      name: draftProvider.name.trim(),
      apiKey: draftProvider.apiKey.trim(),
      models: cleanedModels.length > 0 ? cleanedModels : ['']
    };

    if (dialogMode === 'create') {
      if (createTab === 'preset' && selectedPreset) {
        onAddFromPreset(nextProvider, selectedPreset);
      } else {
        onChange([...providers, nextProvider]);
      }
    } else {
      onChange(providers.map((p) => (p.id === nextProvider.id ? nextProvider : p)));
    }

    closeDialog();
  };

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>服务商列表</h2>
        <button className="btn primary" onClick={addProvider}>添加服务商</button>
      </header>

      <div className="provider-table">
        <div className="provider-table-row provider-table-head">
          <span>服务商名称</span>
          <span>模型数</span>
          <span>操作</span>
        </div>

        {providers.length === 0 ? (
          <p className="muted provider-empty">暂无服务商</p>
        ) : (
          providers.map((provider) => (
            <div key={provider.id} className="provider-table-row">
              <span>{provider.name || '未命名服务商'}</span>
              <span>{provider.models.filter(Boolean).length}</span>
              <div className="provider-actions">
                <button className="btn" onClick={() => editProvider(provider)}>编辑</button>
                <button className="btn danger" onClick={() => deleteProvider(provider)}>删除</button>
              </div>
            </div>
          ))
        )}
      </div>

      {dialogMode && draftProvider ? (
        <div className="modal-mask" role="dialog" aria-modal="true">
          <div className="modal-card">
            <header className="panel-head">
              <h3>{dialogMode === 'create' ? '添加服务商' : '编辑服务商'}</h3>
            </header>

            <div className="modal-content">
              {dialogMode === 'create' ? (
                <div className="tab-wrap">
                  <button
                    className={`btn ${createTab === 'preset' ? 'primary' : ''}`}
                    onClick={() => switchCreateTab('preset')}
                  >
                    预设服务商
                  </button>
                  <button
                    className={`btn ${createTab === 'custom' ? 'primary' : ''}`}
                    onClick={() => switchCreateTab('custom')}
                  >
                    自定义
                  </button>
                </div>
              ) : null}

              <div className="provider-form-stack">
                {isPresetCreate ? (
                  <label>
                    预设
                    <select
                      value={selectedPresetId}
                      onChange={(e) => selectPreset(e.target.value)}
                    >
                      <option value="">请选择预设服务商</option>
                      {PRESETS.map((preset) => (
                        <option key={preset.id} value={preset.id}>{preset.name}</option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <label>
                  服务商名称
                  <input
                    value={draftProvider.name}
                    onChange={(e) => updateDraft((provider) => ({ ...provider, name: e.target.value }))}
                    placeholder="例如：OpenRouter"
                  />
                </label>
                <label>
                  API Key
                  <input
                    value={draftProvider.apiKey}
                    onChange={(e) => updateDraft((provider) => ({ ...provider, apiKey: e.target.value }))}
                    placeholder="sk-..."
                  />
                </label>

                {selectedPreset ? (
                  <div className="preset-endpoints muted">
                    端点预览（选预设后会自动写入对应 tab 的 API 地址）：
                    <ul>
                      <li>
                        Codex (OpenAI)：
                        {selectedPreset.codexBase ? <code>{selectedPreset.codexBase}</code> : '—'}
                      </li>
                      <li>
                        Claude Code (Anthropic)：
                        {selectedPreset.claudeBase ? <code>{selectedPreset.claudeBase}</code> : '—'}
                      </li>
                    </ul>
                  </div>
                ) : null}
              </div>

              <div className="model-header">
                <h3>模型管理</h3>
                <button className="btn" onClick={addModelRow}>添加模型</button>
              </div>

              <div className="model-table">
                {draftProvider.models.map((model, idx) => (
                  <div key={`${draftProvider.id}-${idx}`} className="model-row">
                    <input
                      value={model}
                      onChange={(e) => updateModel(idx, e.target.value)}
                      placeholder="填写模型 ID"
                    />
                    <button className="btn danger" onClick={() => deleteModel(idx)}>
                      删除
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <footer className="modal-foot">
              <button className="btn" onClick={closeDialog}>取消</button>
              <button className="btn primary" onClick={saveProvider} disabled={disableSave}>保存</button>
            </footer>
          </div>
        </div>
      ) : null}
    </section>
  );
}
