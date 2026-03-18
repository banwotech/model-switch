const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const os = require('os');

const APP_STATE_FILE = 'app-state.json';

/** @typedef {{id:string,name:string,apiKey:string,models:string[]}} Provider */
/** @typedef {{apiBase:string,models:{defaultModel:string,reasoningModel:string,haikuModel:string,sonnetModel:string,opusModel:string}}} ClaudeProviderConfig */
/** @typedef {{apiBase:string,model:string}} CodexProviderConfig */
/** @typedef {{activeProviderId:string,providerConfigs:Record<string, ClaudeProviderConfig>}} ClaudeConfig */
/** @typedef {{activeProviderId:string,providerConfigs:Record<string, CodexProviderConfig>}} CodexConfig */
/** @typedef {{providers:Provider[],clientConfig:{claudeCode:ClaudeConfig,codex:CodexConfig}}} AppState */

/** @returns {AppState} */
function defaultState() {
  return {
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
}

function emptyClaudeProviderConfig() {
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

function emptyCodexProviderConfig() {
  return {
    apiBase: '',
    model: ''
  };
}

function safeObject(value) {
  return value && typeof value === 'object' ? value : {};
}

function safeProviders(state) {
  return Array.isArray(state?.providers) ? state.providers : [];
}

/**
 * Ensure externally passed runtime state has a safe shape before use.
 * @param {any} maybeState
 * @returns {AppState}
 */
function normalizeState(maybeState) {
  const state = safeObject(maybeState);
  const defaults = defaultState();
  const providers = safeProviders(state);
  const providerIds = new Set(providers.map((provider) => provider?.id).filter(Boolean));

  const claudeProviderConfigs = {};
  Object.entries(state.clientConfig?.claudeCode?.providerConfigs || {}).forEach(([providerId, cfg]) => {
    if (!providerIds.has(providerId)) return;
    claudeProviderConfigs[providerId] = {
      ...emptyClaudeProviderConfig(),
      ...cfg,
      models: {
        ...emptyClaudeProviderConfig().models,
        ...(cfg?.models || {})
      }
    };
  });

  const codexProviderConfigs = {};
  Object.entries(state.clientConfig?.codex?.providerConfigs || {}).forEach(([providerId, cfg]) => {
    if (!providerIds.has(providerId)) return;
    codexProviderConfigs[providerId] = {
      ...emptyCodexProviderConfig(),
      ...cfg
    };
  });

  providers.forEach((provider) => {
    if (!provider?.id) return;
    if (!claudeProviderConfigs[provider.id]) claudeProviderConfigs[provider.id] = emptyClaudeProviderConfig();
    if (!codexProviderConfigs[provider.id]) codexProviderConfigs[provider.id] = emptyCodexProviderConfig();
  });

  return {
    ...defaults,
    ...state,
    providers,
    clientConfig: {
      claudeCode: {
        activeProviderId: providerIds.has(state.clientConfig?.claudeCode?.activeProviderId)
          ? state.clientConfig.claudeCode.activeProviderId
          : '',
        providerConfigs: claudeProviderConfigs
      },
      codex: {
        activeProviderId: providerIds.has(state.clientConfig?.codex?.activeProviderId)
          ? state.clientConfig.codex.activeProviderId
          : '',
        providerConfigs: codexProviderConfigs
      }
    }
  };
}

function getStatePath() {
  return path.join(app.getPath('userData'), APP_STATE_FILE);
}

async function readState() {
  const file = getStatePath();
  try {
    const raw = await fs.readFile(file, 'utf-8');
    return normalizeState(JSON.parse(raw));
  } catch {
    await writeState(defaultState());
    return defaultState();
  }
}

async function writeState(state) {
  const file = getStatePath();
  const nextState = normalizeState(state);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(nextState, null, 2), 'utf-8');
}

function escapeTomlString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function buildCodexToml(config) {
  return [
    `model = "${escapeTomlString(config.model)}"`,
    `model_provider = "switch"`,
    '',
    '[model_providers.switch]',
    `name = "${escapeTomlString(config.providerName)}"`,
    `base_url = "${escapeTomlString(config.apiBase)}"`,
    `wire_api = "responses"`,
    `requires_openai_auth = false`,
    '',
    '[model_providers.switch.http_headers]',
    `Authorization = "Bearer ${escapeTomlString(config.apiKey)}"`,
    ''
  ].join('\n');
}

async function writeClaudeConfig(state, providerId) {
  const provider = safeProviders(state).find((p) => p.id === providerId);
  if (!provider) throw new Error('Claude Code 未选择有效服务商');

  const providerConfig = state.clientConfig?.claudeCode?.providerConfigs?.[providerId];
  if (!providerConfig) throw new Error('Claude Code 配置不存在');

  const targetFile = path.join(os.homedir(), '.claude', 'settings.json');

  // Read existing settings to preserve permissions, hooks, etc.
  let existing = {};
  try {
    const raw = await fs.readFile(targetFile, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') existing = parsed;
  } catch {
    // File doesn't exist or isn't valid JSON
  }

  const env = { ...(existing.env || {}) };
  env.ANTHROPIC_BASE_URL = providerConfig.apiBase;

  const models = providerConfig.models || {};
  if (models.defaultModel) env.ANTHROPIC_MODEL = models.defaultModel;
  else delete env.ANTHROPIC_MODEL;

  if (models.reasoningModel) env.ANTHROPIC_REASONING_MODEL = models.reasoningModel;
  else delete env.ANTHROPIC_REASONING_MODEL;

  if (models.haikuModel) env.ANTHROPIC_DEFAULT_HAIKU_MODEL = models.haikuModel;
  else delete env.ANTHROPIC_DEFAULT_HAIKU_MODEL;

  if (models.sonnetModel) env.ANTHROPIC_DEFAULT_SONNET_MODEL = models.sonnetModel;
  else delete env.ANTHROPIC_DEFAULT_SONNET_MODEL;

  if (models.opusModel) env.ANTHROPIC_DEFAULT_OPUS_MODEL = models.opusModel;
  else delete env.ANTHROPIC_DEFAULT_OPUS_MODEL;

  const output = { ...existing, env };

  await fs.mkdir(path.dirname(targetFile), { recursive: true });
  await fs.writeFile(targetFile, JSON.stringify(output, null, 2), 'utf-8');
  return targetFile;
}

async function writeCodexConfig(state, providerId) {
  const provider = safeProviders(state).find((p) => p.id === providerId);
  if (!provider) throw new Error('Codex 未选择有效服务商');

  const providerConfig = state.clientConfig?.codex?.providerConfigs?.[providerId];
  if (!providerConfig) throw new Error('Codex 配置不存在');

  const config = {
    providerName: provider.name,
    apiKey: provider.apiKey,
    apiBase: providerConfig.apiBase,
    model: providerConfig.model
  };

  const targetFile = path.join(os.homedir(), '.codex', 'config.toml');

  await fs.mkdir(path.dirname(targetFile), { recursive: true });
  await fs.writeFile(targetFile, buildCodexToml(config), 'utf-8');
  return targetFile;
}

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1220,
    height: 840,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const startUrl = process.env.ELECTRON_START_URL;
  if (startUrl) {
    win.loadURL(startUrl);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle('state:read', async () => {
    return readState();
  });

  ipcMain.handle('state:save', async (_, nextState) => {
    await writeState(nextState);
    const state = normalizeState(nextState);

    // Update local config if client is active
    const claudeActiveId = state.clientConfig?.claudeCode?.activeProviderId;
    if (claudeActiveId) {
      try {
        await writeClaudeConfig(state, claudeActiveId);
      } catch {}
    }

    const codexActiveId = state.clientConfig?.codex?.activeProviderId;
    if (codexActiveId) {
      try {
        await writeCodexConfig(state, codexActiveId);
      } catch {}
    }

    return nextState;
  });

  ipcMain.handle('config:activate', async (_, client, providerId, runtimeState) => {
    const state = normalizeState(runtimeState || (await readState()));
    if (!providerId) throw new Error('未指定服务商');

    if (client === 'claudeCode') {
      const target = await writeClaudeConfig(state, providerId);
      return { success: true, target };
    }
    if (client === 'codex') {
      const target = await writeCodexConfig(state, providerId);
      return { success: true, target };
    }
    throw new Error('未知客户端');
  });

  ipcMain.handle('dialog:showError', async (_, payload) => {
    await dialog.showMessageBox({
      type: 'error',
      title: payload?.title || '错误',
      message: payload?.message || '发生未知错误'
    });
    return true;
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
