[简体中文](./README.zh-CN.md) / **English**

# Model Switch Client

A desktop app (Electron + React + TypeScript) for managing and switching provider configs for Claude Code and Codex.

## Features

- Provider Management: Unified management of providers and models across coding tools, without repeated creation and editing.

- Client Configuration: Supports configuring models by provider for `Claude Code` / `Codex` and more (coming soon).

- One-click activation
- Writes selected config to local client files
- Claude Code: `~/.claude/settings.json`
- Codex: `~/.codex/config.toml`

## Tech Stack

- Electron
- React 18
- TypeScript
- Vite

## Development

```bash
npm install
npm run dev
```

## Build & Package

Build renderer only:

```bash
npm run build:renderer
```

Build desktop package:

```bash
npm run build
```

Output directory: `dist-electron/`

## FAQ

- App shows a blank screen after packaging
  - `vite.config.ts` uses `base: './'` so static assets load correctly in `file://` mode.

- Electron download timeout during packaging
  - Try mirror settings:

```bash
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
export ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
npm run build
```

## License (Non-Commercial)

This project is licensed under **PolyForm Noncommercial License 1.0.0**.

- Allowed: learning, research, personal/non-commercial use, modifications
- Not allowed: any commercial use (including paid distribution, commercial integration, or paid services)

See [LICENSE](./LICENSE) for full terms.

## Disclaimer

This app overwrites local client configuration files. Back up your files before use.
