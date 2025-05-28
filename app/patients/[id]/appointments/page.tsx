'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/supabase/functions/_lib/database';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { ArrowLeft, Plus, Calendar, Clock, MapPin, Edit, Trash2, Loader2 } from 'lucide-react';

interface Appointment {
  id: number;
  title: string;
  doctor_name: string | null;
  appointment_date: string;
  location: string | null;
  notes: string | null;
  status?: string;
  created_at: string | null;
  updated_at: string | null;
  user_id: string;
}

interface PatientProfile {
  id: string;
  full_name: string | null;
}

export default function PatientAppointmentsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patient, setPatient] = useState<PatientProfile | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch patient profile
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('id, full_name')
          .eq('id', params.id)
          .single();
        
        if (profileError) {
          console.error('Error fetching patient profile:', profileError);
        } else {
          setPatient(profileData);
        }

        // Fetch appointments
        const { data: appointmentsData, error: appointmentsError } = await supabase
          .from('appointments')
          .select('*')
          .eq('user_id', params.id)
          .order('appointment_date', { ascending: true });

        if (appointmentsError) {
          console.error('Error fetching appointments:', appointmentsError);
          toast({
            variant: 'destructive',
            description: 'Failed to load appointments.',
          });
        } else {
          setAppointments(appointmentsData || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase, params.id]);

  const handleDeleteAppointment = async (appointmentId: number) => {
    if (!confirm('Are you sure you want to delete this appointment?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', appointmentId)
        .eq('user_id', params.id);

      if (error) throw error;

      setAppointments(prev => prev.filter(appointment => appointment.id !== appointmentId));
      toast({
        description: 'Appointment deleted successfully.',
      });
    } catch (error) {
      console.error('Error deleting appointment:', error);
      toast({
        variant: 'destructive',
        description: 'Failed to delete appointment.',
      });
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    };
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'rescheduled':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const isUpcoming = (dateString: string) => {
    const appointmentDateTime = new Date(dateString);
    return appointmentDateTime > new Date();
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <Link href={`/patients/${params.id}/dashboard`} className="flex items-center text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Dashboard
        </Link>
      </div>
      
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
          <p className="text-gray-600">
            Managing appointments for {patient?.full_name || `Patient ${params.id.substring(0, 8)}...`}
          </p>
        </div>
        <Link href={`/patients/${params.id}/appointments/add`}>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Appointment
          </Button>
        </Link>
      </div>

      {appointments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No appointments found</h3>
            <p className="text-gray-600 mb-4">This patient doesn't have any appointments scheduled yet.</p>
            <Link href={`/patients/${params.id}/appointments/add`}>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Schedule First Appointment
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {appointments.map((appointment) => {
            const { date, time } = formatDateTime(appointment.appointment_date);
            return (
              <Card key={appointment.id} className={`${isUpcoming(appointment.appointment_date) ? 'border-blue-200 bg-blue-50/30' : ''}`}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{appointment.title}</h3>
                        {appointment.status && (
                          <Badge className={getStatusColor(appointment.status)}>
                            {appointment.status}
                          </Badge>
                        )}
                        {isUpcoming(appointment.appointment_date) && (
                          <Badge variant="outline" className="text-blue-600 border-blue-200">
                            Upcoming
                          </Badge>
                        )}
                      </div>
                      
                      <div className="space-y-2 text-sm text-gray-600">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2" />
                          {date}
                        </div>
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-2" />
                          {time}
                        </div>
                        {appointment.doctor_name && (
                          <div className="flex items-center">
                            <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            {appointment.doctor_name}
                          </div>
                        )}
                        {appointment.location && (
                          <div className="flex items-center">
                            <MapPin className="h-4 w-4 mr-2" />
                            {appointment.location}
                          </div>
                        )}
                      </div>
                      
                      {appointment.notes && (
                        <p className="mt-3 text-gray-700">{appointment.notes}</p>
                      )}
                    </div>
                    
                    <div className="flex space-x-2 ml-4">
                      <Link href={`/patients/${params.id}/appointments/${appointment.id}/edit`}>
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleDeleteAppointment(appointment.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
} 