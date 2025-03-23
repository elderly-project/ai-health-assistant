'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { Database } from '@/supabase/functions/_lib/database';

export default function AddAppointmentPage() {
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();
  
  const [formData, setFormData] = useState({
    title: '',
    doctorName: '',
    location: '',
    appointmentDate: '',
    appointmentTime: '',
    notes: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError || !userData.user) {
        throw new Error('Not authenticated');
      }
      
      // Combine date and time
      const dateTimeString = formData.appointmentDate && formData.appointmentTime
        ? `${formData.appointmentDate}T${formData.appointmentTime}`
        : formData.appointmentDate;
      
      const { error } = await supabase.from('appointments').insert({
        user_id: userData.user.id,
        title: formData.title,
        doctor_name: formData.doctorName || null,
        location: formData.location || null,
        appointment_date: dateTimeString,
        notes: formData.notes || null
      });
      
      if (error) {
        throw error;
      }
      
      toast({
        description: 'Appointment scheduled successfully!',
      });
      
      router.push('/dashboard');
    } catch (error) {
      console.error('Error scheduling appointment:', error);
      toast({
        variant: 'destructive',
        description: 'Failed to schedule appointment. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
      <h1 className="text-2xl font-bold mb-6">Schedule New Appointment</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="title" className="block text-sm font-medium mb-1">
            Appointment Title*
          </label>
          <Input
            id="title"
            name="title"
            placeholder="e.g., Annual Check-up, Follow-up Visit"
            value={formData.title}
            onChange={handleChange}
            required
          />
        </div>
        
        <div>
          <label htmlFor="doctorName" className="block text-sm font-medium mb-1">
            Doctor Name
          </label>
          <Input
            id="doctorName"
            name="doctorName"
            placeholder="e.g., Dr. Smith"
            value={formData.doctorName}
            onChange={handleChange}
          />
        </div>
        
        <div>
          <label htmlFor="location" className="block text-sm font-medium mb-1">
            Location
          </label>
          <Input
            id="location"
            name="location"
            placeholder="e.g., Memorial Hospital, 123 Main Street"
            value={formData.location}
            onChange={handleChange}
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="appointmentDate" className="block text-sm font-medium mb-1">
              Date*
            </label>
            <Input
              id="appointmentDate"
              name="appointmentDate"
              type="date"
              value={formData.appointmentDate}
              onChange={handleChange}
              required
            />
          </div>
          
          <div>
            <label htmlFor="appointmentTime" className="block text-sm font-medium mb-1">
              Time
            </label>
            <Input
              id="appointmentTime"
              name="appointmentTime"
              type="time"
              value={formData.appointmentTime}
              onChange={handleChange}
            />
          </div>
        </div>
        
        <div>
          <label htmlFor="notes" className="block text-sm font-medium mb-1">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            className="flex h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Any special instructions or things to remember"
            value={formData.notes}
            onChange={handleChange}
          />
        </div>
        
        <div className="flex items-center justify-between pt-4">
          <Button 
            type="button" 
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Scheduling...' : 'Schedule Appointment'}
          </Button>
        </div>
      </form>
    </div>
  );
} 