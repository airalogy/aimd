# @airalogy/aimd-editor

AIMD authoring toolkit for Monaco + Vue (WYSIWYG/source workflows).

## Install

```bash
pnpm add @airalogy/aimd-editor monaco-editor
```

## Quick Start

```ts
import * as monaco from "monaco-editor"
import { language, conf, completionItemProvider } from "@airalogy/aimd-editor"

monaco.languages.register({ id: "aimd" })
monaco.languages.setMonarchTokensProvider("aimd", language)
monaco.languages.setLanguageConfiguration("aimd", conf)
monaco.languages.registerCompletionItemProvider("aimd", completionItemProvider)
```

## Documentation

- EN: <https://airalogy.github.io/aimd/en/packages/aimd-editor>
- 中文: <https://airalogy.github.io/aimd/zh/packages/aimd-editor>
- Source docs: `aimd/docs/en/packages/aimd-editor.md`, `aimd/docs/zh/packages/aimd-editor.md`
