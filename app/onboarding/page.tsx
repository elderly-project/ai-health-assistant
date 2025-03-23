'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { Database } from '@/supabase/functions/_lib/database';

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();
  
  const [formData, setFormData] = useState({
    fullName: '',
    dateOfBirth: '',
    phoneNumber: '',
    emergencyContact: '',
    emergencyContactPhone: '',
    medicalConditions: '',
    allergies: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      
      const { error } = await supabase.from('user_profiles').upsert({
        id: userData.user.id,
        full_name: formData.fullName,
        date_of_birth: formData.dateOfBirth,
        phone_number: formData.phoneNumber,
        emergency_contact: formData.emergencyContact,
        emergency_contact_phone: formData.emergencyContactPhone,
        medical_conditions: formData.medicalConditions.split(',').map(item => item.trim()),
        allergies: formData.allergies.split(',').map(item => item.trim())
      });
      
      if (error) {
        throw error;
      }
      
      toast({
        description: 'Profile updated successfully!',
      });
      
      router.push('/dashboard');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        variant: 'destructive',
        description: 'Failed to update profile. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
      <h1 className="text-2xl font-bold mb-6 text-center">Complete Your Health Profile</h1>
      <p className="mb-8 text-center text-gray-600">
        This information helps us personalize your health assistant experience.
      </p>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium mb-1">
            Full Name
          </label>
          <Input
            id="fullName"
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
            required
          />
        </div>
        
        <div>
          <label htmlFor="dateOfBirth" className="block text-sm font-medium mb-1">
            Date of Birth
          </label>
          <Input
            id="dateOfBirth"
            name="dateOfBirth"
            type="date"
            value={formData.dateOfBirth}
            onChange={handleChange}
            required
          />
        </div>
        
        <div>
          <label htmlFor="phoneNumber" className="block text-sm font-medium mb-1">
            Phone Number
          </label>
          <Input
            id="phoneNumber"
            name="phoneNumber"
            value={formData.phoneNumber}
            onChange={handleChange}
          />
        </div>
        
        <div>
          <label htmlFor="emergencyContact" className="block text-sm font-medium mb-1">
            Emergency Contact Name
          </label>
          <Input
            id="emergencyContact"
            name="emergencyContact"
            value={formData.emergencyContact}
            onChange={handleChange}
          />
        </div>
        
        <div>
          <label htmlFor="emergencyContactPhone" className="block text-sm font-medium mb-1">
            Emergency Contact Phone
          </label>
          <Input
            id="emergencyContactPhone"
            name="emergencyContactPhone"
            value={formData.emergencyContactPhone}
            onChange={handleChange}
          />
        </div>
        
        <div>
          <label htmlFor="medicalConditions" className="block text-sm font-medium mb-1">
            Medical Conditions (comma separated)
          </label>
          <Input
            id="medicalConditions"
            name="medicalConditions"
            value={formData.medicalConditions}
            onChange={handleChange}
            placeholder="Diabetes, Hypertension, etc."
          />
        </div>
        
        <div>
          <label htmlFor="allergies" className="block text-sm font-medium mb-1">
            Allergies (comma separated)
          </label>
          <Input
            id="allergies"
            name="allergies"
            value={formData.allergies}
            onChange={handleChange}
            placeholder="Penicillin, Peanuts, etc."
          />
        </div>
        
        <Button 
          type="submit" 
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : 'Save Profile'}
        </Button>
      </form>
    </div>
  );
} 