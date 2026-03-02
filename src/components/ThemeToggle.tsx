'use client';
import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

export default function ThemeToggle() {
    const { theme, toggle } = useTheme();
    return (
        <motion.button
            onClick={toggle}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="w-10 h-10 rounded-xl flex items-center justify-center glass-btn transition-all"
            aria-label="Toggle dark/light mode"
        >
            {theme === 'dark' ? (
                <Sun size={18} className="text-amber-400" />
            ) : (
                <Moon size={18} className="text-slate-600" />
            )}
        </motion.button>
    );
}
