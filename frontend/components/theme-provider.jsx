import React, { createContext, useContext, useEffect, useState } from"react"

const initialState = {
 theme:"system",
 setTheme: () => null,
}

const ThemeProviderContext = createContext(initialState)

export function ThemeProvider({
 children,
 defaultTheme ="light",
 storageKey ="ems-ui-theme-v2",
 ...props
}) {
 const [theme, setTheme] = useState(
 () => (localStorage.getItem(storageKey)) || defaultTheme
 )

 useEffect(() => {
 const root = window.document.documentElement

 root.classList.remove("light","dark")

  const resolvedTheme = theme === "system" 
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme;

  root.classList.add(resolvedTheme);

  const favicon = document.getElementById("dynamic-favicon");
  if (favicon) {
    favicon.href = resolvedTheme === "dark" ? "/favicon-dark.png" : "/favicon-light.png";
  }
 }, [theme])

 const value = {
 theme,
 setTheme: (newTheme) => {
 localStorage.setItem(storageKey, newTheme)
 setTheme(newTheme)
 },
 }

 return (
 <ThemeProviderContext.Provider {...props} value={value}>
 {children}
 </ThemeProviderContext.Provider>
 )
}

export const useTheme = () => {
 const context = useContext(ThemeProviderContext)

 if (context === undefined)
 throw new Error("useTheme must be used within a ThemeProvider")

 return context
}
