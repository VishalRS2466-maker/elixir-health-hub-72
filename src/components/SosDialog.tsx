import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, HeartPulse, MapPin, Phone, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import * as EmergencyService from "@/services/emergency";
import type { Tables } from "@/integrations/supabase/types";

export function SosDialog({
  open,
  onClose,
  contacts,
  onLogged,
}: {
  open: boolean;
  onClose: () => void;
  contacts: Tables<"emergency_contacts">[];
  onLogged: (action: string) => void;
}) {
  const [location, setLocation] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  if (!open) return null;

  const primary = contacts[0];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 md:items-center md:p-6">
      <div className="w-full max-w-md rounded-t-3xl bg-card p-5 shadow-lift md:rounded-3xl">
        {!confirmed ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emergency-soft text-emergency">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-semibold">Start emergency assistance?</h2>
            <p className="text-sm text-muted-foreground">
              We will show your emergency actions and prepare your medical card. Nothing is sent
              automatically.
            </p>
            <div className="grid gap-2">
              <Button
                className="h-12 rounded-2xl bg-emergency text-emergency-foreground hover:bg-emergency/90"
                onClick={() => {
                  setConfirmed(true);
                  onLogged("SOS activated");
                }}
              >
                Yes, I need help
              </Button>
              <Button variant="ghost" className="h-11" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Emergency actions</h2>
            <p className="text-xs text-muted-foreground">
              Prototype: emergency services are not contacted automatically. Use your phone dialer for
              real emergencies.
            </p>

            <a
              href="tel:112"
              onClick={() => onLogged("Called emergency number 112")}
              className="flex items-center gap-3 rounded-2xl bg-emergency-soft px-4 py-3 text-left"
            >
              <Phone className="h-5 w-5 text-emergency" />
              <div>
                <p className="font-semibold">Call emergency service (112)</p>
                <p className="text-xs text-muted-foreground">Opens your phone dialer</p>
              </div>
            </a>

            <button
              onClick={async () => {
                const loc = await EmergencyService.currentLocationText();
                setLocation(loc);
                onLogged("Shared location with trusted contact");
                if (navigator.share) {
                  navigator
                    .share({ title: "My emergency location", text: loc })
                    .catch(() => toast.info("Location ready to copy below"));
                } else {
                  await navigator.clipboard?.writeText(loc).catch(() => {});
                  toast.success("Location copied — paste it to your contact");
                }
              }}
              className="flex w-full items-center gap-3 rounded-2xl bg-brand-soft px-4 py-3 text-left"
            >
              <MapPin className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold">Share my location</p>
                <p className="text-xs text-muted-foreground">
                  {location ?? "Uses your device location, with your permission"}
                </p>
              </div>
            </button>

            <Link
              to="/app/records/emergency-card"
              onClick={() => {
                onLogged("Opened emergency medical card");
                onClose();
              }}
              className="flex items-center gap-3 rounded-2xl bg-sage-soft px-4 py-3 text-left"
            >
              <HeartPulse className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold">View emergency medical card</p>
                <p className="text-xs text-muted-foreground">Blood group, allergies, key conditions</p>
              </div>
            </Link>

            {primary ? (
              <a
                href={`tel:${primary.phone.replace(/\s/g, "")}`}
                onClick={() => onLogged(`Called emergency contact ${primary.name}`)}
                className="flex items-center gap-3 rounded-2xl bg-warm-soft px-4 py-3 text-left"
              >
                <UserRound className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold">Call {primary.name}</p>
                  <p className="text-xs text-muted-foreground">{primary.phone}</p>
                </div>
              </a>
            ) : (
              <Link
                to="/app/profile"
                onClick={onClose}
                className="flex items-center gap-3 rounded-2xl bg-warm-soft px-4 py-3 text-left"
              >
                <UserRound className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold">Add an emergency contact</p>
                  <p className="text-xs text-muted-foreground">So we can reach someone for you</p>
                </div>
              </Link>
            )}

            <p className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4" /> Every SOS action is written to your activity log.
            </p>
            <Button variant="ghost" className="w-full" onClick={onClose}>
              Close
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
