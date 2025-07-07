"use client";

import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const preferences = useQuery(api.userPreferences.getUserPreferences);

  // Apply theme immediately on mount from localStorage to prevent flash
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    }
  }, []);

  useEffect(() => {
    // Apply theme from preferences or localStorage
    const applyTheme = () => {
      const savedTheme = localStorage.getItem("theme");
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;

      // Priority: user preferences from DB > localStorage > system preference
      let theme: "light" | "dark" = "light";

      if (preferences?.darkMode !== undefined) {
        theme = preferences.darkMode ? "dark" : "light";
      } else if (savedTheme === "dark" || savedTheme === "light") {
        theme = savedTheme as "light" | "dark";
      } else if (prefersDark) {
        theme = "dark";
      }

      // Apply theme
      document.documentElement.classList.toggle("dark", theme === "dark");
      localStorage.setItem("theme", theme);
    };

    applyTheme();
  }, [preferences?.darkMode]);

  return <>{children}</>;
}
