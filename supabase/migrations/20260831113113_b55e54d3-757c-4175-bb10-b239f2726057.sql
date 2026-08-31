
-- ROLES
CREATE TYPE public.app_role AS ENUM ('patient','doctor','admin');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT 'New User',
  email text,
  phone text,
  dob date,
  gender text,
  blood_group text,
  address text,
  abha_id text,
  universal_id text NOT NULL DEFAULT ('ELX-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- CONSENT (declared early; used by policies)
CREATE TABLE public.consent_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_name text NOT NULL DEFAULT 'Doctor',
  reason text NOT NULL DEFAULT 'Consultation review',
  requested_categories text[] NOT NULL DEFAULT '{}',
  approved_categories text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consent_requests TO authenticated;
GRANT ALL ON public.consent_requests TO service_role;
ALTER TABLE public.consent_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_consent(_doctor uuid, _patient uuid, _category text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.consent_requests c
    WHERE c.doctor_user_id = _doctor
      AND c.patient_id = _patient
      AND c.status = 'approved'
      AND _category = ANY (c.approved_categories)
      AND (c.expires_at IS NULL OR c.expires_at > now())
  )
$$;

CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.consent_requests c WHERE c.patient_id = profiles.id AND c.doctor_user_id = auth.uid() AND c.status='approved')
    OR EXISTS (SELECT 1 FROM public.consent_requests c WHERE c.patient_id = profiles.id AND c.doctor_user_id = auth.uid())
    OR public.has_role(profiles.id,'doctor'));
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles admin delete" ON public.profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "roles read own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "roles insert own" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND role <> 'admin');

CREATE POLICY "consent patient all" ON public.consent_requests FOR ALL TO authenticated
  USING (patient_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (patient_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "consent doctor read" ON public.consent_requests FOR SELECT TO authenticated USING (doctor_user_id = auth.uid());
CREATE POLICY "consent doctor create" ON public.consent_requests FOR INSERT TO authenticated
  WITH CHECK (doctor_user_id = auth.uid() AND public.has_role(auth.uid(),'doctor') AND status = 'pending');

-- DIRECTORY (public reference data)
CREATE TABLE public.hospitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, address text NOT NULL, city text NOT NULL DEFAULT 'Bengaluru',
  phone text, distance_km numeric NOT NULL DEFAULT 2.5, emergency boolean NOT NULL DEFAULT true,
  specialties text[] NOT NULL DEFAULT '{}', lat numeric, lng numeric, is_demo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.pharmacies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, address text NOT NULL, city text NOT NULL DEFAULT 'Bengaluru',
  phone text, distance_km numeric NOT NULL DEFAULT 1.2, open_24x7 boolean NOT NULL DEFAULT false,
  opening_hours text NOT NULL DEFAULT '9:00 AM - 10:00 PM', lat numeric, lng numeric,
  is_demo boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.laboratories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, address text NOT NULL, city text NOT NULL DEFAULT 'Bengaluru',
  phone text, distance_km numeric NOT NULL DEFAULT 3.1, home_collection boolean NOT NULL DEFAULT true,
  kinds text[] NOT NULL DEFAULT '{test}', lat numeric, lng numeric,
  is_demo boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.lab_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id uuid NOT NULL REFERENCES public.laboratories(id) ON DELETE CASCADE,
  name text NOT NULL, kind text NOT NULL DEFAULT 'test', price numeric NOT NULL DEFAULT 500,
  prep_note text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL, specialty text NOT NULL, qualification text NOT NULL DEFAULT 'MBBS',
  hospital_id uuid REFERENCES public.hospitals(id) ON DELETE SET NULL,
  experience_years int NOT NULL DEFAULT 5, fee numeric NOT NULL DEFAULT 500,
  rating numeric NOT NULL DEFAULT 4.5, bio text, languages text[] NOT NULL DEFAULT '{English}',
  is_demo boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.medicines_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, generic_name text, form text NOT NULL DEFAULT 'Tablet',
  used_for text NOT NULL DEFAULT '', common_dosage text, price numeric NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.first_aid_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL, title text NOT NULL, summary text NOT NULL DEFAULT '',
  do_steps text[] NOT NULL DEFAULT '{}', avoid_steps text[] NOT NULL DEFAULT '{}',
  seek_help text NOT NULL DEFAULT '', sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.hospitals, public.pharmacies, public.laboratories, public.lab_services, public.doctors, public.medicines_catalog, public.first_aid_articles TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.hospitals, public.pharmacies, public.laboratories, public.lab_services, public.doctors, public.medicines_catalog, public.first_aid_articles TO authenticated;
GRANT ALL ON public.hospitals, public.pharmacies, public.laboratories, public.lab_services, public.doctors, public.medicines_catalog, public.first_aid_articles TO service_role;

ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laboratories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicines_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.first_aid_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hospitals public read" ON public.hospitals FOR SELECT USING (true);
CREATE POLICY "hospitals admin write" ON public.hospitals FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "pharmacies public read" ON public.pharmacies FOR SELECT USING (true);
CREATE POLICY "pharmacies admin write" ON public.pharmacies FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "labs public read" ON public.laboratories FOR SELECT USING (true);
CREATE POLICY "labs admin write" ON public.laboratories FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "lab services public read" ON public.lab_services FOR SELECT USING (true);
CREATE POLICY "lab services admin write" ON public.lab_services FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "doctors public read" ON public.doctors FOR SELECT USING (true);
CREATE POLICY "doctors admin write" ON public.doctors FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "doctors self update" ON public.doctors FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "doctors self claim" ON public.doctors FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "meds catalog public read" ON public.medicines_catalog FOR SELECT USING (true);
CREATE POLICY "meds catalog admin write" ON public.medicines_catalog FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "first aid public read" ON public.first_aid_articles FOR SELECT USING (true);
CREATE POLICY "first aid admin write" ON public.first_aid_articles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- MEDICAL RECORDS
CREATE TABLE public.medical_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'consultation',
  title text NOT NULL,
  description text,
  record_date date NOT NULL DEFAULT current_date,
  provider text,
  doctor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  file_url text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medical_records TO authenticated;
GRANT ALL ON public.medical_records TO service_role;
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "records patient all" ON public.medical_records FOR ALL TO authenticated
  USING (patient_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (patient_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "records doctor consented read" ON public.medical_records FOR SELECT TO authenticated
  USING (public.has_consent(auth.uid(), patient_id, category));
CREATE POLICY "records doctor consented insert" ON public.medical_records FOR INSERT TO authenticated
  WITH CHECK (doctor_user_id = auth.uid() AND public.has_consent(auth.uid(), patient_id, category));

-- MEDICINES + REMINDERS
CREATE TABLE public.medicines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL, dosage text NOT NULL DEFAULT '1 tablet',
  frequency text NOT NULL DEFAULT 'Once daily',
  start_date date NOT NULL DEFAULT current_date, end_date date,
  reminder_time time NOT NULL DEFAULT '09:00', notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medicines TO authenticated;
GRANT ALL ON public.medicines TO service_role;
ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "medicines patient all" ON public.medicines FOR ALL TO authenticated
  USING (patient_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (patient_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "medicines doctor consented read" ON public.medicines FOR SELECT TO authenticated
  USING (public.has_consent(auth.uid(), patient_id, 'medicines'));

CREATE TABLE public.reminder_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id uuid NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'upcoming',
  acted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminder_logs TO authenticated;
GRANT ALL ON public.reminder_logs TO service_role;
ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reminders patient all" ON public.reminder_logs FOR ALL TO authenticated
  USING (patient_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (patient_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- BOOKINGS
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  doctor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  slot_at timestamptz NOT NULL,
  mode text NOT NULL DEFAULT 'In-person',
  reason text, status text NOT NULL DEFAULT 'pending',
  notes text, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appointments patient all" ON public.appointments FOR ALL TO authenticated
  USING (patient_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (patient_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "appointments doctor read" ON public.appointments FOR SELECT TO authenticated
  USING (doctor_user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = appointments.doctor_id AND d.user_id = auth.uid()));
CREATE POLICY "appointments doctor update" ON public.appointments FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = appointments.doctor_id AND d.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = appointments.doctor_id AND d.user_id = auth.uid()));

CREATE TABLE public.service_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lab_id uuid NOT NULL REFERENCES public.laboratories(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.lab_services(id) ON DELETE SET NULL,
  service_name text NOT NULL, kind text NOT NULL DEFAULT 'test',
  price numeric NOT NULL DEFAULT 0, slot_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'booked', created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_bookings TO authenticated;
GRANT ALL ON public.service_bookings TO service_role;
ALTER TABLE public.service_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bookings patient all" ON public.service_bookings FOR ALL TO authenticated
  USING (patient_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (patient_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- EMERGENCY
CREATE TABLE public.emergency_cards (
  patient_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  blood_group text, allergies text[] NOT NULL DEFAULT '{}',
  conditions text[] NOT NULL DEFAULT '{}', current_medicines text[] NOT NULL DEFAULT '{}',
  notes text, visible_fields text[] NOT NULL DEFAULT '{name,universal_id,blood_group,allergies,conditions,current_medicines,emergency_contact,notes}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emergency_cards TO authenticated;
GRANT ALL ON public.emergency_cards TO service_role;
ALTER TABLE public.emergency_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "emergency card owner" ON public.emergency_cards FOR ALL TO authenticated
  USING (patient_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (patient_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.emergency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL, phone text NOT NULL, relation text NOT NULL DEFAULT 'Family',
  is_primary boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emergency_contacts TO authenticated;
GRANT ALL ON public.emergency_contacts TO service_role;
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "emergency contacts owner" ON public.emergency_contacts FOR ALL TO authenticated
  USING (patient_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (patient_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- AUDIT + NOTIFICATIONS + AI
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name text NOT NULL DEFAULT 'System',
  actor_role text NOT NULL DEFAULT 'patient',
  patient_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL, resource text NOT NULL DEFAULT '',
  consent_status text, details text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit read own" ON public.audit_logs FOR SELECT TO authenticated
  USING (patient_id = auth.uid() OR actor_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "audit insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL, body text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'info', read boolean NOT NULL DEFAULT false,
  link text, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications owner" ON public.notifications FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notifications create for patient" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'doctor') OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  context_label text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.ai_messages TO authenticated;
GRANT ALL ON public.ai_messages TO service_role;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai messages owner" ON public.ai_messages FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- DEMO SEED FOR NEW PATIENTS
CREATE OR REPLACE FUNCTION public.seed_patient_demo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d_id uuid; d_name text; lab_id uuid; med_id uuid;
BEGIN
  SELECT id, full_name INTO d_id, d_name FROM public.doctors ORDER BY created_at LIMIT 1;
  SELECT id INTO lab_id FROM public.laboratories ORDER BY created_at LIMIT 1;

  INSERT INTO public.medical_records (patient_id, category, title, description, record_date, provider, is_demo, details) VALUES
    (NEW.id,'consultation','General Physician Consultation','Routine check-up. Mild seasonal cough, advised rest and hydration.', current_date - 40, 'City Care Hospital', true, '{"vitals":{"bp":"120/80","pulse":"76 bpm","temp":"98.4 F"}}'),
    (NEW.id,'prescription','Prescription - Cough & Fever','Paracetamol 500mg twice daily for 3 days. Cetirizine 10mg at night for 5 days.', current_date - 40, 'Dr. Ananya Rao', true, '{"medicines":[{"name":"Paracetamol 500mg","dose":"1 tablet","freq":"Twice daily"},{"name":"Cetirizine 10mg","dose":"1 tablet","freq":"At night"}]}'),
    (NEW.id,'lab_report','Complete Blood Count (CBC)','All values within normal range except slightly low Vitamin D.', current_date - 25, 'MedLab Diagnostics', true, '{"results":[{"test":"Haemoglobin","value":"13.8 g/dL","range":"13-17"},{"test":"WBC","value":"7,200 /uL","range":"4000-11000"},{"test":"Platelets","value":"2.4 lakh/uL","range":"1.5-4.1"},{"test":"Vitamin D","value":"18 ng/mL","range":"30-100"}]}'),
    (NEW.id,'scan_report','Chest X-Ray (PA view)','No active lung disease detected. Normal cardiac silhouette.', current_date - 20, 'Sunrise Imaging Centre', true, '{}'),
    (NEW.id,'medical_history','Childhood Asthma','Diagnosed at age 9, no episodes in the last 6 years.', current_date - 900, 'Family record', true, '{}'),
    (NEW.id,'allergy','Allergy: Penicillin','Skin rash observed after penicillin course in 2019.', current_date - 700, 'City Care Hospital', true, '{}');

  INSERT INTO public.medicines (patient_id, name, dosage, frequency, start_date, end_date, reminder_time, notes)
    VALUES (NEW.id,'Vitamin D3 60K','1 capsule','Once weekly', current_date - 10, current_date + 50, '09:00','Take after breakfast')
    RETURNING id INTO med_id;
  INSERT INTO public.reminder_logs (medicine_id, patient_id, scheduled_at, status)
    VALUES (med_id, NEW.id, (current_date + 1) + time '09:00', 'upcoming');
  INSERT INTO public.medicines (patient_id, name, dosage, frequency, start_date, reminder_time, notes)
    VALUES (NEW.id,'Cetirizine 10mg','1 tablet','Once daily', current_date - 3, '21:00','For seasonal allergy')
    RETURNING id INTO med_id;
  INSERT INTO public.reminder_logs (medicine_id, patient_id, scheduled_at, status)
    VALUES (med_id, NEW.id, current_date + time '21:00', 'upcoming');

  IF d_id IS NOT NULL THEN
    INSERT INTO public.appointments (patient_id, doctor_id, slot_at, reason, status)
    VALUES (NEW.id, d_id, now() + interval '3 days', 'Follow-up consultation', 'confirmed');
  END IF;
  IF lab_id IS NOT NULL THEN
    INSERT INTO public.service_bookings (patient_id, lab_id, service_name, kind, price, slot_at, status)
    VALUES (NEW.id, lab_id, 'Vitamin D Total', 'test', 1200, now() + interval '5 days', 'booked');
  END IF;

  INSERT INTO public.emergency_cards (patient_id, blood_group, allergies, conditions, current_medicines, notes)
    VALUES (NEW.id, COALESCE(NEW.blood_group,'O+'), ARRAY['Penicillin','Dust'], ARRAY['Childhood asthma (inactive)'], ARRAY['Vitamin D3 60K','Cetirizine 10mg'], 'Carries inhaler during pollen season.');
  INSERT INTO public.emergency_contacts (patient_id, name, phone, relation, is_primary)
    VALUES (NEW.id, 'Meera (Sister)', '+91 98800 11223', 'Sibling', true);

  INSERT INTO public.notifications (user_id, title, body, kind, link) VALUES
    (NEW.id, 'Welcome to ELIXIR', 'Your Universal Patient ID is ready. Sample health data has been added for the demo.', 'info', '/app'),
    (NEW.id, 'Medicine reminder set', 'Cetirizine 10mg at 9:00 PM today.', 'reminder', '/app/medicines');
  RETURN NEW;
END; $$;

CREATE TRIGGER seed_patient_demo_trigger AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.seed_patient_demo();

-- DIRECTORY DEMO DATA
INSERT INTO public.hospitals (name,address,phone,distance_km,emergency,specialties,lat,lng) VALUES
 ('City Care Hospital','12 MG Road, Bengaluru','+91 80 4000 1122',1.8,true,ARRAY['Cardiology','General Medicine','Orthopaedics','Paediatrics'],12.9752,77.6060),
 ('Sunrise Multispeciality','45 Indiranagar 100ft Road, Bengaluru','+91 80 4000 3344',3.4,true,ARRAY['Neurology','Dermatology','ENT','General Surgery'],12.9719,77.6412),
 ('Green Valley Clinic','8 Jayanagar 4th Block, Bengaluru','+91 80 4000 5566',5.2,false,ARRAY['General Medicine','Diabetology'],12.9250,77.5938),
 ('Lakeside Womens & Child Hospital','21 Ulsoor Lake Road, Bengaluru','+91 80 4000 7788',2.6,true,ARRAY['Obstetrics','Gynaecology','Paediatrics'],12.9820,77.6210);

INSERT INTO public.pharmacies (name,address,phone,distance_km,open_24x7,opening_hours,lat,lng) VALUES
 ('HealthPlus Pharmacy','3 MG Road, Bengaluru','+91 80 2222 1010',0.6,true,'Open 24 hours',12.9740,77.6070),
 ('Wellness Chemists','19 Koramangala 5th Block, Bengaluru','+91 80 2222 2020',2.9,false,'8:00 AM - 11:00 PM',12.9345,77.6260),
 ('Care & Cure Medicals','7 Jayanagar, Bengaluru','+91 80 2222 3030',4.8,false,'9:00 AM - 10:00 PM',12.9260,77.5930);

INSERT INTO public.laboratories (name,address,phone,distance_km,home_collection,kinds,lat,lng) VALUES
 ('MedLab Diagnostics','22 Richmond Road, Bengaluru','+91 80 3333 1010',1.4,true,ARRAY['test'],12.9660,77.5990),
 ('Sunrise Imaging Centre','45 Indiranagar, Bengaluru','+91 80 3333 2020',3.5,false,ARRAY['scan'],12.9715,77.6400),
 ('Precision Health Labs','60 Whitefield Main Road, Bengaluru','+91 80 3333 3030',9.1,true,ARRAY['test','scan'],12.9698,77.7500);

INSERT INTO public.lab_services (lab_id,name,kind,price,prep_note)
SELECT id,'Complete Blood Count (CBC)','test',450,'No fasting required' FROM public.laboratories WHERE name='MedLab Diagnostics'
UNION ALL SELECT id,'Vitamin D Total','test',1200,'No fasting required' FROM public.laboratories WHERE name='MedLab Diagnostics'
UNION ALL SELECT id,'Lipid Profile','test',700,'12 hours fasting' FROM public.laboratories WHERE name='MedLab Diagnostics'
UNION ALL SELECT id,'Thyroid Profile (T3 T4 TSH)','test',600,'Morning sample preferred' FROM public.laboratories WHERE name='MedLab Diagnostics'
UNION ALL SELECT id,'HbA1c','test',550,'No fasting required' FROM public.laboratories WHERE name='Precision Health Labs'
UNION ALL SELECT id,'Liver Function Test','test',800,'8 hours fasting' FROM public.laboratories WHERE name='Precision Health Labs'
UNION ALL SELECT id,'Ultrasound Abdomen','scan',1500,'Come with a full bladder' FROM public.laboratories WHERE name='Precision Health Labs'
UNION ALL SELECT id,'Chest X-Ray (PA view)','scan',400,'Remove metal objects' FROM public.laboratories WHERE name='Sunrise Imaging Centre'
UNION ALL SELECT id,'MRI Brain (Plain)','scan',6500,'Inform staff about implants' FROM public.laboratories WHERE name='Sunrise Imaging Centre'
UNION ALL SELECT id,'CT Scan Chest','scan',4200,'No food 4 hours before' FROM public.laboratories WHERE name='Sunrise Imaging Centre';

INSERT INTO public.doctors (full_name,specialty,qualification,hospital_id,experience_years,fee,rating,bio,languages)
SELECT 'Dr. Ananya Rao','General Medicine','MBBS, MD',(SELECT id FROM public.hospitals WHERE name='City Care Hospital'),12,600,4.8,'Family physician focused on preventive care and chronic disease management.',ARRAY['English','Kannada','Hindi']
UNION ALL SELECT 'Dr. Vikram Nair','Cardiology','MBBS, DM Cardiology',(SELECT id FROM public.hospitals WHERE name='City Care Hospital'),18,1200,4.9,'Interventional cardiologist with special interest in heart failure care.',ARRAY['English','Malayalam']
UNION ALL SELECT 'Dr. Sneha Kulkarni','Dermatology','MBBS, MD Dermatology',(SELECT id FROM public.hospitals WHERE name='Sunrise Multispeciality'),9,800,4.7,'Treats skin, hair and allergy related conditions.',ARRAY['English','Marathi','Hindi']
UNION ALL SELECT 'Dr. Imran Sheikh','Orthopaedics','MBBS, MS Ortho',(SELECT id FROM public.hospitals WHERE name='City Care Hospital'),14,900,4.6,'Sports injuries, joint pain and fracture care.',ARRAY['English','Hindi','Urdu']
UNION ALL SELECT 'Dr. Latha Menon','Paediatrics','MBBS, DCH',(SELECT id FROM public.hospitals WHERE name='Lakeside Womens & Child Hospital'),20,700,4.9,'Child health, vaccination and growth monitoring.',ARRAY['English','Tamil']
UNION ALL SELECT 'Dr. Rohit Verma','Neurology','MBBS, DM Neurology',(SELECT id FROM public.hospitals WHERE name='Sunrise Multispeciality'),11,1100,4.5,'Headache, epilepsy and stroke follow-up care.',ARRAY['English','Hindi']
UNION ALL SELECT 'Dr. Priya Desai','Diabetology','MBBS, Fellowship in Diabetology',(SELECT id FROM public.hospitals WHERE name='Green Valley Clinic'),8,500,4.6,'Diabetes management, nutrition and lifestyle counselling.',ARRAY['English','Gujarati','Hindi'];

INSERT INTO public.medicines_catalog (name,generic_name,form,used_for,common_dosage,price) VALUES
 ('Paracetamol 500mg','Paracetamol','Tablet','Fever and mild pain relief','1 tablet every 6-8 hours as needed',25),
 ('Cetirizine 10mg','Cetirizine','Tablet','Allergy, running nose, itching','1 tablet at night',30),
 ('Vitamin D3 60K','Cholecalciferol','Capsule','Vitamin D deficiency','1 capsule weekly',85),
 ('Amoxicillin 500mg','Amoxicillin','Capsule','Bacterial infections (prescription only)','As prescribed by doctor',110),
 ('Pantoprazole 40mg','Pantoprazole','Tablet','Acidity and reflux','1 tablet before breakfast',95),
 ('Metformin 500mg','Metformin','Tablet','Type 2 diabetes','As prescribed by doctor',60),
 ('ORS Sachet','Oral Rehydration Salts','Powder','Dehydration due to vomiting or loose motions','1 sachet in 1 litre water',22),
 ('Salbutamol Inhaler','Salbutamol','Inhaler','Asthma relief (prescription only)','As prescribed by doctor',210);

INSERT INTO public.first_aid_articles (category,title,summary,do_steps,avoid_steps,seek_help,sort_order) VALUES
 ('Cuts and wounds','Minor cuts and bleeding','Simple steps to clean and cover a small wound.',
  ARRAY['Wash your hands before touching the wound','Rinse the wound gently with clean running water','Press with a clean cloth for 5-10 minutes to stop bleeding','Apply a sterile dressing or bandage','Keep the dressing clean and dry'],
  ARRAY['Do not use cotton wool directly on the wound','Do not remove a deeply embedded object','Do not ignore dirt left inside the wound'],
  'Bleeding does not stop after 10 minutes, the wound is deep or gaping, there is a foreign object inside, or signs of infection appear (swelling, pus, fever).',1),
 ('Burns','Minor burns and scalds','Cooling a burn correctly limits damage.',
  ARRAY['Move the person away from the heat source','Cool the burn under cool running water for 20 minutes','Remove rings or tight items near the burn early','Cover loosely with cling film or a clean non-fluffy cloth','Keep the person warm'],
  ARRAY['Do not apply ice, toothpaste, butter or oil','Do not burst blisters','Do not use adhesive dressings on the burn'],
  'The burn is larger than the palm, involves face, hands, feet or genitals, is deep or white/charred, or the person is a child or elderly.',2),
 ('Nosebleed','Nosebleed (epistaxis)','Most nosebleeds stop with correct pressure.',
  ARRAY['Sit upright and lean slightly forward','Pinch the soft part of the nose for 10 minutes without releasing','Breathe through the mouth','Apply a cold pack to the bridge of the nose','Rest quietly afterwards'],
  ARRAY['Do not tilt the head back','Do not lie down','Do not blow the nose for several hours'],
  'Bleeding lasts more than 20 minutes, follows a head injury, is very heavy, or the person is on blood thinners.',3),
 ('Sprains','Sprains and strains','Use the R.I.C.E approach in the first 48 hours.',
  ARRAY['Rest the injured joint','Apply an ice pack wrapped in cloth for 15-20 minutes','Use a compression bandage that is snug but not tight','Elevate the limb above heart level when resting'],
  ARRAY['Do not apply heat in the first 48 hours','Do not massage the injury vigorously','Do not continue sports on the injured joint'],
  'You cannot bear weight, the joint looks deformed, there is numbness, or pain and swelling worsen after 48 hours.',4),
 ('Minor injuries','Bruises and minor bumps','Reduce swelling early and watch for warning signs.',
  ARRAY['Apply a cold pack for 15 minutes','Rest and elevate the area','Use simple pain relief if suitable for the person'],
  ARRAY['Do not press or massage a fresh bruise','Do not ignore bruising that appears without any injury'],
  'Bruising is very large, appears without cause, or is accompanied by severe pain or restricted movement.',5),
 ('Choking','Choking in an adult or child','Act quickly when someone cannot speak, cough or breathe.',
  ARRAY['Ask "Are you choking?" and encourage coughing if they can','Give up to 5 firm back blows between the shoulder blades','Give up to 5 abdominal thrusts if back blows fail','Alternate back blows and abdominal thrusts','Call emergency services if the blockage does not clear'],
  ARRAY['Do not perform abdominal thrusts on an infant under 1 year','Do not blindly sweep the mouth with your fingers','Do not leave the person alone'],
  'Call emergency services immediately if the person cannot breathe, becomes limp, or loses consciousness.',6),
 ('Fever/general care','Fever care at home','Comfort measures while monitoring the temperature.',
  ARRAY['Rest and drink plenty of fluids','Wear light clothing and keep the room ventilated','Sponge with lukewarm water if uncomfortable','Record the temperature every few hours'],
  ARRAY['Do not use cold or ice water sponging','Do not combine multiple fever medicines without advice','Do not use antibiotics without a prescription'],
  'Fever above 39C that does not settle, lasts more than 3 days, fever in an infant under 3 months, rash, stiff neck, confusion or breathing difficulty.',7),
 ('Emergency situations','Unresponsive person','What to do while waiting for emergency help.',
  ARRAY['Check for danger before approaching','Check response and breathing','Call emergency services immediately','If breathing, place in the recovery position','If not breathing, start chest compressions if you are trained','Stay with the person until help arrives'],
  ARRAY['Do not give food or water','Do not move the person if a spinal injury is suspected','Do not delay calling for help'],
  'Always call emergency services immediately for an unresponsive person, chest pain, severe bleeding, stroke signs or difficulty breathing.',8);
