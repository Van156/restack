/** The theme choices `next-themes` accepts in this app (`ThemeProvider` has system detection on). */
export type ThemePreference = "light" | "dark" | "system";

export const THEME_OPTIONS: readonly { value: ThemePreference; label: string; hint: string }[] = [
  { value: "light", label: "Light", hint: "Always use the light theme." },
  { value: "dark", label: "Dark", hint: "Always use the dark theme." },
  { value: "system", label: "System", hint: "Match your device setting." },
];

/** Narrows the provider's free-form `theme` string; unknown or unset values read as `"system"`. */
export function toThemePreference(theme: string | undefined): ThemePreference {
  return THEME_OPTIONS.find((option) => option.value === theme)?.value ?? "system";
}
