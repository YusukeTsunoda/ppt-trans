'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

export function ThemeDebug() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [htmlClass, setHtmlClass] = useState('');
  const [cssVars, setCssVars] = useState({ background: '', foreground: '' });
  const [computedStyles, setComputedStyles] = useState({ background: '', color: '' });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const checkStyles = () => {
      const html = document.documentElement;
      const body = document.body;
      
      // HTMLのclass属性を確認
      setHtmlClass(html.className);
      console.log('=== THEME DEBUG ===');
      console.log('HTML element class:', html.className);
      console.log('HTML element classList:', Array.from(html.classList));
      console.log('Has dark class:', html.classList.contains('dark'));
      
      // CSS変数の値を確認
      const styles = getComputedStyle(html);
      const bgVar = styles.getPropertyValue('--background').trim();
      const fgVar = styles.getPropertyValue('--foreground').trim();
      setCssVars({ background: bgVar, foreground: fgVar });
      console.log('CSS Variables:');
      console.log('  --background:', bgVar);
      console.log('  --foreground:', fgVar);
      
      // 実際に適用されているスタイルを確認
      const bodyStyles = getComputedStyle(body);
      const bgColor = bodyStyles.backgroundColor;
      const textColor = bodyStyles.color;
      setComputedStyles({ background: bgColor, color: textColor });
      console.log('Computed Styles on body:');
      console.log('  background-color:', bgColor);
      console.log('  color:', textColor);
      
      // Tailwindのダークモードクラスが機能しているか確認
      const testElement = document.createElement('div');
      testElement.className = 'bg-white dark:bg-gray-900';
      document.body.appendChild(testElement);
      const testStyles = getComputedStyle(testElement);
      console.log('Tailwind dark mode test:');
      console.log('  Test element bg:', testStyles.backgroundColor);
      document.body.removeChild(testElement);
      
      console.log('===================');
    };

    checkStyles();
    
    // MutationObserverでclass属性の変更を監視
    const observer = new MutationObserver(checkStyles);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 text-xs max-w-xs z-50">
      <h3 className="font-bold mb-2">Theme Debug</h3>
      <div className="space-y-1">
        <p>Theme: {theme}</p>
        <p>Resolved: {resolvedTheme}</p>
        <p>HTML class: {htmlClass || 'none'}</p>
        <p>CSS Vars: bg={cssVars.background}, fg={cssVars.foreground}</p>
        <p>Body styles: bg={computedStyles.background}, color={computedStyles.color}</p>
        <p>localStorage: {typeof window !== 'undefined' ? localStorage.getItem('pptx-translator-theme') : 'N/A'}</p>
      </div>
      <div className="mt-2 space-x-2">
        <button
          onClick={() => {
            console.log('Debug: Setting theme to light');
            setTheme('light');
          }}
          className="px-2 py-1 bg-blue-500 text-white rounded"
        >
          Light
        </button>
        <button
          onClick={() => {
            console.log('Debug: Setting theme to dark');
            setTheme('dark');
          }}
          className="px-2 py-1 bg-gray-700 text-white rounded"
        >
          Dark
        </button>
      </div>
    </div>
  );
}