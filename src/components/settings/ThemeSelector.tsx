import { Moon, Sun } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();

  const options: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: "light", label: t("settings.light"), icon: Sun },
    { value: "dark", label: t("settings.dark"), icon: Moon },
  ];

  return (
    <fieldset>
      <legend className="text-sm font-semibold text-foreground">{t("settings.theme")}</legend>
      <p className="mt-1 text-[13px] text-muted-foreground">{t("settings.themeHint")}</p>
      <div
        role="radiogroup"
        aria-label={t("settings.theme")}
        className="mt-4 inline-flex rounded-xl border bg-muted p-1"
      >
        {options.map((opt) => {
          const active = theme === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(opt.value)}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-lg px-5 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-card text-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <opt.icon className="h-4 w-4" aria-hidden />
              {opt.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
