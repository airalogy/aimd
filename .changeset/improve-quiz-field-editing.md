---
"@airalogy/aimd-editor": minor
"@airalogy/aimd-recorder": minor
---

feat: improve quiz field editing

- Auto-generate quiz IDs based on type and check existing IDs to avoid duplicates
- Reset stem and all type-specific fields when changing quiz type
- Change default blank answer from '21%' to empty string
- Choice options default to empty text
- Move 'Correct Answer' column to last position
- Add leading newline when inserting at non-line-start position
