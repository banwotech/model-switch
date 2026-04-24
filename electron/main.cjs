const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const os = require('os');

const APP_STATE_FILE = 'app-state.json';
// Keep in sync with OFFICIAL_PROVIDER_ID in src/renderer/types/index.ts
const OFFICIAL_PROVIDER_ID = '__official__';

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

  const isValidActive = (id) => id === OFFICIAL_PROVIDER_ID || providerIds.has(id);

  return {
    ...defaults,
    ...state,
    providers,
    clientConfig: {
      claudeCode: {
        activeProviderId: isValidActive(state.clientConfig?.claudeCode?.activeProviderId)
          ? state.clientConfig.claudeCode.activeProviderId
          : '',
        providerConfigs: claudeProviderConfigs
      },
      codex: {
        activeProviderId: isValidActive(state.clientConfig?.codex?.activeProviderId)
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
  let raw;
  try {
    raw = await fs.readFile(file, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      await writeState(defaultState());
      return defaultState();
    }
    throw err;
  }
  // Parsing errors propagate so the user is warned instead of losing data.
  return normalizeState(JSON.parse(raw));
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

function buildCodexSwitchSection(config) {
  return [
    '[model_providers.switch]',
    `name = "${escapeTomlString(config.providerName)}"`,
    `base_url = "${escapeTomlString(config.apiBase)}"`,
    `wire_api = "responses"`,
    `requires_openai_auth = false`,
    '',
    '[model_providers.switch.http_headers]',
    `Authorization = "Bearer ${escapeTomlString(config.apiKey)}"`
  ].join('\n');
}

// Strip switch-owned keys/sections, returning preserved user content
// (profiles, other model_providers, mcp_servers, ...) as a ready-to-serialize
// { topLines, sections } pair.
function stripCodexSwitchParts(existingToml) {
  const OWNED_TOP_KEYS = new Set(['model', 'model_provider']);
  const isOwnedSection = (name) =>
    name === 'model_providers.switch' || name.startsWith('model_providers.switch.');

  const lines = (existingToml || '').split('\n');
  const topLines = [];
  const sections = [];
  let current = null;

  for (const line of lines) {
    // Match single-bracket table headers only; leave [[array-of-tables]] alone.
    const headerMatch = line.match(/^\s*\[([^\[\]]+)\]\s*$/);
    if (headerMatch) {
      if (current) sections.push(current);
      current = { name: headerMatch[1].trim(), header: line, body: [] };
      continue;
    }
    if (current) current.body.push(line);
    else topLines.push(line);
  }
  if (current) sections.push(current);

  const filteredTop = topLines.filter((line) => {
    const keyMatch = line.match(/^\s*([A-Za-z0-9_-]+)\s*=/);
    return !(keyMatch && OWNED_TOP_KEYS.has(keyMatch[1]));
  });
  const filteredSections = sections.filter((s) => !isOwnedSection(s.name));
  return { topLines: filteredTop, sections: filteredSections };
}

function serializeCodexParts(parts, leading) {
  const out = [];
  if (leading) out.push(leading);

  const preservedTop = parts.topLines.join('\n').replace(/^\n+/, '').replace(/\n+$/, '');
  if (preservedTop) {
    if (out.length) out.push('');
    out.push(preservedTop);
  }

  for (const s of parts.sections) {
    if (out.length) out.push('');
    out.push(s.header);
    const body = s.body.join('\n').replace(/\n+$/, '');
    if (body) out.push(body);
  }

  return out.length ? out.join('\n') + '\n' : '';
}

// Merge switch-owned keys/sections into existing TOML while preserving
// user-authored content.
function mergeCodexToml(existingToml, config) {
  const parts = stripCodexSwitchParts(existingToml);
  const leading = [
    `model = "${escapeTomlString(config.model)}"`,
    `model_provider = "switch"`
  ].join('\n');
  const preserved = serializeCodexParts(parts, leading);
  return preserved.replace(/\n$/, '') + '\n\n' + buildCodexSwitchSection(config) + '\n';
}

// Remove only switch-owned keys/sections, keeping everything else the user
// has in their config.toml.
function stripCodexSwitchToml(existingToml) {
  const parts = stripCodexSwitchParts(existingToml);
  return serializeCodexParts(parts, '');
}

async function writeClaudeConfig(state, providerId) {
  const provider = safeProviders(state).find((p) => p.id === providerId);
  if (!provider) throw new Error('Claude Code 未选择有效服务商');

  const providerConfig = state.clientConfig?.claudeCode?.providerConfigs?.[providerId];
  if (!providerConfig) throw new Error('Claude Code 配置不存在');

  const targetFile = path.join(os.homedir(), '.claude', 'settings.json');

  // Read existing settings to preserve permissions, hooks, etc.
  // ENOENT → start fresh; parse errors propagate so we don't silently
  // overwrite a user's settings file that happens to have a typo.
  let existing = {};
  let raw;
  try {
    raw = await fs.readFile(targetFile, 'utf-8');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  if (raw !== undefined) {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') existing = parsed;
  }

  const env = { ...(existing.env || {}) };
  if (providerConfig.apiBase) env.ANTHROPIC_BASE_URL = providerConfig.apiBase;
  else delete env.ANTHROPIC_BASE_URL;

  if (provider.apiKey) env.ANTHROPIC_AUTH_TOKEN = provider.apiKey;
  else delete env.ANTHROPIC_AUTH_TOKEN;

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

  let existingToml = '';
  try {
    existingToml = await fs.readFile(targetFile, 'utf-8');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  await fs.mkdir(path.dirname(targetFile), { recursive: true });
  await fs.writeFile(targetFile, mergeCodexToml(existingToml, config), 'utf-8');
  return targetFile;
}

const CLAUDE_ENV_KEYS = [
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_MODEL',
  'ANTHROPIC_REASONING_MODEL',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  'ANTHROPIC_DEFAULT_SONNET_MODEL',
  'ANTHROPIC_DEFAULT_OPUS_MODEL'
];

// Remove switch-managed env keys from ~/.claude/settings.json without touching
// anything else (permissions, hooks, other env vars, etc.).
async function clearClaudeConfig() {
  const targetFile = path.join(os.homedir(), '.claude', 'settings.json');
  let raw;
  try {
    raw = await fs.readFile(targetFile, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') return targetFile;
    throw err;
  }
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') return targetFile;

  const env = { ...(parsed.env || {}) };
  for (const key of CLAUDE_ENV_KEYS) delete env[key];

  const output = { ...parsed, env };
  await fs.writeFile(targetFile, JSON.stringify(output, null, 2), 'utf-8');
  return targetFile;
}

// Remove the [model_providers.switch*] sections and owned top-level keys from
// ~/.codex/config.toml.
async function clearCodexConfig() {
  const targetFile = path.join(os.homedir(), '.codex', 'config.toml');
  let existingToml;
  try {
    existingToml = await fs.readFile(targetFile, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') return targetFile;
    throw err;
  }
  await fs.writeFile(targetFile, stripCodexSwitchToml(existingToml), 'utf-8');
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
    // Read the previously-persisted state before overwriting so we can detect
    // "active provider cleared" transitions and clean the client config.
    let prevState;
    try {
      prevState = await readState();
    } catch {
      prevState = defaultState();
    }

    await writeState(nextState);
    const state = normalizeState(nextState);

    const prevClaudeActiveId = prevState.clientConfig?.claudeCode?.activeProviderId || '';
    const claudeActiveId = state.clientConfig?.claudeCode?.activeProviderId || '';
    if (claudeActiveId === OFFICIAL_PROVIDER_ID) {
      try {
        await clearClaudeConfig();
      } catch (error) {
        console.error('[state:save] clearClaudeConfig failed:', error);
      }
    } else if (claudeActiveId) {
      try {
        await writeClaudeConfig(state, claudeActiveId);
      } catch (error) {
        console.error('[state:save] writeClaudeConfig failed:', error);
      }
    } else if (prevClaudeActiveId) {
      try {
        await clearClaudeConfig();
      } catch (error) {
        console.error('[state:save] clearClaudeConfig failed:', error);
      }
    }

    const prevCodexActiveId = prevState.clientConfig?.codex?.activeProviderId || '';
    const codexActiveId = state.clientConfig?.codex?.activeProviderId || '';
    if (codexActiveId === OFFICIAL_PROVIDER_ID) {
      try {
        await clearCodexConfig();
      } catch (error) {
        console.error('[state:save] clearCodexConfig failed:', error);
      }
    } else if (codexActiveId) {
      try {
        await writeCodexConfig(state, codexActiveId);
      } catch (error) {
        console.error('[state:save] writeCodexConfig failed:', error);
      }
    } else if (prevCodexActiveId) {
      try {
        await clearCodexConfig();
      } catch (error) {
        console.error('[state:save] clearCodexConfig failed:', error);
      }
    }

    return nextState;
  });

  ipcMain.handle('config:activate', async (_, client, providerId, runtimeState) => {
    const state = normalizeState(runtimeState || (await readState()));
    if (!providerId) throw new Error('未指定服务商');

    if (client === 'claudeCode') {
      const target = providerId === OFFICIAL_PROVIDER_ID
        ? await clearClaudeConfig()
        : await writeClaudeConfig(state, providerId);
      return { success: true, target };
    }
    if (client === 'codex') {
      const target = providerId === OFFICIAL_PROVIDER_ID
        ? await clearCodexConfig()
        : await writeCodexConfig(state, providerId);
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
