-- Fix RLS policies for user_profiles to ensure providers can access patient profiles

-- Drop existing policies
DROP POLICY IF EXISTS "Providers can view their patients' profiles" ON user_profiles;

-- Recreate the policy with proper UUID casting
CREATE POLICY "Providers can view their patients' profiles"
ON user_profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM patient_relationships pr
    WHERE pr.patient_id = id
    AND pr.provider_id = auth.uid()::uuid
  )
);

-- Also ensure the patient_relationships policies work correctly
DROP POLICY IF EXISTS "Providers can view their own patient relationships" ON patient_relationships;

CREATE POLICY "Providers can view their own patient relationships"
ON patient_relationships
FOR SELECT
USING (provider_id = auth.uid()::uuid); 