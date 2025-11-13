"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div
      className="cursor-pointer text-foreground hover:text-primary transition-colors flex items-center gap-2"
      onClick={() => {
        setTheme(theme === "dark" ? "light" : "dark");
      }}
    >
      <span className="text-lg">{theme === "light" ? "☾" : "☼"}</span>
      <span>{`${theme === "light" ? "Dark" : "Light"} mode`}</span>
    </div>
  );
}
