'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/supabase/functions/_lib/database';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { Users, UserPlus, Calendar, FileText, MessageCircle, Activity, Clock, AlertCircle } from 'lucide-react';

interface PatientStats {
  totalPatients: number;
  recentPatients: number;
  upcomingAppointments: number;
  totalDocuments: number;
}

interface RecentPatient {
  id: string;
  full_name: string | null;
  created_at: string;
}

interface UpcomingAppointment {
  id: number;
  title: string;
  appointment_date: string;
  patient_name: string | null;
  patient_id: string;
}

export default function AdminDashboard() {
  const supabase = createClientComponentClient<Database>();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<PatientStats>({
    totalPatients: 0,
    recentPatients: 0,
    upcomingAppointments: 0,
    totalDocuments: 0
  });
  const [recentPatients, setRecentPatients] = useState<RecentPatient[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<UpcomingAppointment[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        setLoading(true);
        console.log('Starting dashboard data fetch...');

        // Get current user
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) {
          console.error('User authentication error:', userError);
          throw userError;
        }
        console.log('User authenticated:', userData.user?.email);
        setCurrentUser(userData.user);

        // Fetch patient statistics
        console.log('Fetching patient relationships...');
        const { data: patientsData, error: patientsError } = await supabase
          .from('patient_relationships')
          .select('patient_id, created_at')
          .eq('provider_id', userData.user?.id);

        if (patientsError) {
          console.error('Error fetching patients:', patientsError);
          throw patientsError;
        }
        console.log('Found patients:', patientsData?.length || 0);

        const totalPatients = patientsData?.length || 0;
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const recentPatients = patientsData?.filter(p => 
          new Date(p.created_at) >= oneWeekAgo
        ).length || 0;

        // Fetch upcoming appointments - only for provider's patients
        const patientIds = patientsData?.map(p => p.patient_id) || [];
        let appointmentsWithNames: UpcomingAppointment[] = [];
        let appointmentsCount = 0;
        
        console.log('Fetching appointments for patient IDs:', patientIds.length);
        if (patientIds.length > 0) {
          const { data: appointmentsData, error: appointmentsError } = await supabase
            .from('appointments')
            .select(`
              id,
              title,
              appointment_date,
              user_id
            `)
            .in('user_id', patientIds)
            .gte('appointment_date', new Date().toISOString())
            .order('appointment_date', { ascending: true })
            .limit(5);

          if (appointmentsError) {
            console.error('Error fetching appointments:', appointmentsError);
            // Don't throw here, just log and continue
          } else {
            appointmentsCount = appointmentsData?.length || 0;
            console.log('Found appointments:', appointmentsCount);
            
            // Get patient names for appointments
            appointmentsWithNames = await Promise.all(
              (appointmentsData || []).map(async (apt) => {
                const { data: profileData } = await supabase
                  .from('user_profiles')
                  .select('full_name')
                  .eq('id', apt.user_id)
                  .single();
                
                return {
                  ...apt,
                  patient_name: profileData?.full_name || 'Unknown Patient',
                  patient_id: apt.user_id
                };
              })
            );
          }
        }

        // Fetch recent patients with profiles
        console.log('Fetching patient profiles...');
        const { data: profilesData, error: profilesError } = await supabase
          .from('user_profiles')
          .select('id, full_name, created_at')
          .in('id', patientIds)
          .order('created_at', { ascending: false })
          .limit(5);

        if (profilesError) {
          console.error('Error fetching profiles:', profilesError);
          // Don't throw here, just log and continue
        }
        console.log('Found profiles:', profilesData?.length || 0);

        // Fetch document count
        console.log('Fetching document count...');
        const { data: documentsData, error: documentsError } = await supabase
          .from('documents')
          .select('id', { count: 'exact' });

        if (documentsError) {
          console.error('Error fetching documents:', documentsError);
          // Don't throw here, just log and continue
        }
        console.log('Found documents:', documentsData?.length || 0);

        setStats({
          totalPatients,
          recentPatients,
          upcomingAppointments: appointmentsCount,
          totalDocuments: documentsData?.length || 0
        });

        setRecentPatients(profilesData || []);
        setUpcomingAppointments(appointmentsWithNames);

        console.log('Dashboard data fetch completed successfully');

      } catch (error) {
        console.error('Error fetching admin dashboard data:', error);
        toast({
          variant: 'destructive',
          description: `Failed to load dashboard data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAdminData();
  }, [supabase]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading admin dashboard...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600">Welcome back, {currentUser?.email}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPatients}</div>
            <p className="text-xs text-muted-foreground">
              {stats.recentPatients} new this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Appointments</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.upcomingAppointments}</div>
            <p className="text-xs text-muted-foreground">
              Next 7 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Medical Records</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDocuments}</div>
            <p className="text-xs text-muted-foreground">
              Documents uploaded
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Active</div>
            <p className="text-xs text-muted-foreground">
              All systems operational
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/patients/add" className="block">
              <Button variant="outline" className="w-full justify-start">
                <UserPlus className="mr-2 h-4 w-4" />
                Add New Patient
              </Button>
            </Link>
            <Link href="/patients" className="block">
              <Button variant="outline" className="w-full justify-start">
                <Users className="mr-2 h-4 w-4" />
                Manage Patients
              </Button>
            </Link>
            <Link href="/files" className="block">
              <Button variant="outline" className="w-full justify-start">
                <FileText className="mr-2 h-4 w-4" />
                Upload Documents
              </Button>
            </Link>
            <Link href="/chat" className="block">
              <Button variant="outline" className="w-full justify-start">
                <MessageCircle className="mr-2 h-4 w-4" />
                AI Assistant
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Recent Patients */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Patients</CardTitle>
              <CardDescription>Recently added to your care</CardDescription>
            </div>
            <Link href="/patients">
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentPatients.length > 0 ? (
              <div className="space-y-3">
                {recentPatients.map((patient) => (
                  <div key={patient.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {patient.full_name || 'Incomplete Profile'}
                      </p>
                      <p className="text-sm text-gray-500">
                        Added {formatDate(patient.created_at)}
                      </p>
                    </div>
                    <Link href={`/patients/${patient.id}`}>
                      <Button variant="ghost" size="sm">View</Button>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No recent patients</p>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Appointments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Upcoming Appointments</CardTitle>
              <CardDescription>Next scheduled appointments</CardDescription>
            </div>
            <Link href="/patients">
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {upcomingAppointments.length > 0 ? (
              <div className="space-y-3">
                {upcomingAppointments.map((appointment) => (
                  <div key={appointment.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{appointment.title}</p>
                      <p className="text-sm text-gray-500">
                        {appointment.patient_name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDateTime(appointment.appointment_date)}
                      </p>
                    </div>
                    <Link href={`/patients/${appointment.patient_id}/appointments`}>
                      <Button variant="ghost" size="sm">
                        <Clock className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No upcoming appointments</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* System Overview */}
      <Card>
        <CardHeader>
          <CardTitle>System Overview</CardTitle>
          <CardDescription>Quick overview of your healthcare management system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">{stats.totalPatients}</div>
              <p className="text-sm text-gray-600">Patients under your care</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">{stats.upcomingAppointments}</div>
              <p className="text-sm text-gray-600">Appointments scheduled</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">{stats.totalDocuments}</div>
              <p className="text-sm text-gray-600">Medical records stored</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 