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

export default function AddMedicationPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();
  const [loading, setLoading] = useState(false);
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    dosage: '',
    frequency: '',
    start_date: '',
    end_date: '',
    prescribing_doctor: '',
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
    
    if (!formData.name || !formData.dosage || !formData.frequency) {
      toast({
        variant: 'destructive',
        description: 'Please fill in all required fields.',
      });
      return;
    }

    try {
      setLoading(true);
      
      const medicationData = {
        user_id: params.id,
        name: formData.name,
        dosage: formData.dosage,
        frequency: formData.frequency,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        prescribing_doctor: formData.prescribing_doctor || null,
        notes: formData.notes || null
      };

      const { error } = await supabase
        .from('medications')
        .insert([medicationData]);

      if (error) throw error;

      toast({
        description: 'Medication added successfully.',
      });

      router.push(`/patients/${params.id}/medications`);
    } catch (error) {
      console.error('Error adding medication:', error);
      toast({
        variant: 'destructive',
        description: 'Failed to add medication.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href={`/patients/${params.id}/medications`} className="flex items-center text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Medications
        </Link>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Add New Medication</CardTitle>
          <p className="text-gray-600">
            Adding medication for {patient?.full_name || `Patient ${params.id.substring(0, 8)}...`}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Medication Name<span className="text-red-500">*</span></Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g., Lisinopril"
                  required
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="dosage">Dosage<span className="text-red-500">*</span></Label>
                <Input
                  id="dosage"
                  name="dosage"
                  value={formData.dosage}
                  onChange={handleChange}
                  placeholder="e.g., 10mg"
                  required
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="frequency">Frequency<span className="text-red-500">*</span></Label>
                <Input
                  id="frequency"
                  name="frequency"
                  value={formData.frequency}
                  onChange={handleChange}
                  placeholder="e.g., Once daily"
                  required
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="prescribing_doctor">Prescribing Doctor</Label>
                <Input
                  id="prescribing_doctor"
                  name="prescribing_doctor"
                  value={formData.prescribing_doctor}
                  onChange={handleChange}
                  placeholder="e.g., Dr. Smith"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  name="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={handleChange}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  name="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={handleChange}
                  className="mt-1"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Additional notes about this medication..."
                className="mt-1"
                rows={3}
              />
            </div>
            
            <div className="flex justify-end space-x-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => router.push(`/patients/${params.id}/medications`)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Medication
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 