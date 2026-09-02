import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { doctorOverview } from "@/lib/doctor.functions";
import * as BookingService from "@/services/bookings";
import { Button } from "@/components/ui/button";
import { EmptyState, StatusChip } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/doctor/appointments")({
  component: DoctorAppointments,
});

function DoctorAppointments() {
  const qc = useQueryClient();
  const fn = useServerFn(doctorOverview);
  const overview = useQuery({ queryKey: ["doctor-overview"], queryFn: () => fn({}) });
  const appts = overview.data?.appointments ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Appointments</h1>
        <p className="text-sm text-muted-foreground">Bookings made with you, newest first.</p>
      </div>
      {overview.isLoading && <div className="h-32 animate-pulse rounded-2xl bg-muted" />}
      {!overview.isLoading && appts.length === 0 && (
        <EmptyState icon={CalendarDays} title="No appointments" description="Patient bookings will appear here." />
      )}
      {appts.map((a) => (
        <article key={a.id} className="card-soft flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="font-semibold">{a.patient_name}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(a.slot_at).toLocaleString()} · {a.mode}
              {a.reason ? ` · ${a.reason}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusChip status={a.status} />
            {a.status !== "completed" && (
              <Button
                size="sm"
                className="rounded-full"
                onClick={async () => {
                  await BookingService.setAppointmentStatus(a.id, "completed");
                  await qc.invalidateQueries({ queryKey: ["doctor-overview"] });
                  toast.success("Marked completed");
                }}
              >
                Complete
              </Button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
