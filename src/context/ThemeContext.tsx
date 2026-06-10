'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Theme = 'orbital' | 'aurora' | 'solar' | 'emerald' | 'lunar';

export const THEMES: Array<{ id: Theme; label: string; cue: string }> = [
    { id: 'orbital', label: 'Orbital Dark', cue: 'Default' },
    { id: 'aurora', label: 'Aurora Violet', cue: 'Luxury' },
    { id: 'solar', label: 'Solar Amber', cue: 'Warm' },
    { id: 'emerald', label: 'Emerald Ops', cue: 'Calm' },
    { id: 'lunar', label: 'Lunar Light', cue: 'Light' },
];

const ThemeContext = createContext<{
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggle: () => void;
    themes: typeof THEMES;
}>({
    theme: 'orbital',
    setTheme: () => { },
    toggle: () => { },
    themes: THEMES,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<Theme>('orbital');

    const applyTheme = (next: Theme) => {
        setThemeState(next);
        localStorage.setItem('rp_theme', next);
        document.documentElement.dataset.theme = next;
        document.documentElement.classList.toggle('light', next === 'lunar');
        document.documentElement.classList.toggle('dark', next !== 'lunar');
    };

    useEffect(() => {
        const saved = localStorage.getItem('rp_theme') as Theme | null;
        applyTheme(THEMES.some(t => t.id === saved) ? saved! : 'orbital');
    }, []);

    const toggle = () => {
        const index = THEMES.findIndex(t => t.id === theme);
        applyTheme(THEMES[(index + 1) % THEMES.length].id);
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme: applyTheme, toggle, themes: THEMES }}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);
