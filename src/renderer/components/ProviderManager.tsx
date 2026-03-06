import { useState } from 'react';
import type { Provider } from '../types';

interface Props {
  providers: Provider[];
  onChange: (providers: Provider[]) => void;
}

function createProvider(): Provider {
  return {
    id: crypto.randomUUID(),
    name: '',
    apiKey: '',
    models: ['']
  };
}

type DialogMode = 'create' | 'edit' | '';

function cloneProvider(provider: Provider): Provider {
  return {
    ...provider,
    models: [...provider.models]
  };
}

export function ProviderManager({ providers, onChange }: Props) {
  const [dialogMode, setDialogMode] = useState<DialogMode>('');
  const [draftProvider, setDraftProvider] = useState<Provider | null>(null);

  const closeDialog = () => {
    setDialogMode('');
    setDraftProvider(null);
  };

  const addProvider = () => {
    setDialogMode('create');
    setDraftProvider(createProvider());
  };

  const editProvider = (provider: Provider) => {
    setDialogMode('edit');
    setDraftProvider(cloneProvider(provider));
  };

  const deleteProvider = (provider: Provider) => {
    const providerName = provider.name.trim() || "未命名服务商";
    const confirmed = window.confirm(`确认删除服务商「」吗？`);
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

  const saveProvider = () => {
    if (!draftProvider) return;

    const cleanedModels = draftProvider.models
      .map((model) => model.trim())
      .filter(Boolean);

    if (hasEmptyModel) {
      return;
    }

    const nextProvider = {
      ...draftProvider,
      name: draftProvider.name.trim(),
      apiKey: draftProvider.apiKey.trim(),
      models: cleanedModels.length > 0 ? cleanedModels : ['']
    };

    if (dialogMode === 'create') {
      onChange([...providers, nextProvider]);
    } else {
      onChange(providers.map((provider) => (provider.id === nextProvider.id ? nextProvider : provider)));
    }

    closeDialog();
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
  const disableSave = !draftProvider || hasEmptyModel;

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
              <div className="provider-form-stack">
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
