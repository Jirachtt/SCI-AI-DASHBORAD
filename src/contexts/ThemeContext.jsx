import { createContext, useContext, useState, useEffect } from 'react';
import { Chart as ChartJS } from 'chart.js';

const ThemeContext = createContext();
const THEME_STORAGE_KEY = 'mju-theme';
const THEME_DEFAULT_VERSION_KEY = 'mju-theme-default-version';
const DARK_DEFAULT_VERSION = '2026-05-dark-default';

function getInitialTheme() {
    try {
        const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        const defaultVersion = localStorage.getItem(THEME_DEFAULT_VERSION_KEY);

        if (defaultVersion !== DARK_DEFAULT_VERSION) {
            localStorage.setItem(THEME_DEFAULT_VERSION_KEY, DARK_DEFAULT_VERSION);
            if (!storedTheme || storedTheme === 'light') {
                localStorage.setItem(THEME_STORAGE_KEY, 'dark');
                return 'dark';
            }
        }

        return storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : 'dark';
    } catch {
        return 'dark';
    }
}

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(getInitialTheme);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(THEME_STORAGE_KEY, theme);
        window.dispatchEvent(new CustomEvent('mju-theme-change', { detail: { theme } }));

        requestAnimationFrame(() => {
            Object.values(ChartJS.instances || {}).forEach(chart => {
                chart?.update?.('none');
            });
        });
    }, [theme]);

    const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme must be used within ThemeProvider');
    return context;
}
