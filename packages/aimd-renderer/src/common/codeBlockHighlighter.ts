import type { ShikiHighlighter } from "../vue/vue-renderer"

let defaultCodeBlockHighlighterPromise: Promise<ShikiHighlighter | null> | null = null

export async function getDefaultCodeBlockHighlighter(): Promise<ShikiHighlighter | null> {
  if (!defaultCodeBlockHighlighterPromise) {
    defaultCodeBlockHighlighterPromise = import("shiki")
      .then(async ({ createHighlighter }) => {
        const highlighter = await createHighlighter({
          themes: ["github-light", "github-dark"],
          langs: [
            "javascript",
            "typescript",
            "python",
            "json",
            "yaml",
            "toml",
            "ini",
            "bash",
            "shellscript",
            "sql",
            "html",
            "css",
            "markdown",
            "xml",
            "txt",
          ],
        })
        return highlighter as unknown as ShikiHighlighter
      })
      .catch(() => null)
  }

  return defaultCodeBlockHighlighterPromise
}
