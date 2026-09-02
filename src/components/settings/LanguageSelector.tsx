import { Check } from "lucide-react";
import { LANGUAGES, useI18n, type LanguageCode } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LanguageSelector() {
  const { language, setLanguage, t } = useI18n();

  return (
    <fieldset>
      <legend className="text-sm font-semibold text-foreground">{t("settings.language")}</legend>
      <p className="mt-1 text-[13px] text-muted-foreground">{t("settings.languageHint")}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {LANGUAGES.map((lang) => {
          const active = language === lang.code;
          return (
            <button
              key={lang.code}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setLanguage(lang.code as LanguageCode)}
              className={cn(
                "flex min-h-12 items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors",
                "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "border-primary bg-brand-soft" : "bg-card",
              )}
            >
              <span>
                <span className="block text-sm font-medium text-foreground">{lang.native}</span>
                <span className="block text-[13px] text-muted-foreground">{lang.label}</span>
              </span>
              {active && <Check className="h-4 w-4 text-primary" aria-hidden />}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
