import { createFileRoute } from "@tanstack/react-router";
import { LanguageSelector } from "@/components/settings/LanguageSelector";
import { ThemeSelector } from "@/components/settings/ThemeSelector";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/app/settings")({
  head: () => ({
    meta: [
      { title: "Settings — ELIXIR" },
      {
        name: "description",
        content: "Manage your ELIXIR preferences: interface language and light or dark appearance.",
      },
      { property: "og:title", content: "Settings — ELIXIR" },
      {
        property: "og:description",
        content: "Manage your ELIXIR preferences: interface language and light or dark appearance.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-[28px] font-semibold tracking-tight md:text-[32px]">
          {t("settings.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground md:text-base">{t("settings.subtitle")}</p>
      </header>

      <section aria-labelledby="general-settings" className="card-soft p-5 md:p-6">
        <h2 id="general-settings" className="text-xl font-semibold tracking-tight md:text-2xl">
          {t("settings.general")}
        </h2>
        <div className="mt-5 border-t pt-5">
          <LanguageSelector />
        </div>
      </section>

      <section aria-labelledby="appearance-settings" className="card-soft p-5 md:p-6">
        <h2 id="appearance-settings" className="text-xl font-semibold tracking-tight md:text-2xl">
          {t("settings.appearance")}
        </h2>
        <div className="mt-5 border-t pt-5">
          <ThemeSelector />
        </div>
      </section>
    </div>
  );
}
