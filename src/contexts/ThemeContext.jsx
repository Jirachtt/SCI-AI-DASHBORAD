import { createContext, useContext, useState, useEffect } from 'react';
import { Chart as ChartJS } from 'chart.js';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('mju-theme') || 'light';
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('mju-theme', theme);
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
