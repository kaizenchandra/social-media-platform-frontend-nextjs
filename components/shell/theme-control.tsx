"use client";
import { useSyncExternalStore } from "react";
import { SunMoon } from "lucide-react";
import { DropdownMenu } from "@/components/ui/overlays";
import { IconButton } from "@/components/ui/primitives";
import { isTheme, themeStorageKey, type Theme } from "@/lib/theme/theme";

function readTheme(): Theme {
  const value = document.documentElement.dataset.theme;
  return isTheme(value) ? value : "system";
}
function setTheme(theme: Theme) {
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(themeStorageKey, theme);
  } catch {
    /* Preference stays usable when storage is unavailable. */
  }
  window.dispatchEvent(new Event("common-theme"));
}
function subscribe(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== themeStorageKey && event.key !== null) return;
    const theme = isTheme(event.newValue) ? event.newValue : "system";
    if (theme === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    callback();
  };
  window.addEventListener("common-theme", callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("common-theme", callback);
    window.removeEventListener("storage", onStorage);
  };
}
export function ThemeControl() {
  const theme = useSyncExternalStore(
    subscribe,
    readTheme,
    () => "system" as const,
  );
  return (
    <DropdownMenu
      label="Appearance"
      trigger={
        <IconButton label={`Appearance: ${theme}`}>
          <SunMoon size={20} aria-hidden="true" />
        </IconButton>
      }
      items={(["light", "dark", "system"] as const).map((value) => ({
        label: `${value[0].toUpperCase()}${value.slice(1)} theme${theme === value ? " (selected)" : ""}`,
        onSelect: () => setTheme(value),
      }))}
    />
  );
}
