
-- 1. Allow bookings at non-partner facilities
ALTER TABLE public.service_bookings ALTER COLUMN lab_id DROP NOT NULL;
ALTER TABLE public.service_bookings
  ADD COLUMN IF NOT EXISTS facility_name text,
  ADD COLUMN IF NOT EXISTS facility_address text,
  ADD COLUMN IF NOT EXISTS facility_place_id text,
  ADD COLUMN IF NOT EXISTS facility_kind text;

-- 2. Catalogue of tests and scans available anywhere
CREATE TABLE IF NOT EXISTS public.catalog_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('test','scan')),
  name text NOT NULL,
  info text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  prep_note text,
  duration_min integer NOT NULL DEFAULT 30,
  facility_kinds text[] NOT NULL DEFAULT ARRAY['hospitals','labs','scans'],
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.catalog_services TO authenticated;
GRANT SELECT ON public.catalog_services TO anon;
GRANT ALL ON public.catalog_services TO service_role;

ALTER TABLE public.catalog_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Catalogue is readable by everyone" ON public.catalog_services;
CREATE POLICY "Catalogue is readable by everyone"
  ON public.catalog_services FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.catalog_services (kind, name, info, price, prep_note, duration_min, facility_kinds, sort_order) VALUES
('test','Complete Blood Count (CBC)','Screens for anaemia, infection and overall blood health.',350,'No fasting needed.',15,ARRAY['hospitals','labs'],1),
('test','Fasting Blood Sugar','Measures blood glucose after an overnight fast.',150,'Fast for 8-10 hours before the test.',10,ARRAY['hospitals','labs'],2),
('test','HbA1c (3-month sugar)','Average blood sugar control over the last three months.',550,'No fasting needed.',10,ARRAY['hospitals','labs'],3),
('test','Lipid Profile','Cholesterol and triglycerides for heart risk assessment.',700,'Fast for 10-12 hours before the test.',15,ARRAY['hospitals','labs'],4),
('test','Thyroid Profile (T3 T4 TSH)','Checks thyroid gland function.',600,'Morning sample preferred.',15,ARRAY['hospitals','labs'],5),
('test','Liver Function Test','Assesses liver enzymes and bilirubin.',750,'Fast for 8 hours before the test.',15,ARRAY['hospitals','labs'],6),
('test','Kidney Function Test','Creatinine, urea and electrolytes.',700,'Drink normal water; no fasting required.',15,ARRAY['hospitals','labs'],7),
('test','Vitamin D (25-OH)','Detects vitamin D deficiency.',1200,'No preparation required.',10,ARRAY['hospitals','labs'],8),
('test','Vitamin B12','Checks B12 levels linked to fatigue and nerve health.',900,'No preparation required.',10,ARRAY['hospitals','labs'],9),
('test','Urine Routine','General screening for infection and kidney issues.',200,'First morning sample preferred.',10,ARRAY['hospitals','labs'],10),
('test','Dengue NS1 Antigen','Early detection of dengue infection.',850,'No preparation required.',15,ARRAY['hospitals','labs'],11),
('test','COVID-19 RT-PCR','Confirmatory test for COVID-19 infection.',500,'Avoid eating or drinking 30 minutes before.',15,ARRAY['hospitals','labs'],12),
('test','Full Body Health Checkup','Bundled panel covering blood, sugar, lipids, liver and kidney.',2499,'Fast for 10-12 hours before the visit.',60,ARRAY['hospitals','labs'],13),
('scan','X-Ray (Chest)','Basic imaging of lungs, heart and ribs.',450,'Remove metal objects and jewellery.',15,ARRAY['hospitals','scans','labs'],20),
('scan','Ultrasound (Abdomen)','Sound-wave imaging of abdominal organs.',1200,'Fast for 6 hours; drink water and hold urine.',30,ARRAY['hospitals','scans','labs'],21),
('scan','Ultrasound (Pelvis)','Imaging of the pelvic organs.',1300,'Come with a full bladder.',30,ARRAY['hospitals','scans','labs'],22),
('scan','CT Scan (Brain)','Detailed cross-sectional imaging of the brain.',3200,'Inform staff about allergies or pregnancy.',30,ARRAY['hospitals','scans'],23),
('scan','CT Scan (Chest)','Detailed imaging of the lungs and chest.',3800,'Fast for 4 hours if contrast is used.',30,ARRAY['hospitals','scans'],24),
('scan','MRI (Brain)','High-detail magnetic imaging of the brain.',6500,'No metal implants; inform staff beforehand.',45,ARRAY['hospitals','scans'],25),
('scan','MRI (Spine)','High-detail imaging of the spine and discs.',7000,'No metal implants; inform staff beforehand.',45,ARRAY['hospitals','scans'],26),
('scan','2D Echocardiogram','Ultrasound of the heart to assess pumping function.',2200,'No preparation required.',30,ARRAY['hospitals','scans'],27),
('scan','Mammography','Breast screening imaging.',2500,'Avoid deodorant or talc on the day.',30,ARRAY['hospitals','scans'],28),
('scan','Bone Density (DEXA)','Measures bone strength and osteoporosis risk.',2800,'Avoid calcium supplements for 24 hours.',30,ARRAY['hospitals','scans'],29)
ON CONFLICT DO NOTHING;
