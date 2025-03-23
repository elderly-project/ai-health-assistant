'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { Database } from '@/supabase/functions/_lib/database';

export default function AddMedicationPage() {
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();
  
  const [formData, setFormData] = useState({
    name: '',
    dosage: '',
    frequency: '',
    startDate: '',
    endDate: '',
    prescribingDoctor: '',
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
      
      const { error } = await supabase.from('medications').insert({
        user_id: userData.user.id,
        name: formData.name,
        dosage: formData.dosage,
        frequency: formData.frequency,
        start_date: formData.startDate || null,
        end_date: formData.endDate || null,
        prescribing_doctor: formData.prescribingDoctor || null,
        notes: formData.notes || null
      });
      
      if (error) {
        throw error;
      }
      
      toast({
        description: 'Medication added successfully!',
      });
      
      router.push('/dashboard');
    } catch (error) {
      console.error('Error adding medication:', error);
      toast({
        variant: 'destructive',
        description: 'Failed to add medication. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
      <h1 className="text-2xl font-bold mb-6">Add New Medication</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1">
            Medication Name*
          </label>
          <Input
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>
        
        <div>
          <label htmlFor="dosage" className="block text-sm font-medium mb-1">
            Dosage*
          </label>
          <Input
            id="dosage"
            name="dosage"
            placeholder="e.g., 10mg, 1 tablet"
            value={formData.dosage}
            onChange={handleChange}
            required
          />
        </div>
        
        <div>
          <label htmlFor="frequency" className="block text-sm font-medium mb-1">
            Frequency*
          </label>
          <Input
            id="frequency"
            name="frequency"
            placeholder="e.g., Once daily, Twice daily, As needed"
            value={formData.frequency}
            onChange={handleChange}
            required
          />
        </div>
        
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium mb-1">
            Start Date
          </label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            value={formData.startDate}
            onChange={handleChange}
          />
        </div>
        
        <div>
          <label htmlFor="endDate" className="block text-sm font-medium mb-1">
            End Date
          </label>
          <Input
            id="endDate"
            name="endDate"
            type="date"
            value={formData.endDate}
            onChange={handleChange}
          />
        </div>
        
        <div>
          <label htmlFor="prescribingDoctor" className="block text-sm font-medium mb-1">
            Prescribing Doctor
          </label>
          <Input
            id="prescribingDoctor"
            name="prescribingDoctor"
            value={formData.prescribingDoctor}
            onChange={handleChange}
          />
        </div>
        
        <div>
          <label htmlFor="notes" className="block text-sm font-medium mb-1">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            className="flex h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
            {isSubmitting ? 'Adding...' : 'Add Medication'}
          </Button>
        </div>
      </form>
    </div>
  );
} 