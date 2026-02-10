# AIMD 包 Monorepo

本仓库以 monorepo 形式维护 AIMD 相关包：

- `@airalogy/aimd-core`：AIMD 解析器、语法定义与工具
- `@airalogy/aimd-editor`：AIMD 的 Monaco 编辑器集成
- `@airalogy/aimd-renderer`：将 AIMD 渲染为 HTML 与 Vue
- `@airalogy/aimd-recorder`：AIMD 的 Vue UI 组件与样式

## 开发

在仓库根目录安装依赖：

```bash
pnpm install
```

全部包进入 watch 模式（改动自动构建）：

```bash
pnpm dev
```

单包开发：

```bash
pnpm --filter @airalogy/aimd-core dev
pnpm --filter @airalogy/aimd-editor dev
pnpm --filter @airalogy/aimd-renderer dev
pnpm --filter @airalogy/aimd-recorder dev
```

启动 Demo 开发服务器（可视化测试所有包功能）：

```bash
pnpm dev:demo
```

访问 http://localhost:5188 查看 Demo，包含以下页面：

- **Core 解析器**：实时解析 AIMD Markdown，查看 AST 和提取的字段
- **Editor 编辑器**：Monaco 编辑器 Token 定义和主题配置预览
- **Renderer 渲染器**：AIMD 渲染为 HTML / Vue VNodes 的实时预览
- **Recorder 组件**：AIMD CSS 样式和 UI 组件预览

全量类型检查：

```bash
pnpm type-check
```

## 构建

构建全部包：

```bash
pnpm build
```

构建单个包：

```bash
pnpm --filter @airalogy/aimd-core build
```
