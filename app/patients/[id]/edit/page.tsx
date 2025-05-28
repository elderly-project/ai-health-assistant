'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/supabase/functions/_lib/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface PatientProfile {
  id: string;
  full_name: string | null;
  date_of_birth: string | null;
  phone_number: string | null;
  allergies: string[] | null;
  medical_conditions: string[] | null;
  emergency_contact: string | null;
  emergency_contact_phone: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export default function EditPatientPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<PatientProfile>({
    id: params.id,
    full_name: '',
    date_of_birth: null,
    phone_number: null,
    allergies: [],
    medical_conditions: [],
    emergency_contact: null,
    emergency_contact_phone: null,
  });
  
  // Format allergies and medical conditions for editing
  const [allergiesText, setAllergiesText] = useState('');
  const [medicalConditionsText, setMedicalConditionsText] = useState('');

  useEffect(() => {
    const fetchPatient = async () => {
      try {
        setLoading(true);
        
        // Fetch profile data
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', params.id)
          .single();
        
        if (error) {
          if (error.code === 'PGRST116') {
            // Record not found - we're creating a new profile
            console.log('No profile found, creating a new one');
            
            // Try to find the patient's name from relationships or auth records
            let patientName = null;
            
            // First check if there's a user in auth with this ID
            try {
              // Check user_profiles table first (in case there's a partial profile)
              const { data: userData, error: userError } = await supabase
                .from('user_profiles')
                .select('full_name')
                .eq('id', params.id);
                
              if (!userError && userData && userData.length > 0 && userData[0].full_name) {
                patientName = userData[0].full_name;
                console.log('Found name in user profiles:', patientName);
              } else {
                // Try to get from patient_relationships 
                const { data: relationshipData, error: relationshipError } = await supabase
                  .from('patient_relationships')
                  .select('patient_id')
                  .eq('patient_id', params.id)
                  .single();
                  
                if (!relationshipError && relationshipData) {
                  console.log('Found relationship for patient:', relationshipData);
                  
                  // Call the auth endpoint to get user info (if available in your app)
                  // We can't directly access auth.users from client, but we can check
                  // for any other source of the patient's name
                }
              }
            } catch (findNameError) {
              console.error('Error finding patient name:', findNameError);
            }
            
            // Set default profile with just the ID and use real name if found
            setProfile({
              id: params.id,
              full_name: patientName || '', // Empty string instead of placeholder ID
              date_of_birth: null,
              phone_number: null,
              allergies: [],
              medical_conditions: [],
              emergency_contact: null,
              emergency_contact_phone: null
            });
          } else {
            throw error;
          }
        } else {
          setProfile(data);
          
          // Format arrays as comma-separated strings for easier editing
          if (data.allergies && Array.isArray(data.allergies)) {
            setAllergiesText(data.allergies.join(', '));
          }
          
          if (data.medical_conditions && Array.isArray(data.medical_conditions)) {
            setMedicalConditionsText(data.medical_conditions.join(', '));
          }
        }
      } catch (error) {
        console.error('Error fetching patient profile:', error);
        toast({
          variant: 'destructive',
          description: 'Failed to load patient profile.',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPatient();
  }, [supabase, params.id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'allergies') {
      setAllergiesText(value);
    } else if (name === 'medical_conditions') {
      setMedicalConditionsText(value);
    } else {
      setProfile(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      
      // Validate required fields
      if (!profile.full_name || profile.full_name.trim() === '') {
        toast({
          variant: 'destructive',
          description: 'Patient name is required.',
        });
        setSaving(false);
        return;
      }
      
      // Convert comma-separated text back to arrays, ensuring they are never null
      const allergiesArray = allergiesText
        ? allergiesText.split(',').map(item => item.trim()).filter(Boolean)
        : [];
      
      const medicalConditionsArray = medicalConditionsText
        ? medicalConditionsText.split(',').map(item => item.trim()).filter(Boolean)
        : [];
      
      console.log('Preparing to save profile for patient ID:', params.id);
      console.log('Allergies array:', allergiesArray);
      console.log('Medical conditions array:', medicalConditionsArray);
      
      // Get current user to check permissions
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.error('Authentication error:', authError);
        throw new Error('You must be logged in to save a patient profile');
      }
      
      // Create a clean profile data object - simpler approach
      const profileData: {
        id: string;
        full_name: string;
        date_of_birth: string | null;
        phone_number: string | null;
        allergies: string[];
        medical_conditions: string[];
        emergency_contact: string | null;
        emergency_contact_phone: string | null;
        updated_at: string;
        created_at?: string;
      } = {
        id: params.id,
        full_name: profile.full_name,
        date_of_birth: profile.date_of_birth || null,
        phone_number: profile.phone_number || null,
        allergies: allergiesArray,
        medical_conditions: medicalConditionsArray,
        emergency_contact: profile.emergency_contact || null,
        emergency_contact_phone: profile.emergency_contact_phone || null,
        updated_at: new Date().toISOString()
      };
      
      // Always set created_at for new profiles
      if (isNewProfile) {
        profileData.created_at = new Date().toISOString();
      }
      
      console.log('Saving profile with data:', JSON.stringify(profileData, null, 2));
      
      // Check if this is a provider editing a patient or a user editing their own profile
      if (user.id === params.id) {
        // This is a user editing their own profile - use direct upsert
        console.log('User is editing their own profile');
        const { error } = await supabase
          .from('user_profiles')
          .upsert(profileData);
        
        if (error) {
          console.error('Database error on self-edit:', error);
          throw error;
        }
      } else {
        // This is a provider editing a patient - check relationship
        console.log('Provider is editing a patient profile');
        
        // First check if relationship exists
        const { data: relationshipData, error: relationshipError } = await supabase
          .from('patient_relationships')
          .select('*')
          .eq('provider_id', user.id)
          .eq('patient_id', params.id)
          .single();
        
        if (relationshipError) {
          console.error('Permission error:', relationshipError);
          throw new Error('You do not have permission to edit this patient profile');
        }
        
        try {
          // Try to use edge function to save with elevated permissions
          const { data: updateData, error: updateError } = await supabase.functions.invoke('update-patient-profile', {
            body: {
              profile: profileData,
              updatedBy: user.id
            }
          });
          
          if (updateError) {
            console.error('Function error:', updateError);
            throw updateError;
          }
          
          console.log('Function response:', updateData);
        } catch (funcError) {
          console.error('Edge function error or not available:', funcError);
          
          // Fallback to direct update - may still fail due to RLS
          console.warn('Falling back to direct update (may fail due to permissions)');
          const { error: directError } = await supabase
            .from('user_profiles')
            .upsert(profileData);
            
          if (directError) {
            console.error('Direct update error:', directError);
            throw new Error(`Permission error: ${directError.message}. Please contact your administrator.`);
          }
        }
      }
      
      console.log('Profile saved successfully');
      
      toast({
        description: isNewProfile 
          ? 'Patient profile created successfully.' 
          : 'Patient profile updated successfully.',
      });
      
      // Short delay before navigation
      setTimeout(() => {
        router.push(`/patients/${params.id}`);
      }, 1000);
    } catch (error) {
      console.error('Error updating patient profile:', error);
      toast({
        variant: 'destructive',
        description: `Failed to save patient profile: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setSaving(false);
    }
  };

  // Check if it's a new profile or editing an existing one
  const isNewProfile = !profile.full_name || profile.full_name === '';

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading patient profile...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href={`/patients/${params.id}`} className="flex items-center text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Patient Profile
        </Link>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-6">
          {isNewProfile ? 'Create Patient Profile' : 'Edit Patient Profile'}
        </h1>
        
        {isNewProfile && (
          <div className="bg-blue-50 p-4 rounded-md mb-6 border border-blue-200">
            <h2 className="text-sm font-medium text-blue-800 mb-2">Setting up a new patient profile</h2>
            <p className="text-sm text-blue-700">
              Please enter the patient's full name and as much information as you have available.
              The patient ID is automatically generated, but you need to provide a proper name.
            </p>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div>
            <h2 className="text-lg font-medium mb-4">Basic Information</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  name="full_name"
                  value={profile.full_name || ''}
                  onChange={handleChange}
                  className={`mt-1 ${!isNewProfile && "bg-gray-50"}`}
                  disabled={!isNewProfile ? true : false}
                  placeholder={isNewProfile ? "Enter patient name" : ""}
                />
                {!isNewProfile ? (
                  <p className="text-xs text-gray-500 mt-1">
                    Name cannot be changed
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">
                    Please enter the patient's full name
                  </p>
                )}
              </div>
              
              <div>
                <Label htmlFor="date_of_birth">Date of Birth</Label>
                <Input
                  id="date_of_birth"
                  name="date_of_birth"
                  type="date"
                  value={profile.date_of_birth || ''}
                  onChange={handleChange}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="phone_number">Phone Number</Label>
                <Input
                  id="phone_number"
                  name="phone_number"
                  value={profile.phone_number || ''}
                  onChange={handleChange}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          
          {/* Medical Information */}
          <div>
            <h2 className="text-lg font-medium mb-4">Medical Information</h2>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="medical_conditions">Medical Conditions</Label>
                <Textarea
                  id="medical_conditions"
                  name="medical_conditions"
                  value={medicalConditionsText || ''}
                  onChange={handleChange}
                  className="mt-1"
                  placeholder="Enter conditions separated by commas (e.g., Diabetes, Hypertension)"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Enter medical conditions separated by commas
                </p>
              </div>
              
              <div>
                <Label htmlFor="allergies">Allergies</Label>
                <Textarea
                  id="allergies"
                  name="allergies"
                  value={allergiesText || ''}
                  onChange={handleChange}
                  className="mt-1"
                  placeholder="Enter allergies separated by commas (e.g., Penicillin, Peanuts)"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Enter allergies separated by commas
                </p>
              </div>
            </div>
          </div>
          
          {/* Emergency Contact */}
          <div>
            <h2 className="text-lg font-medium mb-4">Emergency Contact</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="emergency_contact">Emergency Contact Name</Label>
                <Input
                  id="emergency_contact"
                  name="emergency_contact"
                  value={profile.emergency_contact || ''}
                  onChange={handleChange}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="emergency_contact_phone">Emergency Contact Phone</Label>
                <Input
                  id="emergency_contact_phone"
                  name="emergency_contact_phone"
                  value={profile.emergency_contact_phone || ''}
                  onChange={handleChange}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          
          <div className="pt-4 flex justify-end space-x-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => router.push(`/patients/${params.id}`)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
} 