# @airalogy/aimd-recorder

> AIMD 编辑器 Vue 组件和 UI

## 概述

本包提供 AIMD 的 Vue UI 与样式。

## 安装

```bash
pnpm add @airalogy/aimd-recorder @airalogy/aimd-renderer @airalogy/aimd-core
```

## 功能特性

-  **样式** - AIMD 元素和编辑器 UI 的预构建 CSS
 -  **版本常量** - 导出 `AIMD_EDITOR_VERSION` 便于调试/版本检查

## 使用

### 样式

```typescript
import '@airalogy/aimd-recorder/styles'
```

### 版本

```typescript
import { AIMD_EDITOR_VERSION } from '@airalogy/aimd-recorder'
```

## 导出

### 主入口（`@airalogy/aimd-recorder`）

- 默认会副作用导入 `./styles/aimd.css`（也可通过 `@airalogy/aimd-recorder/styles` 单独导入）
- `AIMD_EDITOR_VERSION`

### 组件入口（`@airalogy/aimd-recorder/components`）

目前为占位入口，暂无公开导出。

### 组合式入口（`@airalogy/aimd-recorder/composables`）

目前为占位入口，暂无公开导出。

## 样式

导入预构建的样式：

```typescript
import '@airalogy/aimd-recorder/styles'
```

样式采用以下技术构建：
- UnoCSS 用于原子样式 CSS
- 支持暗黑模式
- 响应式设计
- 可访问的 UI 组件

## 开发

### 脚本命令

```bash
# 类型检查
pnpm type-check

# 生产环境构建
pnpm build
```

### 依赖

本包依赖于：

- **@airalogy/aimd-core** - 核心 AIMD 解析器和类型
- **@airalogy/aimd-renderer** - AIMD 渲染引擎
- **Vue 3** - 组件框架
- **Naive UI** - UI 组件库（可选）
- **VueUse** - Vue Composition 工具

## 架构

所有组件遵循以下原则：

- **Vue 3 Composition API** 配合 `<script setup>`
- **TypeScript** 用于类型安全
- **反应式状态** - 完整反应式的 props 和 emits
- **可访问性** - ARIA 标签和键盘支持
- **可主题化** - 支持亮色/暗色模式

## 贡献指南

1. 遵循 Vue 3 Composition API 模式
2. 为所有新组件使用 TypeScript
3. 为公开 API 添加 JSDoc 注释
4. 添加适当的 prop 验证
5. 确保组件响应式且可访问
6. 在 README 中更新新组件文档

## 相关包

- **@airalogy/aimd-core** - 核心 AIMD 解析器和语法
- **@airalogy/aimd-renderer** - AIMD 渲染引擎
- **@airalogy/aimd-editor** - Monaco 编辑器集成
- **@airalogy/components** - 通用 UI 组件

## 许可证

Airalogy 单体仓库的一部分。保留所有权利。
