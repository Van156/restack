import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@base-template/ui/components/card";
import { RadioGroup, RadioGroupItem } from "@base-template/ui/components/radio-group";

import { THEME_OPTIONS, toThemePreference, type ThemePreference } from "../lib/theme-options";

/** Light / dark / system picker (R5.1). Presentational: the container owns the theme provider. */
export default function ThemePreferenceCard({
  value,
  onChange,
}: {
  value: ThemePreference;
  onChange: (value: ThemePreference) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Theme</CardTitle>
        <CardDescription>Stored in this browser only.</CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          aria-label="Theme"
          value={value}
          onValueChange={(next) => onChange(toThemePreference(String(next)))}
        >
          {THEME_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-start gap-3 text-sm">
              <RadioGroupItem value={option.value} className="mt-0.5" />
              <span className="flex flex-col">
                <span className="font-medium">{option.label}</span>
                <span className="text-muted-foreground">{option.hint}</span>
              </span>
            </label>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
