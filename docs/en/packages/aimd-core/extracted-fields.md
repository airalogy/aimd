# Extracted Fields

After `processor.runSync(tree, file)`, normalized field metadata is available at `file.data.aimdFields`.

## What Stays As Arrays

These scopes are still simple `string[]`, and each string is an identifier:

- `var`
- `step`
- `check`
- `ref_step`
- `ref_var`
- `ref_fig`
- `cite`

## What Uses Structured Objects

- `var_table[]` exposes canonical `id`
- `var_table[].subvars[]` exposes canonical `id`
- `quiz[]` already exposes `id`
- `stepHierarchy[]` exposes `id`, `parentId`, `prevId`, `nextId`

## Example

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

If you are upgrading older integrations, note that the old `name` aliases have been removed. Read [Migration](/en/packages/aimd-core/compatibility).
