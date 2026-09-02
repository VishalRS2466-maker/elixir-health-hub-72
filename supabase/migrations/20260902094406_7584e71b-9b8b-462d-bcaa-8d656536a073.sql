DROP POLICY IF EXISTS "roles insert own" ON public.user_roles;
CREATE POLICY "roles insert own patient" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND role = 'patient'::app_role);

CREATE POLICY "roles admin insert" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "doctors self claim" ON public.doctors;
CREATE POLICY "doctors verified self claim" ON public.doctors
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.has_role(auth.uid(), 'doctor'::app_role));

DROP POLICY IF EXISTS "doctors self update" ON public.doctors;
CREATE POLICY "doctors verified self update" ON public.doctors
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND public.has_role(auth.uid(), 'doctor'::app_role))
  WITH CHECK (user_id = auth.uid() AND public.has_role(auth.uid(), 'doctor'::app_role));