import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi } from '@/services/api';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(localStorage.getItem('theme') || 'dark');

  const applyTheme = useCallback((t) => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    let actualTheme = t;
    if (t === 'system') {
      actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    root.classList.add(actualTheme);
    root.style.colorScheme = actualTheme;
    localStorage.setItem('theme', t);
  }, []);

  // Sync with DB on mount & handle system changes
  useEffect(() => {
    const syncTheme = async () => {
      const token = localStorage.getItem('landlink_token');
      if (token) {
        try {
          const { data } = await authApi.getSettings();
          if (data.settings?.theme) {
            setThemeState(data.settings.theme);
          }
        } catch (err) {
          console.error('Failed to sync theme from DB', err);
        }
      }
    };
    syncTheme();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      if (localStorage.getItem('theme') === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [applyTheme]);

  // Apply whenever theme state changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  const setTheme = async (newTheme) => {
    setThemeState(newTheme);
    const token = localStorage.getItem('landlink_token');
    if (token) {
      try {
        await authApi.updateTheme(newTheme);
      } catch (err) {
        console.error('Failed to save theme to database', err);
      }
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
