import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext({ dark: false, toggle: () => {} })

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
    try {
      localStorage.setItem('theme', dark ? 'dark' : 'light')
    } catch {
      /* preference just won't persist */
    }
  }, [dark])

  const toggle = useCallback(() => setDark((d) => !d), [])
  return <ThemeContext.Provider value={{ dark, toggle }}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
