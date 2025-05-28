'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';
import { Database } from '@/supabase/functions/_lib/database';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { PlusCircle, Edit, Trash2, User } from 'lucide-react';

interface PatientUser {
  id: string;
  email: string;
  created_at: string;
  profile?: {
    full_name: string | null;
    date_of_birth: string | null;
    phone_number: string | null;
  };
}

export default function PatientsPage() {
  const supabase = createClientComponentClient<Database>();
  const [patients, setPatients] = useState<PatientUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{id: string, email: string} | null>(null);
  const [debug, setDebug] = useState<string[]>([]);

  useEffect(() => {
    // Get the current user
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser({
          id: user.id,
          email: user.email || ''
        });
        addDebug(`Current user: ${user.email} (${user.id})`);
        return user.id;
      }
      addDebug('No user found');
      return null;
    };

    const addDebug = (message: string) => {
      setDebug(prev => [...prev, message]);
      console.log(message);
    };

    const fetchPatients = async () => {
      try {
        setLoading(true);
        addDebug('Started fetching patients');
        
        // Get current user ID first
        const userId = await getCurrentUser();
        if (!userId) {
          toast({
            variant: 'destructive',
            description: 'You must be logged in to view patients',
          });
          setLoading(false);
          return;
        }
        
        // Check if the patient_relationships table exists by attempting to query it
        const { data: tableCheck, error: tableError } = await supabase
          .from('patient_relationships')
          .select('id')
          .limit(1);
        
        let useRelationships = false;
        
        if (tableError) {
          // If there's an error, the table might not exist yet
          addDebug(`Error checking patient_relationships: ${tableError.message}`);
        } else {
          useRelationships = true;
          addDebug('Successfully connected to patient_relationships table');
        }
        
        if (useRelationships) {
          // Simple approach: get relationships first, then fetch profiles
          addDebug('Using patient_relationships table - simplified approach');
          
          const { data: relationshipsData, error: relationshipsError } = await supabase
            .from('patient_relationships')
            .select('patient_id')
            .eq('provider_id', userId);
          
          if (relationshipsError) {
            addDebug(`Error fetching relationships: ${relationshipsError.message}`);
            throw relationshipsError;
          }
          
          addDebug(`Found ${relationshipsData?.length || 0} patient relationships`);
          
          if (relationshipsData && relationshipsData.length > 0) {
            const patientIds = relationshipsData.map(rel => rel.patient_id);
            addDebug(`Patient IDs: ${patientIds.join(', ')}`);
            
            // Now fetch the profiles for these patient IDs
            const { data: profilesData, error: profilesError } = await supabase
              .from('user_profiles')
              .select('*')
              .in('id', patientIds);
            
            if (profilesError) {
              addDebug(`Error fetching profiles: ${profilesError.message}`);
              throw profilesError;
            }
            
            addDebug(`Found ${profilesData?.length || 0} profiles`);
            addDebug(`Profiles data: ${JSON.stringify(profilesData, null, 2)}`);
            
            // Create patient objects from the profiles we found
            const patientsWithProfiles = profilesData?.map(profile => {
              addDebug(`Processing profile: ID=${profile.id}, name="${profile.full_name}"`);
              return {
                id: profile.id,
                email: 'Patient user',
                created_at: profile.created_at || new Date().toISOString(),
                profile: {
                  full_name: profile.full_name,
                  date_of_birth: profile.date_of_birth,
                  phone_number: profile.phone_number
                }
              };
            }) || [];
            
            // For any patient IDs that don't have profiles, create placeholder entries
            const foundProfileIds = profilesData?.map(p => p.id) || [];
            const missingProfileIds = patientIds.filter(id => !foundProfileIds.includes(id));
            
            if (missingProfileIds.length > 0) {
              addDebug(`Creating placeholders for ${missingProfileIds.length} patients without profiles`);
              const placeholderPatients = missingProfileIds.map(id => ({
                id: id,
                email: 'Patient (No Profile)',
                created_at: new Date().toISOString(),
                profile: {
                  full_name: null,
                  date_of_birth: null,
                  phone_number: null
                }
              }));
              
              patientsWithProfiles.push(...placeholderPatients);
            }
            
            setPatients(patientsWithProfiles);
            addDebug(`Set ${patientsWithProfiles.length} patients total`);
          } else {
            addDebug('No patient relationships found');
            setPatients([]);
          }
        } else {
          // Fallback for systems without the relationships table
          addDebug('Falling back to profiles table since relationships table is not available');
          const { data: profilesData, error: profilesError } = await supabase
            .from('user_profiles')
            .select('*');
          
          if (profilesError) {
            addDebug(`Error fetching profiles: ${profilesError.message}`);
            throw profilesError;
          }
          
          addDebug(`Found ${profilesData?.length || 0} user profiles in fallback mode`);
          
          // Convert profiles to patients
          const patientsWithProfiles = profilesData?.map(profile => {
            return {
              id: profile.id,
              email: 'Patient user', // We don't have direct access to emails
              created_at: profile.created_at || new Date().toISOString(),
              profile: {
                full_name: profile.full_name,
                date_of_birth: profile.date_of_birth,
                phone_number: profile.phone_number
              }
            };
          }) || [];
          
          setPatients(patientsWithProfiles);
          addDebug(`Set ${patientsWithProfiles.length} patients in fallback mode`);
        }
      } catch (error) {
        console.error('Error fetching patients:', error);
        addDebug(`Error: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
        
        toast({
          variant: 'destructive',
          description: 'Failed to load patients information.',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPatients();
  }, [supabase]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not specified';
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading patient information...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Patient Management</h1>
        <Link href="/patients/add">
          <Button className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4" />
            Add New Patient
          </Button>
        </Link>
      </div>

      {patients.length > 0 ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {patients.map((patient) => (
                <tr key={patient.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                        <User className="h-6 w-6 text-gray-500" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {patient.profile?.full_name || 'Incomplete Profile'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {patient.profile?.date_of_birth ? formatDate(patient.profile.date_of_birth) : 'No DOB'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {patient.profile?.phone_number || 'No contact information'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <div className="flex justify-center space-x-3">
                      <Link href={`/patients/${patient.id}`}>
                        <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800">
                          View
                        </Button>
                      </Link>
                      <Link href={`/patients/${patient.id}/edit`}>
                        <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-800">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link href={`/patients/${patient.id}/medications`}>
                        <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-800">
                          Medications
                        </Button>
                      </Link>
                      <Link href={`/patients/${patient.id}/appointments`}>
                        <Button variant="ghost" size="sm" className="text-yellow-600 hover:text-yellow-800">
                          Appointments
                        </Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <div className="text-gray-500 mb-4">No patients found</div>
          <p className="mb-4">Add your first patient to get started.</p>
          {debug.length > 0 && (
            <div className="mt-6 text-left border-t pt-4">
              <h3 className="text-sm font-semibold mb-2">Debug Information:</h3>
              <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-40">
                {debug.map((msg, i) => (
                  <div key={i}>{msg}</div>
                ))}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 