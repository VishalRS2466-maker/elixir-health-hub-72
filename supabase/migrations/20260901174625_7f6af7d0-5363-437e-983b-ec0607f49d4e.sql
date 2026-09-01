-- Fix 1 & 2: profiles self read — remove pending-consent clause and doctor-role clause
DROP POLICY IF EXISTS "profiles self read" ON public.profiles;
CREATE POLICY "profiles self read" ON public.profiles
FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.consent_requests c
    WHERE c.patient_id = profiles.id
      AND c.doctor_user_id = auth.uid()
      AND c.status = 'approved'
      AND (c.expires_at IS NULL OR c.expires_at > now())
  )
);

-- Fix 3: notifications insert — require a real doctor-patient relationship
DROP POLICY IF EXISTS "notifications create for patient" ON public.notifications;
CREATE POLICY "notifications create for patient" ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (
    public.has_role(auth.uid(), 'doctor'::public.app_role)
    AND (
      EXISTS (
        SELECT 1 FROM public.consent_requests c
        WHERE c.doctor_user_id = auth.uid()
          AND c.patient_id = notifications.user_id
          AND c.status = 'approved'
          AND (c.expires_at IS NULL OR c.expires_at > now())
      )
      OR EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.doctor_id = auth.uid()
          AND a.patient_id = notifications.user_id
      )
    )
  )
);

-- Hardening: ensure fixed search_path on security definer helpers and drop PUBLIC/anon execute rights
ALTER FUNCTION public.has_role(uuid, public.app_role) SET search_path = public;
ALTER FUNCTION public.has_consent(uuid, uuid, text) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_consent(uuid, uuid, text) FROM PUBLIC, anon;