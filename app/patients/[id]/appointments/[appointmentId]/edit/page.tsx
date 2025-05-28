'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/supabase/functions/_lib/database';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { ArrowLeft, Loader2 } from 'lucide-react';

interface Appointment {
  id: string;
  title: string;
  description: string | null;
  appointment_date: string;
  appointment_time: string;
  location: string | null;
  status: string;
}

interface PatientProfile {
  id: string;
  full_name: string | null;
}

export default function EditAppointmentPage({ 
  params 
}: { 
  params: { id: string; appointmentId: string } 
}) {
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    appointment_date: '',
    appointment_time: '',
    location: '',
    status: 'scheduled'
  });

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

        // Fetch appointment
        const { data: appointmentData, error: appointmentError } = await supabase
          .from('appointments')
          .select('*')
          .eq('id', params.appointmentId)
          .eq('user_id', params.id)
          .single();

        if (appointmentError) {
          console.error('Error fetching appointment:', appointmentError);
          toast({
            variant: 'destructive',
            description: 'Appointment not found.',
          });
          router.push(`/patients/${params.id}/appointments`);
          return;
        }

        setAppointment(appointmentData);
        setFormData({
          title: appointmentData.title || '',
          description: appointmentData.description || '',
          appointment_date: appointmentData.appointment_date || '',
          appointment_time: appointmentData.appointment_time || '',
          location: appointmentData.location || '',
          status: appointmentData.status || 'scheduled'
        });
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setInitialLoading(false);
      }
    };

    fetchData();
  }, [supabase, params.id, params.appointmentId, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.appointment_date || !formData.appointment_time) {
      toast({
        variant: 'destructive',
        description: 'Please fill in all required fields.',
      });
      return;
    }

    try {
      setLoading(true);
      
      const appointmentData = {
        title: formData.title,
        description: formData.description || null,
        appointment_date: formData.appointment_date,
        appointment_time: formData.appointment_time,
        location: formData.location || null,
        status: formData.status
      };

      const { error } = await supabase
        .from('appointments')
        .update(appointmentData)
        .eq('id', params.appointmentId)
        .eq('user_id', params.id);

      if (error) throw error;

      toast({
        description: 'Appointment updated successfully.',
      });

      router.push(`/patients/${params.id}/appointments`);
    } catch (error) {
      console.error('Error updating appointment:', error);
      toast({
        variant: 'destructive',
        description: 'Failed to update appointment.',
      });
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600">Appointment not found.</p>
            <Link href={`/patients/${params.id}/appointments`} className="text-blue-600 hover:underline">
              Back to Appointments
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href={`/patients/${params.id}/appointments`} className="flex items-center text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Appointments
        </Link>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Edit Appointment</CardTitle>
          <p className="text-gray-600">
            Editing appointment for {patient?.full_name || `Patient ${params.id.substring(0, 8)}...`}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="title">Appointment Title<span className="text-red-500">*</span></Label>
              <Input
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g., Regular Checkup, Follow-up Visit"
                required
                className="mt-1"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="appointment_date">Date<span className="text-red-500">*</span></Label>
                <Input
                  id="appointment_date"
                  name="appointment_date"
                  type="date"
                  value={formData.appointment_date}
                  onChange={handleChange}
                  required
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="appointment_time">Time<span className="text-red-500">*</span></Label>
                <Input
                  id="appointment_time"
                  name="appointment_time"
                  type="time"
                  value={formData.appointment_time}
                  onChange={handleChange}
                  required
                  className="mt-1"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="e.g., Main Office, Room 101"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => handleSelectChange('status', value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="rescheduled">Rescheduled</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Additional notes about this appointment..."
                className="mt-1"
                rows={3}
              />
            </div>
            
            <div className="flex justify-end space-x-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => router.push(`/patients/${params.id}/appointments`)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Update Appointment
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 