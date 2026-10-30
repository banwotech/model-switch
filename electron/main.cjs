const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const os = require('os');

const APP_STATE_FILE = 'app-state.json';
// Keep in sync with OFFICIAL_PROVIDER_ID in src/renderer/types/index.ts
const OFFICIAL_PROVIDER_ID = '__official__';

// Markers used to delimit the switch-managed export block in ~/.zshrc.
const ZSHRC_BEGIN = '# >>> model-switch gemini-cli begin >>>';
const ZSHRC_END = '# <<< model-switch gemini-cli end <<<';

/** @typedef {{id:string,name:string,apiKey:string,models:string[]}} Provider */
/** @typedef {{apiBase:string,models:{defaultModel:string,reasoningModel:string,haikuModel:string,sonnetModel:string,opusModel:string}}} ClaudeProviderConfig */
/** @typedef {{apiBase:string,model:string}} CodexProviderConfig */
/** @typedef {{apiBase:string,model:string}} GeminiCliProviderConfig */
/** @typedef {{apiBase:string,model:string}} OpencodeProviderConfig */
/** @typedef {{activeProviderId:string,providerConfigs:Record<string, ClaudeProviderConfig>}} ClaudeConfig */
/** @typedef {{activeProviderId:string,providerConfigs:Record<string, CodexProviderConfig>}} CodexConfig */
/** @typedef {{activeProviderId:string,providerConfigs:Record<string, GeminiCliProviderConfig>}} GeminiCliConfig */
/** @typedef {{activeProviderId:string,providerConfigs:Record<string, OpencodeProviderConfig>}} OpencodeConfig */
/** @typedef {{providers:Provider[],clientConfig:{claudeCode:ClaudeConfig,codex:CodexConfig,geminiCli:GeminiCliConfig,opencode:OpencodeConfig}}} AppState */

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
      },
      geminiCli: {
        activeProviderId: '',
        providerConfigs: {}
      },
      opencode: {
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

function emptyGeminiCliProviderConfig() {
  return {
    apiBase: '',
    model: ''
  };
}

function emptyOpencodeProviderConfig() {
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

  const geminiCliProviderConfigs = {};
  Object.entries(state.clientConfig?.geminiCli?.providerConfigs || {}).forEach(([providerId, cfg]) => {
    if (!providerIds.has(providerId)) return;
    geminiCliProviderConfigs[providerId] = {
      ...emptyGeminiCliProviderConfig(),
      ...cfg
    };
  });

  const opencodeProviderConfigs = {};
  Object.entries(state.clientConfig?.opencode?.providerConfigs || {}).forEach(([providerId, cfg]) => {
    if (!providerIds.has(providerId)) return;
    opencodeProviderConfigs[providerId] = {
      ...emptyOpencodeProviderConfig(),
      ...cfg
    };
  });

  providers.forEach((provider) => {
    if (!provider?.id) return;
    if (!claudeProviderConfigs[provider.id]) claudeProviderConfigs[provider.id] = emptyClaudeProviderConfig();
    if (!codexProviderConfigs[provider.id]) codexProviderConfigs[provider.id] = emptyCodexProviderConfig();
    if (!geminiCliProviderConfigs[provider.id]) geminiCliProviderConfigs[provider.id] = emptyGeminiCliProviderConfig();
    if (!opencodeProviderConfigs[provider.id]) opencodeProviderConfigs[provider.id] = emptyOpencodeProviderConfig();
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
      },
      geminiCli: {
        activeProviderId: isValidActive(state.clientConfig?.geminiCli?.activeProviderId)
          ? state.clientConfig.geminiCli.activeProviderId
          : '',
        providerConfigs: geminiCliProviderConfigs
      },
      opencode: {
        activeProviderId: isValidActive(state.clientConfig?.opencode?.activeProviderId)
          ? state.clientConfig.opencode.activeProviderId
          : '',
        providerConfigs: opencodeProviderConfigs
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

function escapeShellDoubleQuoted(value) {
  // Inside double quotes only $, `, \, " (and !) need escaping; we never write
  // multi-line values (URL/key/model are single-line), so newlines are not a
  // concern. Wrap the value in double quotes when interpolating.
  return String(value).replace(/[\\"`$]/g, (ch) => '\\' + ch);
}

function buildGeminiCliZshrcBlock(config) {
  const lines = [
    ZSHRC_BEGIN,
    `export GOOGLE_GEMINI_BASE_URL="${escapeShellDoubleQuoted(config.apiBase)}"`,
    `export GEMINI_API_KEY="${escapeShellDoubleQuoted(config.apiKey)}"`,
    `export GEMINI_MODEL="${escapeShellDoubleQuoted(config.model)}"`,
    ZSHRC_END
  ];
  return lines.join('\n');
}

// Remove an existing switch-managed block from ~/.zshrc body. The block is
// delimited by ZSHRC_BEGIN / ZSHRC_END markers; everything between them
// (inclusive) is dropped, plus the surrounding blank lines that the block
// itself introduced so we don't accumulate gaps over repeated activations.
function stripGeminiCliZshrcBlock(existing) {
  const beginIdx = existing.indexOf(ZSHRC_BEGIN);
  if (beginIdx === -1) return existing;
  const endMarkerIdx = existing.indexOf(ZSHRC_END, beginIdx);
  if (endMarkerIdx === -1) return existing;
  const endIdx = endMarkerIdx + ZSHRC_END.length;

  let cutStart = beginIdx;
  while (cutStart > 0 && existing[cutStart - 1] === '\n') cutStart--;
  let cutEnd = endIdx;
  while (cutEnd < existing.length && existing[cutEnd] === '\n') cutEnd++;

  const before = existing.slice(0, cutStart);
  const after = existing.slice(cutEnd);
  if (!before) return after.replace(/^\n+/, '');
  if (!after) return before.replace(/\n+$/, '') + '\n';
  return before.replace(/\n+$/, '') + '\n\n' + after.replace(/^\n+/, '');
}

async function writeGeminiCliZshrc(config) {
  const targetFile = path.join(os.homedir(), '.zshrc');
  let existing = '';
  try {
    existing = await fs.readFile(targetFile, 'utf-8');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  const stripped = stripGeminiCliZshrcBlock(existing);
  const block = buildGeminiCliZshrcBlock(config);

  let next;
  if (!stripped) {
    next = block + '\n';
  } else if (stripped.endsWith('\n')) {
    next = stripped + '\n' + block + '\n';
  } else {
    next = stripped + '\n\n' + block + '\n';
  }
  await fs.writeFile(targetFile, next, 'utf-8');
  return targetFile;
}

async function clearGeminiCliZshrc() {
  const targetFile = path.join(os.homedir(), '.zshrc');
  let existing;
  try {
    existing = await fs.readFile(targetFile, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') return targetFile;
    throw err;
  }
  const next = stripGeminiCliZshrcBlock(existing);
  if (next !== existing) {
    await fs.writeFile(targetFile, next, 'utf-8');
  }
  return targetFile;
}

async function writeGeminiCliConfig(state, providerId) {
  const provider = safeProviders(state).find((p) => p.id === providerId);
  if (!provider) throw new Error('Gemini CLI 未选择有效服务商');

  const providerConfig = state.clientConfig?.geminiCli?.providerConfigs?.[providerId];
  if (!providerConfig) throw new Error('Gemini CLI 配置不存在');

  const config = {
    apiBase: providerConfig.apiBase || '',
    apiKey: provider.apiKey || '',
    model: providerConfig.model || ''
  };

  return writeGeminiCliZshrc(config);
}

async function clearGeminiCliConfig() {
  return clearGeminiCliZshrc();
}

// OpenCode config schema: a top-level `provider` map keyed by provider id
// (we use 'switch'), plus a top-level `model` field of the form
// "<providerId>/<modelId>". Preserve the user's other providers / fields.
async function writeOpencodeConfig(state, providerId) {
  const provider = safeProviders(state).find((p) => p.id === providerId);
  if (!provider) throw new Error('OpenCode 未选择有效服务商');

  const providerConfig = state.clientConfig?.opencode?.providerConfigs?.[providerId];
  if (!providerConfig) throw new Error('OpenCode 配置不存在');

  const targetFile = path.join(os.homedir(), '.config', 'opencode', 'opencode.json');

  let existing = {};
  let raw;
  try {
    raw = await fs.readFile(targetFile, 'utf-8');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  if (raw !== undefined) {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) existing = parsed;
  }

  const otherProviders = { ...(existing.provider || {}) };
  delete otherProviders.switch;

  const switchProvider = {
    npm: '@ai-sdk/openai-compatible',
    name: provider.name || 'Switch',
    options: {
      baseURL: providerConfig.apiBase || '',
      apiKey: provider.apiKey || ''
    },
    models: providerConfig.model ? { [providerConfig.model]: {} } : {}
  };

  const output = {
    $schema: existing.$schema || 'https://opencode.ai/config.json',
    ...existing,
    provider: {
      ...otherProviders,
      switch: switchProvider
    },
    model: providerConfig.model ? `switch/${providerConfig.model}` : existing.model || ''
  };

  await fs.mkdir(path.dirname(targetFile), { recursive: true });
  await fs.writeFile(targetFile, JSON.stringify(output, null, 2), 'utf-8');
  return targetFile;
}

async function clearOpencodeConfig() {
  const targetFile = path.join(os.homedir(), '.config', 'opencode', 'opencode.json');
  let raw;
  try {
    raw = await fs.readFile(targetFile, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') return targetFile;
    throw err;
  }
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return targetFile;

  const provider = { ...(parsed.provider || {}) };
  const removed = Boolean(provider.switch);
  delete provider.switch;

  const output = { ...parsed };
  if (Object.keys(provider).length > 0) output.provider = provider;
  else delete output.provider;

  if (typeof output.model === 'string' && output.model.startsWith('switch/')) {
    delete output.model;
  }

  if (!removed && output.model === parsed.model) return targetFile;

  await fs.writeFile(targetFile, JSON.stringify(output, null, 2), 'utf-8');
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

async function syncClientOnSave(prevActiveId, nextActiveId, write, clear, label) {
  if (nextActiveId === OFFICIAL_PROVIDER_ID) {
    try {
      await clear();
    } catch (error) {
      console.error(`[state:save] clear ${label} failed:`, error);
    }
    return;
  }
  if (nextActiveId) {
    try {
      await write();
    } catch (error) {
      console.error(`[state:save] write ${label} failed:`, error);
    }
    return;
  }
  if (prevActiveId) {
    try {
      await clear();
    } catch (error) {
      console.error(`[state:save] clear ${label} failed:`, error);
    }
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

    const claudeActiveId = state.clientConfig?.claudeCode?.activeProviderId || '';
    await syncClientOnSave(
      prevState.clientConfig?.claudeCode?.activeProviderId || '',
      claudeActiveId,
      () => writeClaudeConfig(state, claudeActiveId),
      () => clearClaudeConfig(),
      'claudeCode'
    );

    const codexActiveId = state.clientConfig?.codex?.activeProviderId || '';
    await syncClientOnSave(
      prevState.clientConfig?.codex?.activeProviderId || '',
      codexActiveId,
      () => writeCodexConfig(state, codexActiveId),
      () => clearCodexConfig(),
      'codex'
    );

    const geminiCliActiveId = state.clientConfig?.geminiCli?.activeProviderId || '';
    await syncClientOnSave(
      prevState.clientConfig?.geminiCli?.activeProviderId || '',
      geminiCliActiveId,
      () => writeGeminiCliConfig(state, geminiCliActiveId),
      () => clearGeminiCliConfig(),
      'geminiCli'
    );

    const opencodeActiveId = state.clientConfig?.opencode?.activeProviderId || '';
    await syncClientOnSave(
      prevState.clientConfig?.opencode?.activeProviderId || '',
      opencodeActiveId,
      () => writeOpencodeConfig(state, opencodeActiveId),
      () => clearOpencodeConfig(),
      'opencode'
    );

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
    if (client === 'geminiCli') {
      const target = providerId === OFFICIAL_PROVIDER_ID
        ? await clearGeminiCliConfig()
        : await writeGeminiCliConfig(state, providerId);
      return { success: true, target };
    }
    if (client === 'opencode') {
      const target = providerId === OFFICIAL_PROVIDER_ID
        ? await clearOpencodeConfig()
        : await writeOpencodeConfig(state, providerId);
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
