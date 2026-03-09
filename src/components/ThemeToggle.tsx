import React from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const ThemeToggle: React.FC = () => {
  const [isLight, setIsLight] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('zelda-theme') === 'light';
  });

  React.useEffect(() => {
    const root = document.documentElement;
    if (isLight) {
      root.classList.add('light');
      localStorage.setItem('zelda-theme', 'light');
    } else {
      root.classList.remove('light');
      localStorage.setItem('zelda-theme', 'dark');
    }
  }, [isLight]);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setIsLight(prev => !prev)}
      className="fixed top-4 left-4 z-50 w-10 h-10 rounded-full bg-card/80 backdrop-blur border border-border shadow-lg hover:bg-card"
      title={isLight ? 'الوضع المظلم' : 'الوضع الفاتح'}
    >
      {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
    </Button>
  );
};

export default ThemeToggle;
