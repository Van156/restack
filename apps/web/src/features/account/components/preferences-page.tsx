import { useTheme } from "@/app/providers/theme-provider";

import { toThemePreference } from "../lib/theme-options";
import ThemePreferenceCard from "./theme-preference-card";

/** `/account/preferences` (R5.1, container): reads and writes the app's existing theme provider. */
export default function PreferencesPage() {
  const { theme, setTheme } = useTheme();
  return <ThemePreferenceCard value={toThemePreference(theme)} onChange={setTheme} />;
}
