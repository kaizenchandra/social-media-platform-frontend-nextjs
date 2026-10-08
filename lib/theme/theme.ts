export type Theme = "system" | "light" | "dark";
export const themeStorageKey = "common.theme";
export function isTheme(value: unknown): value is Theme {
  return value === "system" || value === "light" || value === "dark";
}
// Static, authored script: contains no user or environment content.
export const themeInitScript = `(()=>{try{const t=localStorage.getItem('${themeStorageKey}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch{}})()`;
