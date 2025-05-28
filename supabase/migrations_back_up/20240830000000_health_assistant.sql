-- Create tables for health assistant

-- User health profiles
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  full_name TEXT,
  date_of_birth DATE,
  phone_number TEXT,
  emergency_contact TEXT,
  emergency_contact_phone TEXT,
  medical_conditions TEXT[],
  allergies TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Medications table
CREATE TABLE medications (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  prescribing_doctor TEXT,
  notes TEXT,
  document_id BIGINT REFERENCES documents(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Appointments table
CREATE TABLE appointments (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  doctor_name TEXT,
  location TEXT,
  appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view and update their own profiles"
  ON user_profiles
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can view their own medications"
  ON medications
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own medications"
  ON medications
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own medications"
  ON medications
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own medications"
  ON medications
  FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Users can view their own appointments"
  ON appointments
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own appointments"
  ON appointments
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own appointments"
  ON appointments
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own appointments"
  ON appointments
  FOR DELETE
  USING (user_id = auth.uid());

-- Triggers for updated_at fields
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_profiles_updated_at
BEFORE UPDATE ON user_profiles
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_medications_updated_at
BEFORE UPDATE ON medications
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
BEFORE UPDATE ON appointments
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

-- Functions to handle document-medication linking
CREATE OR REPLACE FUNCTION link_document_to_medication(document_id BIGINT, medication_name TEXT, user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE medications
  SET document_id = link_document_to_medication.document_id
  WHERE 
    user_id = link_document_to_medication.user_id AND
    name ILIKE '%' || link_document_to_medication.medication_name || '%';
END;
$$ LANGUAGE plpgsql; 