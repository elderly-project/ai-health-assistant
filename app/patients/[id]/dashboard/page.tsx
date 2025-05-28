'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/supabase/functions/_lib/database';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { ArrowLeft, Calendar, Pill, ClipboardList, Edit, User, MessageCircle } from 'lucide-react';

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
  user_id: string;
  created_at: string;
}

interface Appointment {
  id: number;
  title: string;
  doctor_name: string | null;
  appointment_date: string;
  location: string | null;
  user_id: string;
  created_at: string;
}

export default function PatientDashboardPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    const fetchPatientData = async () => {
      try {
        setLoading(true);
        
        // Fetch profile data
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', params.id)
          .single();
        
        if (profileError) {
          if (profileError.code === 'PGRST116') {
            // Record not found
            console.log('No profile found at all for patient ID:', params.id);
            setHasProfile(false);
          } else {
            throw profileError;
          }
        } else {
          // Always consider having a record as having a profile, even if it's minimal
          console.log('Profile found for patient ID:', params.id, profileData);
          setProfile(profileData);
          setHasProfile(true);
        }
        
        // Fetch medications
        const { data: medsData, error: medsError } = await supabase
          .from('medications')
          .select('*')
          .eq('user_id', params.id)
          .order('created_at', { ascending: false });
        
        if (medsError) throw medsError;
        setMedications(medsData || []);
        
        // Fetch appointments
        const { data: apptsData, error: apptsError } = await supabase
          .from('appointments')
          .select('*')
          .eq('user_id', params.id)
          .order('appointment_date', { ascending: true });
        
        if (apptsError) throw apptsError;
        setAppointments(apptsData || []);
      } catch (error) {
        console.error('Error fetching patient data:', error);
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

  const formatDate = (dateString: string) => {
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

  const upcomingAppointments = appointments.filter(
    (apt) => new Date(apt.appointment_date) >= new Date()
  );

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading patient dashboard...</div>;
  }

  // Always show the dashboard, even if no profile exists
  // Create a minimal profile object if none exists
  const displayProfile = profile || {
    id: params.id,
    full_name: null,
    date_of_birth: null,
    phone_number: null,
    allergies: [],
    medical_conditions: [],
    emergency_contact: null,
    emergency_contact_phone: null,
    created_at: new Date().toISOString(),
    updated_at: null
  };

  // Check if profile is minimal/incomplete for display purposes only
  const isMinimalProfile = 
    !displayProfile.full_name || 
    displayProfile.full_name === '' || 
    displayProfile.full_name === 'Patient (No Profile)' ||
    displayProfile.full_name.startsWith('Patient ');

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <Link href={`/patients/${params.id}`} className="flex items-center text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Patient Profile
        </Link>
      </div>
      
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">
          Dashboard: {displayProfile?.full_name && displayProfile.full_name !== 'Patient (No Profile)' 
            ? displayProfile.full_name 
            : `Patient ${displayProfile?.id.substring(0, 8)}...`}
        </h1>
        
        {isMinimalProfile && (
          <Link href={`/patients/${params.id}/edit`}>
            <Button variant="outline" size="sm" className="gap-1">
              <Edit className="h-3.5 w-3.5" />
              Complete Profile
            </Button>
          </Link>
        )}
      </div>
      
      {isMinimalProfile && (
        <div className="bg-amber-50 p-4 rounded-md mb-6 border border-amber-200">
          <h2 className="text-sm font-medium text-amber-800 mb-2">Limited Dashboard View</h2>
          <p className="text-sm text-amber-700">
            This patient has a minimal profile. Some features might be limited until you 
            <Link href={`/patients/${params.id}/edit`} className="font-medium underline mx-1">complete their profile</Link>
            with more information.
          </p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="col-span-3 md:col-span-1">
          <CardHeader>
            <CardTitle>Patient Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href={`/patients/${params.id}/chat`} className="block">
              <Button variant="outline" className="w-full justify-start bg-blue-50 hover:bg-blue-100 border-blue-200">
                <MessageCircle className="mr-2 h-4 w-4" />
                Chat with Assistant
              </Button>
            </Link>
            <Link href={`/patients/${params.id}/medications/add`} className="block">
              <Button variant="outline" className="w-full justify-start">
                <Pill className="mr-2 h-4 w-4" />
                Add Medication
              </Button>
            </Link>
            <Link href={`/patients/${params.id}/appointments/add`} className="block">
              <Button variant="outline" className="w-full justify-start">
                <Calendar className="mr-2 h-4 w-4" />
                Schedule Appointment
              </Button>
            </Link>
            <Link href={`/patients/${params.id}/files/upload`} className="block">
              <Button variant="outline" className="w-full justify-start">
                <ClipboardList className="mr-2 h-4 w-4" />
                Upload Medical Record
              </Button>
            </Link>
            <Link href={`/patients/${params.id}/edit`} className="block">
              <Button variant="outline" className="w-full justify-start">
                <Edit className="mr-2 h-4 w-4" />
                Edit Profile
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="col-span-3 md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Medications</CardTitle>
              <CardDescription>Current medications for this patient</CardDescription>
            </div>
            <Link href={`/patients/${params.id}/medications`}>
              <Button variant="link">View All</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {medications.length > 0 ? (
              <div className="space-y-3">
                {medications.slice(0, 3).map((med) => (
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
              <div className="text-center py-4">
                <p className="text-gray-500">No medications added for this patient.</p>
                <Link href={`/patients/${params.id}/medications/add`} className="mt-2 inline-block">
                  <Button size="sm">Add Medication</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Upcoming Appointments</CardTitle>
            <CardDescription>Scheduled appointments for this patient</CardDescription>
          </div>
          <Link href={`/patients/${params.id}/appointments`}>
            <Button variant="link">View All</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {upcomingAppointments.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {upcomingAppointments.slice(0, 4).map((appt) => (
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
            <div className="text-center py-4">
              <p className="text-gray-500">No upcoming appointments scheduled for this patient.</p>
              <Link href={`/patients/${params.id}/appointments/add`} className="mt-2 inline-block">
                <Button size="sm">Schedule Appointment</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Patient Profile Summary</CardTitle>
          <CardDescription>Health information on file</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium mb-2">Medical Conditions</h3>
              {displayProfile?.medical_conditions && displayProfile.medical_conditions.length > 0 ? (
                <ul className="list-disc pl-5 text-sm space-y-1">
                  {displayProfile.medical_conditions.map((condition, i) => (
                    <li key={i}>{condition}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">No medical conditions recorded</p>
              )}
            </div>
            <div>
              <h3 className="text-sm font-medium mb-2">Allergies</h3>
              {displayProfile?.allergies && displayProfile.allergies.length > 0 ? (
                <ul className="list-disc pl-5 text-sm space-y-1">
                  {displayProfile.allergies.map((allergy, i) => (
                    <li key={i}>{allergy}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">No allergies recorded</p>
              )}
            </div>
            <div>
              <h3 className="text-sm font-medium mb-2">Emergency Contact</h3>
              {displayProfile?.emergency_contact ? (
                <div className="text-sm">
                  <p>{displayProfile.emergency_contact}</p>
                  <p className="text-gray-600">{displayProfile.emergency_contact_phone || 'No phone number'}</p>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No emergency contact recorded</p>
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between border-t pt-6">
          <div className="text-xs text-gray-500">
            Last updated: {displayProfile?.updated_at ? formatDate(displayProfile.updated_at) : 'Not specified'}
          </div>
          <Link href={`/patients/${params.id}/edit`}>
            <Button size="sm" variant="outline">Update Information</Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
} 