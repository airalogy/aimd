# 字段提取结果

执行 `processor.runSync(tree, file)` 之后，标准化字段元数据会写入 `file.data.aimdFields`。

## 保持为数组的部分

下面这些 scope 仍然是 `string[]`，数组里的每一项都是 id：

- `var`
- `step`
- `check`
- `ref_step`
- `ref_var`
- `ref_fig`
- `cite`

## 使用对象结构的部分

- `var_table[]` 提供规范字段 `id`
- `var_table[].subvars[]` 提供规范字段 `id`
- `quiz[]` 本来就使用 `id`
- `stepHierarchy[]` 提供 `id`、`parentId`、`prevId`、`nextId`

## 示例

```json
{
  "var_table": [
    {
      "id": "samples",
      "scope": "var_table",
      "subvars": [
        { "id": "sample_id" },
        { "id": "concentration" }
      ]
    }
  ],
  "stepHierarchy": [
    {
      "id": "sample_preparation",
      "level": 1,
      "sequence": 0,
      "step": 1,
      "nextId": "data_analysis"
    }
  ]
}
```

如果你在升级旧接入，需要注意旧的 `name` 别名已经移除。详见[迁移说明](/zh/packages/aimd-core/compatibility)。
