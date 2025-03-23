'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/supabase/functions/_lib/database';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

interface Medication {
  id: number;
  name: string;
  dosage: string;
  frequency: string;
}

interface Appointment {
  id: number;
  title: string;
  doctor_name: string;
  appointment_date: string;
  location: string;
}

export default function DashboardPage() {
  const supabase = createClientComponentClient<Database>();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Get current user
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        // Check if user has completed onboarding
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', userData.user?.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') {
          throw profileError;
        }

        setUserProfile(profileData || null);

        // Fetch medications
        const { data: medsData, error: medsError } = await supabase
          .from('medications')
          .select('*')
          .order('created_at', { ascending: false });

        if (medsError) throw medsError;
        setMedications(medsData || []);

        // Fetch appointments
        const { data: apptsData, error: apptsError } = await supabase
          .from('appointments')
          .select('*')
          .order('appointment_date', { ascending: true });

        if (apptsError) throw apptsError;
        setAppointments(apptsData || []);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        toast({
          variant: 'destructive',
          description: 'Failed to load your health information.',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase]);

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading your health dashboard...</div>;
  }

  if (!userProfile) {
    return (
      <div className="max-w-4xl mx-auto p-4 text-center">
        <h2 className="text-2xl font-bold mb-4">Complete Your Profile</h2>
        <p className="mb-6">Please complete your health profile to access all features.</p>
        <Link href="/onboarding">
          <Button>Complete Profile</Button>
        </Link>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
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

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6 col-span-3 md:col-span-1">
          <h2 className="font-bold text-xl mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link href="/files" className="block">
              <Button variant="outline" className="w-full justify-start">
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Upload Prescription
              </Button>
            </Link>
            <Link href="/medications/add" className="block">
              <Button variant="outline" className="w-full justify-start">
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Add Medication
              </Button>
            </Link>
            <Link href="/appointments/add" className="block">
              <Button variant="outline" className="w-full justify-start">
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Schedule Appointment
              </Button>
            </Link>
            <Link href="/chat" className="block">
              <Button variant="outline" className="w-full justify-start">
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                Chat with Assistant
              </Button>
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 col-span-3 md:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-xl">Your Medications</h2>
            <Link href="/medications">
              <Button variant="link">View All</Button>
            </Link>
          </div>
          
          {medications.length > 0 ? (
            <div className="space-y-3">
              {medications.slice(0, 3).map((med) => (
                <div key={med.id} className="border rounded-md p-4">
                  <div className="flex justify-between">
                    <h3 className="font-semibold">{med.name}</h3>
                    <span className="text-sm bg-blue-100 text-blue-800 py-0.5 px-2 rounded-full">
                      {med.frequency}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{med.dosage}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No medications added yet.</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-xl">Upcoming Appointments</h2>
          <Link href="/appointments">
            <Button variant="link">View All</Button>
          </Link>
        </div>
        
        {upcomingAppointments.length > 0 ? (
          <div className="space-y-3">
            {upcomingAppointments.slice(0, 3).map((appt) => (
              <div key={appt.id} className="border rounded-md p-4">
                <div className="flex justify-between">
                  <h3 className="font-semibold">{appt.title}</h3>
                  <span className="text-sm">{formatDate(appt.appointment_date)}</span>
                </div>
                <div className="text-sm text-gray-600 flex items-center mt-1">
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {appt.location || 'No location specified'}
                </div>
                {appt.doctor_name && (
                  <div className="text-sm text-gray-600 flex items-center mt-1">
                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Dr. {appt.doctor_name}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No upcoming appointments scheduled.</p>
        )}
      </div>
    </div>
  );
} 