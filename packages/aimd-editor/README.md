# @airalogy/aimd-editor

AIMD authoring toolkit for Monaco + Vue (WYSIWYG/source workflows).

## Install

```bash
pnpm add @airalogy/aimd-editor monaco-editor
```

## Quick Start

```ts
import * as monaco from "monaco-editor"
import { language, conf, completionItemProvider } from "@airalogy/aimd-editor/monaco"

monaco.languages.register({ id: "aimd" })
monaco.languages.setMonarchTokensProvider("aimd", language)
monaco.languages.setLanguageConfiguration("aimd", conf)
monaco.languages.registerCompletionItemProvider("aimd", completionItemProvider)
```

## Vue Editor i18n

```vue
<script setup lang="ts">
import { AimdEditor } from "@airalogy/aimd-editor"
</script>

<template>
  <AimdEditor locale="zh-CN" />
</template>
```

Use `messages` to override built-in copy per locale.

Set `:min-height="0"` to make the editor fill a parent container with an explicit height. Leave `minHeight` positive to keep the default fixed editor height behavior.

## Documentation

- EN: <https://airalogy.github.io/aimd/en/packages/aimd-editor>
- 中文: <https://airalogy.github.io/aimd/zh/packages/aimd-editor>
- Source docs: `aimd/docs/en/packages/aimd-editor.md`, `aimd/docs/zh/packages/aimd-editor.md`

## Citation

If `@airalogy/aimd-editor` is useful in your work, please cite the Airalogy paper:

```bibtex
@misc{yang2025airalogyaiempowereduniversaldata,
      title={Airalogy: AI-empowered universal data digitization for research automation},
      author={Zijie Yang and Qiji Zhou and Fang Guo and Sijie Zhang and Yexun Xi and Jinglei Nie and Yudian Zhu and Liping Huang and Chou Wu and Yonghe Xia and Xiaoyu Ma and Yingming Pu and Panzhong Lu and Junshu Pan and Mingtao Chen and Tiannan Guo and Yanmei Dou and Hongyu Chen and Anping Zeng and Jiaxing Huang and Tian Xu and Yue Zhang},
      year={2025},
      eprint={2506.18586},
      archivePrefix={arXiv},
      primaryClass={cs.AI},
      url={https://arxiv.org/abs/2506.18586},
}
```
