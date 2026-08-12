import * as React from "react"

// 主题持久化 key，与 __root.tsx 防 FOUC 内联脚本中的字符串须保持一致，
// 也对齐 index.tsx 里 STORAGE_KEYS 的 "oma-demo." 命名前缀。
const THEME_STORAGE_KEY = "oma-demo.theme"

type Theme = "light" | "dark"

export function useTheme() {
  // SSR 阶段按默认 "light" 渲染；挂载后再读 localStorage 真实值并同步 class，
  // 沿用 index.tsx 既有 "effect 里读 localStorage" 模式以规避 hydration mismatch。
  // 首屏视觉由 __root.tsx 的内联脚本在 hydrate 前提前修正，不受此初始值影响。
  const [theme, setTheme] = React.useState<Theme>("light")
  const [initialized, setInitialized] = React.useState(false)

  React.useEffect(() => {
    let stored: string | null = null
    try {
      stored = localStorage.getItem(THEME_STORAGE_KEY)
    } catch {
      // 存储不可用时仍保持主题功能可用。
    }
    const initial: Theme = stored === "dark" ? "dark" : "light"
    setTheme(initial)
    setInitialized(true)
  }, [])

  React.useEffect(() => {
    if (!initialized) {
      return
    }

    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // 持久化失败不应阻断 DOM 主题同步。
    }
    document.documentElement.classList.toggle("dark", theme === "dark")
  }, [initialized, theme])

  const toggleTheme = React.useCallback(() => {
    setTheme((previous) => (previous === "dark" ? "light" : "dark"))
  }, [])

  return { theme, toggleTheme }
}
