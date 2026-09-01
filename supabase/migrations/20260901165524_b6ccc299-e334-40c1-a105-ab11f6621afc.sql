ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS google_place_id text;
ALTER TABLE public.pharmacies ADD COLUMN IF NOT EXISTS google_place_id text;
ALTER TABLE public.laboratories ADD COLUMN IF NOT EXISTS google_place_id text;
CREATE UNIQUE INDEX IF NOT EXISTS hospitals_google_place_id_key ON public.hospitals (google_place_id) WHERE google_place_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pharmacies_google_place_id_key ON public.pharmacies (google_place_id) WHERE google_place_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS laboratories_google_place_id_key ON public.laboratories (google_place_id) WHERE google_place_id IS NOT NULL;