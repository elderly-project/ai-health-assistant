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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { ArrowLeft, Loader2 } from 'lucide-react';

interface PatientProfile {
  id: string;
  full_name: string | null;
}

export default function AddAppointmentPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();
  const [loading, setLoading] = useState(false);
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    doctor_name: '',
    appointment_date: '',
    appointment_time: '',
    location: '',
    notes: ''
  });

  useEffect(() => {
    const fetchPatient = async () => {
      try {
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
      } catch (error) {
        console.error('Error fetching patient:', error);
      }
    };

    fetchPatient();
  }, [supabase, params.id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
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
      
      // Combine date and time into a single timestamp
      const appointmentDateTime = new Date(`${formData.appointment_date}T${formData.appointment_time}`).toISOString();
      
      const appointmentData = {
        user_id: params.id,
        title: formData.title,
        doctor_name: formData.doctor_name || null,
        appointment_date: appointmentDateTime,
        location: formData.location || null,
        notes: formData.notes || null
      };

      const { error } = await supabase
        .from('appointments')
        .insert([appointmentData]);

      if (error) throw error;

      toast({
        description: 'Appointment scheduled successfully.',
      });

      router.push(`/patients/${params.id}/appointments`);
    } catch (error) {
      console.error('Error scheduling appointment:', error);
      toast({
        variant: 'destructive',
        description: 'Failed to schedule appointment.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Get today's date in YYYY-MM-DD format for min date
  const today = new Date().toISOString().split('T')[0];

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
          <CardTitle>Schedule New Appointment</CardTitle>
          <p className="text-gray-600">
            Scheduling appointment for {patient?.full_name || `Patient ${params.id.substring(0, 8)}...`}
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
            
            <div>
              <Label htmlFor="doctor_name">Doctor Name</Label>
              <Input
                id="doctor_name"
                name="doctor_name"
                value={formData.doctor_name}
                onChange={handleChange}
                placeholder="e.g., Dr. Smith"
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
                  min={today}
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
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                value={formData.notes}
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
                Schedule Appointment
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 