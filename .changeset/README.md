# Changesets

This repo uses Changesets to manage releases for the publishable `@airalogy/aimd-*` packages.

## Normal workflow

1. Make your feature or fix.
2. If it changes published behavior, run `corepack pnpm changeset:add`.
3. Select every affected publishable package and the right SemVer bump.
4. Commit the generated markdown file under `.changeset/` with the code change.

## Notes

- One feature may affect multiple packages. Prefer one multi-package changeset for that release unit.
- Do not manually bump package versions or edit package changelogs during normal feature work.
- Release PRs and package publishing are handled by GitHub Actions after changes land on `main`.
