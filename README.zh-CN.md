**简体中文** / [English](./README.md)

# Model Switch Client

一个用于切换 Claude Code / Codex 服务商配置的桌面客户端（Electron + React + TypeScript）。

## 功能

- 服务商管理：统一管理各编程工具的服务商和模型，无需重复创建编辑。

- 客户端配置：支持 `Claude Code` / `Codex` 等按服务商配置模型（更多敬请期待）。

- 一键启用
- 将当前配置写入本机目标文件
- Claude Code: `~/.claude/settings.json`
- Codex: `~/.codex/config.toml`

## 技术栈

- Electron
- React 18
- TypeScript
- Vite

## 本地开发

```bash
npm install
npm run dev
```

## 构建与打包

仅构建前端资源：

```bash
npm run build:renderer
```

打包桌面应用：

```bash
npm run build
```

产物目录：`dist-electron/`

## 常见问题

- 打包后应用空白
  - `vite.config.ts` 已设置 `base: './'`，确保 `file://` 模式下静态资源能正确加载。

- 打包时下载 Electron 超时
  - 可设置镜像后重试：

```bash
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
export ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
npm run build
```

## 许可证（禁止商用）

本项目采用 **PolyForm Noncommercial License 1.0.0**。

- 允许：学习、研究、个人/非商业使用、二次修改
- 禁止：任何商业用途（包括直接售卖、商业服务集成、付费分发等）

详细条款见 [LICENSE](./LICENSE)。

## 免责声明

本项目会覆盖本地客户端配置文件，使用前请自行备份。
