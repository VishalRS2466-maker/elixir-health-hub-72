import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bell, Languages, Palette, ShieldCheck, UserRound } from "lucide-react";
import { LanguageSelector } from "@/components/settings/LanguageSelector";
import { ThemeSelector } from "@/components/settings/ThemeSelector";
import { SecuritySettings } from "@/components/settings/SecuritySettings";
import { useSession } from "@/hooks/useSession";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/settings")({
  head: () => ({
    meta: [
      { title: "Settings — ELIXIR" },
      {
        name: "description",
        content:
          "Manage your ELIXIR account: passkeys and device security, language, appearance and notifications.",
      },
      { property: "og:title", content: "Settings — ELIXIR" },
      {
        property: "og:description",
        content: "Passkeys, active sessions, language and appearance for your ELIXIR account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

type SectionId = "account" | "appearance" | "language" | "notifications" | "security";

const SECTIONS: { id: SectionId; label: string; icon: typeof UserRound }[] = [
  { id: "account", label: "Account", icon: UserRound },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "language", label: "Language", icon: Languages },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: ShieldCheck },
];

function SettingsPage() {
  const { t } = useI18n();
  const { user, profile, role } = useSession();
  const [section, setSection] = useState<SectionId>("account");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[26px] font-semibold tracking-tight md:text-[32px]">
          {t("settings.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground md:text-base">{t("settings.subtitle")}</p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]">
        <nav
          aria-label="Settings sections"
          className="flex gap-2 overflow-x-auto rounded-2xl border bg-card p-2 lg:sticky lg:top-20 lg:h-fit lg:flex-col lg:overflow-visible"
        >
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              aria-current={section === s.id ? "page" : undefined}
              className={cn(
                "flex min-h-11 shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:w-full",
                section === s.id && "bg-brand-soft font-semibold text-foreground",
              )}
            >
              <s.icon className="h-4.5 w-4.5 shrink-0" />
              {s.label}
            </button>
          ))}
        </nav>

        <div className="min-w-0">
          {section === "account" && (
            <section className="card-soft p-5 md:p-6">
              <h2 className="text-lg font-semibold tracking-tight">Account</h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <Row label="Name" value={profile?.full_name ?? "—"} />
                <Row label="Email" value={user?.email ?? "—"} />
                <Row label="Universal User ID" value={profile?.universal_id ?? "—"} />
                <Row label="ABHA ID" value={profile?.abha_id ?? "Not linked"} />
                <Row label="Role" value={role} />
                <Row label="Phone" value={profile?.phone ?? "—"} />
              </dl>
            </section>
          )}

          {section === "appearance" && (
            <section className="card-soft p-5 md:p-6">
              <h2 className="text-lg font-semibold tracking-tight">{t("settings.appearance")}</h2>
              <div className="mt-5 border-t pt-5">
                <ThemeSelector />
              </div>
            </section>
          )}

          {section === "language" && (
            <section className="card-soft p-5 md:p-6">
              <h2 className="text-lg font-semibold tracking-tight">{t("settings.general")}</h2>
              <div className="mt-5 border-t pt-5">
                <LanguageSelector />
              </div>
            </section>
          )}

          {section === "notifications" && (
            <section className="card-soft p-5 md:p-6">
              <h2 className="text-lg font-semibold tracking-tight">Notifications</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Medicine reminders, appointment updates and consent requests appear in the bell menu
                in the header.
              </p>
            </section>
          )}

          {section === "security" && <SecuritySettings />}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="truncate text-sm capitalize">{value}</dd>
    </div>
  );
}
