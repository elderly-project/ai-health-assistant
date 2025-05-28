'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/supabase/functions/_lib/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { ArrowLeft, Calendar, Pill, ClipboardList, Edit, User, MessageCircle } from 'lucide-react';
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
  created_at: string | null;
  updated_at: string | null;
}

interface Medication {
  id: number;
  name: string;
  dosage: string;
  frequency: string;
}

interface Appointment {
  id: number;
  title: string;
  doctor_name: string | null;
  appointment_date: string;
  location: string | null;
}

export default function PatientDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [debug, setDebug] = useState<string[]>([]);

  useEffect(() => {
    const addDebug = (message: string) => {
      setDebug(prev => [...prev, message]);
      console.log(message);
    };

    const fetchPatientData = async () => {
      try {
        setLoading(true);
        addDebug('Started fetching patient details');
        
        // Fetch profile data directly - try without .single() first to see what's there
        const { data: profilesData, error: profilesError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', params.id);
        
        if (profilesError) {
          addDebug(`Error fetching profiles: ${profilesError.message}`);
          throw profilesError;
        }
        
        addDebug(`Found ${profilesData?.length || 0} profile records for ID ${params.id}`);
        
        if (profilesData && profilesData.length > 0) {
          // Take the first profile if multiple exist
          setProfile(profilesData[0]);
          addDebug(`Successfully fetched profile with data: ${JSON.stringify(profilesData[0])}`);
          
          // Fetch medications
          const { data: medsData, error: medsError } = await supabase
            .from('medications')
            .select('id, name, dosage, frequency')
            .eq('user_id', params.id)
            .order('created_at', { ascending: false });
          
          if (medsError) {
            addDebug(`Error fetching medications: ${medsError.message}`);
            throw medsError;
          }
          
          addDebug(`Fetched ${medsData?.length || 0} medications`);
          setMedications(medsData || []);
          
          // Fetch appointments
          const { data: apptsData, error: apptsError } = await supabase
            .from('appointments')
            .select('id, title, doctor_name, appointment_date, location')
            .eq('user_id', params.id)
            .order('appointment_date', { ascending: true });
          
          if (apptsError) {
            addDebug(`Error fetching appointments: ${apptsError.message}`);
            throw apptsError;
          }
          
          addDebug(`Fetched ${apptsData?.length || 0} appointments`);
          setAppointments(apptsData || []);
        } else {
          addDebug(`No profile found for ID ${params.id}`);
          
          // Try to check if this user ID exists in the patient_relationships table
          const { data: relationshipData, error: relationshipError } = await supabase
            .from('patient_relationships')
            .select('*')
            .eq('patient_id', params.id)
            .single();
            
          if (relationshipError) {
            addDebug(`Error checking relationship: ${relationshipError.message}`);
          } else if (relationshipData) {
            addDebug(`Found relationship for patient ${params.id} with provider ${relationshipData.provider_id}`);
            // This patient exists in relationships but has no profile - we can create a placeholder
            setProfile({
              id: params.id,
              full_name: 'Patient (No Profile)',
              date_of_birth: null,
              phone_number: null,
              allergies: [],
              medical_conditions: [],
              emergency_contact: null,
              emergency_contact_phone: null,
              created_at: new Date().toISOString(),
              updated_at: null
            });
          }
        }
      } catch (error) {
        console.error('Error fetching patient data:', error);
        addDebug(`General error: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
        toast({
          variant: 'destructive',
          description: 'Failed to load patient information.',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPatientData();
  }, [supabase, params.id]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not specified';
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatAppointmentDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading patient information...</div>;
  }

  if (!profile) {
    return (
      <div className="max-w-3xl mx-auto p-4 sm:p-6 text-center">
        <div className="bg-red-50 p-6 rounded-lg border border-red-200">
          <h2 className="text-xl font-medium text-red-800 mb-2">Patient Not Found</h2>
          <p className="text-red-600 mb-4">The requested patient profile could not be found.</p>
          <Link href="/patients">
            <Button>Return to Patient List</Button>
          </Link>
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
      </div>
    );
  }

  // Special handling for patients with minimal/incomplete profiles
  const isIncompleteProfile = profile && 
    (profile.full_name === 'Patient (No Profile)' || 
     profile.full_name === null || 
     profile.full_name === '' || 
     profile.full_name?.startsWith('Patient ')) && 
    !profile.date_of_birth &&
    !profile.phone_number;

  if (isIncompleteProfile) {
    return (
      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        <div className="mb-6">
          <Link href="/patients" className="flex items-center text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Patients
          </Link>
        </div>
        
        <div className="bg-amber-50 p-6 rounded-lg border border-amber-200 text-center mb-6">
          <h2 className="text-xl font-medium text-amber-800 mb-2">Patient Profile Incomplete</h2>
          <p className="text-amber-700 mb-6">This patient exists in your system but doesn't have a complete profile yet. You can still access their dashboard and manage their care.</p>
          <div className="flex gap-3 justify-center">
            <Link href={`/patients/${params.id}/dashboard`}>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                View Dashboard
              </Button>
            </Link>
            <Link href={`/patients/${params.id}/chat`}>
              <Button className="bg-green-600 hover:bg-green-700">
                <MessageCircle className="w-4 h-4 mr-2" />
                Chat Assistant
              </Button>
            </Link>
            <Link href={`/patients/${params.id}/edit`}>
              <Button variant="outline" className="bg-amber-600 hover:bg-amber-700 text-white border-amber-600">
                Complete Profile
              </Button>
            </Link>
          </div>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Patient Information</CardTitle>
            <CardDescription>Basic details about this patient</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4">Patient ID: <span className="font-mono text-sm bg-gray-100 px-1.5 py-0.5 rounded">{profile.id.substring(0, 8)}...</span></p>
            <p>This patient has been added to your care list. You can access their dashboard to manage medications, appointments, and other care activities even before their profile is complete.</p>
          </CardContent>
          <CardFooter className="flex flex-col space-y-3">
            <Link href={`/patients/${params.id}/dashboard`} className="w-full">
              <Button className="w-full justify-start bg-blue-600 hover:bg-blue-700">
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Go to Dashboard
              </Button>
            </Link>
            <Link href={`/patients/${params.id}/chat`} className="w-full">
              <Button className="w-full justify-start bg-green-600 hover:bg-green-700">
                <MessageCircle className="h-4 w-4 mr-2" />
                Chat with Assistant
              </Button>
            </Link>
            <Link href={`/patients/${params.id}/edit`} className="w-full">
              <Button variant="outline" className="w-full">
                <Edit className="h-4 w-4 mr-2" />
                Complete Profile
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <Link href="/patients" className="flex items-center text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Patients
        </Link>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patient Profile Card */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="text-2xl">{profile?.full_name || 'Unnamed Patient'}</CardTitle>
              <CardDescription>
                <span className="text-xs font-mono bg-gray-100 px-1 py-0.5 rounded">ID: {profile.id.substring(0, 8)}...</span>
              </CardDescription>
            </div>
            <Link href={`/patients/${params.id}/edit`}>
              <Button variant="outline" size="sm" className="h-8 gap-1">
                <Edit className="h-3.5 w-3.5" />
                Edit Profile
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Basic Information */}
              <div className="space-y-3">
                <h3 className="font-medium text-sm text-gray-500">Basic Information</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="font-medium">Date of Birth</div>
                  <div>{formatDate(profile?.date_of_birth)}</div>
                  
                  <div className="font-medium">Phone Number</div>
                  <div>{profile?.phone_number || 'Not specified'}</div>
                </div>
              </div>
              
              {/* Emergency Contact */}
              <div className="space-y-3">
                <h3 className="font-medium text-sm text-gray-500">Emergency Contact</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="font-medium">Contact Name</div>
                  <div>{profile?.emergency_contact || 'Not specified'}</div>
                  
                  <div className="font-medium">Contact Phone</div>
                  <div>{profile?.emergency_contact_phone || 'Not specified'}</div>
                </div>
              </div>
            </div>
            
            {/* Medical Details */}
            <div className="pt-2">
              <h3 className="font-medium text-sm text-gray-500 mb-3">Medical Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Medical Conditions</h4>
                  {profile?.medical_conditions && profile.medical_conditions.length > 0 ? (
                    <ul className="list-disc pl-5 text-sm space-y-1">
                      {profile.medical_conditions.map((condition, i) => (
                        <li key={i}>{condition}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500">No medical conditions recorded</p>
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">Allergies</h4>
                  {profile?.allergies && profile.allergies.length > 0 ? (
                    <ul className="list-disc pl-5 text-sm space-y-1">
                      {profile.allergies.map((allergy, i) => (
                        <li key={i}>{allergy}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500">No allergies recorded</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between border-t pt-6">
            <div className="text-xs text-gray-500">
              Patient since: {formatDate(profile.created_at)}
            </div>
            <div className="text-xs text-gray-500">
              Last updated: {formatDate(profile?.updated_at || profile?.created_at)}
            </div>
          </CardFooter>
        </Card>
        
        {/* Quick Actions Card */}
        <Card>
          <CardHeader>
            <CardTitle>Patient Management</CardTitle>
            <CardDescription>Manage medications and appointments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href={`/patients/${params.id}/chat`} className="block">
              <Button variant="outline" className="w-full justify-start bg-green-50 hover:bg-green-100 border-green-200">
                <MessageCircle className="mr-2 h-4 w-4" />
                Chat with Assistant
              </Button>
            </Link>
            <Link href={`/patients/${params.id}/medications`} className="block">
              <Button variant="outline" className="w-full justify-start">
                <Pill className="mr-2 h-4 w-4" />
                Manage Medications
              </Button>
            </Link>
            <Link href={`/patients/${params.id}/appointments`} className="block">
              <Button variant="outline" className="w-full justify-start">
                <Calendar className="mr-2 h-4 w-4" />
                Manage Appointments
              </Button>
            </Link>
            <Link href={`/patients/${params.id}/files`} className="block">
              <Button variant="outline" className="w-full justify-start">
                <ClipboardList className="mr-2 h-4 w-4" />
                Medical Records
              </Button>
            </Link>
            <Link href={`/patients/${params.id}/dashboard`} className="block">
              <Button variant="outline" className="w-full justify-start bg-blue-50 hover:bg-blue-100 border-blue-200">
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Patient Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
        
        {/* Medications Overview */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Medications</CardTitle>
              <CardDescription>Current medications for this patient</CardDescription>
            </div>
            <Link href={`/patients/${params.id}/medications/add`}>
              <Button size="sm">
                Add Medication
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {medications.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {medications.slice(0, 6).map((med) => (
                  <div key={med.id} className="border rounded-md p-4">
                    <div className="flex justify-between">
                      <h3 className="font-semibold">{med.name}</h3>
                      <span className="text-xs bg-blue-100 text-blue-800 py-0.5 px-2 rounded-full">
                        {med.frequency}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{med.dosage}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-500 mb-4">No medications added for this patient</p>
                <Link href={`/patients/${params.id}/medications/add`}>
                  <Button>Add First Medication</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Appointments Overview */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Upcoming Appointments</CardTitle>
              <CardDescription>Scheduled appointments for this patient</CardDescription>
            </div>
            <Link href={`/patients/${params.id}/appointments/add`}>
              <Button size="sm">
                Schedule Appointment
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {appointments.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {appointments
                  .filter(appt => new Date(appt.appointment_date) >= new Date())
                  .slice(0, 4)
                  .map((appt) => (
                    <div key={appt.id} className="border rounded-md p-4">
                      <div className="flex justify-between">
                        <h3 className="font-semibold">{appt.title}</h3>
                        <span className="text-xs text-gray-500">
                          {formatAppointmentDate(appt.appointment_date)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {appt.doctor_name && (
                          <div className="flex items-center gap-1 mt-1">
                            <User className="h-3 w-3" />
                            <span>{appt.doctor_name}</span>
                          </div>
                        )}
                        {appt.location && (
                          <div className="flex items-center gap-1 mt-1">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>{appt.location}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-500 mb-4">No appointments scheduled for this patient</p>
                <Link href={`/patients/${params.id}/appointments/add`}>
                  <Button>Schedule First Appointment</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 