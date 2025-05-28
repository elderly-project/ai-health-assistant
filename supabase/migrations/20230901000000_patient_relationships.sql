-- Create the patient_relationships table
CREATE TABLE IF NOT EXISTS patient_relationships (
  id BIGSERIAL PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL DEFAULT 'primary',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,

  UNIQUE(patient_id, provider_id)
);

-- Add RLS policies
ALTER TABLE patient_relationships ENABLE ROW LEVEL SECURITY;

-- Providers can see their own patient relationships
CREATE POLICY "Providers can view their own patient relationships"
ON patient_relationships
FOR SELECT
USING (provider_id::text = auth.uid());

-- Providers can insert relationships for themselves
CREATE POLICY "Providers can insert their own patient relationships"
ON patient_relationships
FOR INSERT
WITH CHECK (provider_id::text = auth.uid());

-- Providers can update their own patient relationships
CREATE POLICY "Providers can update their own patient relationships"
ON patient_relationships
FOR UPDATE
USING (provider_id::text = auth.uid())
WITH CHECK (provider_id::text = auth.uid());

-- Providers can delete their own patient relationships
CREATE POLICY "Providers can delete their own patient relationships"
ON patient_relationships
FOR DELETE
USING (provider_id::text = auth.uid());

-- Modify user_profiles to enable relationship-based access
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to see their own profile
CREATE POLICY "Users can view own profiles"
ON user_profiles
FOR SELECT
USING (id::text = auth.uid());

-- Allow providers to see profiles of their patients
CREATE POLICY "Providers can view their patients' profiles"
ON user_profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM patient_relationships pr
    WHERE pr.patient_id = id
    AND pr.provider_id::text = auth.uid()
  )
);

-- Allow users to update their own profiles
CREATE POLICY "Users can update own profiles"
ON user_profiles
FOR UPDATE
USING (id::text = auth.uid())
WITH CHECK (id::text = auth.uid());

-- Allow providers to insert profiles (needed when creating patient accounts)
CREATE POLICY "Anyone can insert profiles"
ON user_profiles
FOR INSERT
WITH CHECK (true); -- This is permissive but used in conjunction with server-side validation

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_patient_relationships_patient_id
ON patient_relationships(patient_id);

CREATE INDEX IF NOT EXISTS idx_patient_relationships_provider_id
ON patient_relationships(provider_id); 