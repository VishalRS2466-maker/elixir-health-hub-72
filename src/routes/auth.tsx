import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({ mode: z.enum(["signin", "signup"]).optional() });

/** Legacy entry point — kept so old links keep working. */
export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  beforeLoad: ({ search }) => {
    throw redirect({ to: search.mode === "signup" ? "/register" : "/login", replace: true });
  },
});
