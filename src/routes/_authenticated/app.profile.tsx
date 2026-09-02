import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Plus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import * as PatientService from "@/services/patient";
import * as EmergencyService from "@/services/emergency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/app/profile")({
  head: () => ({
    meta: [
      { title: "My profile · ELIXIR" },
      { name: "description", content: "Your Universal User ID, ABHA linking and emergency contacts." },
      { property: "og:title", content: "My profile · ELIXIR" },
      { property: "og:description", content: "Manage your identity and emergency contacts." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, role } = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    dob: "",
    gender: "",
    blood_group: "",
    address: "",
    abha_id: "",
  });
  const [busy, setBusy] = useState(false);
  const [contact, setContact] = useState({ name: "", phone: "", relation: "Family" });

  useEffect(() => {
    if (profile)
      setForm({
        full_name: profile.full_name ?? "",
        phone: profile.phone ?? "",
        dob: profile.dob ?? "",
        gender: profile.gender ?? "",
        blood_group: profile.blood_group ?? "",
        address: profile.address ?? "",
        abha_id: profile.abha_id ?? "",
      });
  }, [profile]);

  const contacts = useQuery({
    queryKey: ["emergency-contacts", user?.id],
    queryFn: () => EmergencyService.listContacts(user!.id),
    enabled: !!user,
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      await PatientService.updateProfile(user.id, {
        ...form,
        dob: form.dob || null,
      });
      await qc.invalidateQueries({ queryKey: ["profile", user.id] });
      toast.success("Profile updated");
    } catch {
      toast.error("Could not update your profile");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">My profile</h1>
          <p className="text-sm text-muted-foreground capitalize">Signed in as {role}</p>
        </div>
        <Button
          variant="outline"
          className="rounded-2xl"
          onClick={async () => {
            await qc.cancelQueries();
            qc.clear();
            await supabase.auth.signOut();
            navigate({ to: "/login", replace: true });
          }}
        >
          <LogOut className="mr-1 h-4 w-4" /> Sign out
        </Button>
      </div>

      <section className="card-soft bg-brand-soft p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Universal User ID
        </p>
        <p className="font-mono text-xl">{profile?.universal_id}</p>
        <p className="text-sm text-muted-foreground">
          ABHA ID: {profile?.abha_id ? profile.abha_id : "Not linked"}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          ELIXIR is ABHA-compatible: your ID is designed to link with ABDM in future. This prototype is
          not connected to the live ABDM network.
        </p>
      </section>

      <form className="card-soft space-y-3 p-5" onSubmit={save}>
        <h2 className="text-lg font-semibold">Personal details</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Full name</Label>
            <Input id="full_name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 …" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dob">Date of birth</Label>
            <Input id="dob" type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gender">Gender</Label>
            <Input id="gender" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="blood">Blood group</Label>
            <Input id="blood" value={form.blood_group} onChange={(e) => setForm({ ...form, blood_group: e.target.value })} placeholder="O+" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="abha">ABHA ID (optional)</Label>
            <Input id="abha" value={form.abha_id} onChange={(e) => setForm({ ...form, abha_id: e.target.value })} placeholder="14-digit ABHA number" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="address">Address</Label>
          <Input id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <Button type="submit" className="rounded-2xl" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </Button>
      </form>

      <section className="card-soft space-y-3 p-5">
        <h2 className="text-lg font-semibold">Emergency contacts</h2>
        {(contacts.data ?? []).length === 0 ? (
          <EmptyState icon={UserRound} title="No emergency contacts" description="Add someone we can show during an emergency." />
        ) : (
          <ul className="space-y-2">
            {(contacts.data ?? []).map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-2xl border p-3">
                <div className="flex-1">
                  <p className="font-medium">
                    {c.name} {c.is_primary && <span className="text-xs text-primary">· primary</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.relation} · {c.phone}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove contact"
                  onClick={async () => {
                    await EmergencyService.deleteContact(c.id);
                    await qc.invalidateQueries({ queryKey: ["emergency-contacts", user?.id] });
                    toast.success("Contact removed");
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form
          className="grid gap-2 sm:grid-cols-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!user) return;
            if (contact.name.length < 2 || contact.phone.length < 6) {
              toast.error("Enter a name and phone number");
              return;
            }
            await EmergencyService.addContact({
              patient_id: user.id,
              name: contact.name,
              phone: contact.phone,
              relation: contact.relation,
              is_primary: (contacts.data ?? []).length === 0,
            });
            await qc.invalidateQueries({ queryKey: ["emergency-contacts", user.id] });
            setContact({ name: "", phone: "", relation: "Family" });
            toast.success("Contact added");
          }}
        >
          <Input placeholder="Name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
          <Input placeholder="Phone" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
          <Input placeholder="Relation" value={contact.relation} onChange={(e) => setContact({ ...contact, relation: e.target.value })} />
          <Button type="submit" className="rounded-2xl">
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </form>
      </section>
    </div>
  );
}
