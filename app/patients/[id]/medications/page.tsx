'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/supabase/functions/_lib/database';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { ArrowLeft, Plus, Edit, Trash2, Pill } from 'lucide-react';

interface Medication {
  id: number;
  user_id: string;
  name: string;
  dosage: string;
  frequency: string;
  start_date: string | null;
  end_date: string | null;
  prescribing_doctor: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface PatientProfile {
  id: string;
  full_name: string | null;
}

export default function PatientMedicationsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();
  const [loading, setLoading] = useState(true);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [patient, setPatient] = useState<PatientProfile | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
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
        
        // Fetch medications
        const { data: medsData, error: medsError } = await supabase
          .from('medications')
          .select('*')
          .eq('user_id', params.id)
          .order('created_at', { ascending: false });
        
        if (medsError) {
          throw medsError;
        }
        
        setMedications(medsData || []);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          variant: 'destructive',
          description: 'Failed to load medications.',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase, params.id]);

  const handleDeleteMedication = async (medicationId: number) => {
    if (!confirm('Are you sure you want to delete this medication?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('medications')
        .delete()
        .eq('id', medicationId);

      if (error) throw error;

      setMedications(prev => prev.filter(med => med.id !== medicationId));
      toast({
        description: 'Medication deleted successfully.',
      });
    } catch (error) {
      console.error('Error deleting medication:', error);
      toast({
        variant: 'destructive',
        description: 'Failed to delete medication.',
      });
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not specified';
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading medications...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <Link href={`/patients/${params.id}`} className="flex items-center text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Patient Profile
        </Link>
      </div>
      
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Medications</h1>
          <p className="text-gray-600">
            Managing medications for {patient?.full_name || `Patient ${params.id.substring(0, 8)}...`}
          </p>
        </div>
        <Link href={`/patients/${params.id}/medications/add`}>
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Medication
          </Button>
        </Link>
      </div>

      {medications.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {medications.map((medication) => (
            <Card key={medication.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex items-center space-x-2">
                  <Pill className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-lg">{medication.name}</CardTitle>
                </div>
                <div className="flex space-x-1">
                  <Link href={`/patients/${params.id}/medications/${medication.id}/edit`}>
                    <Button variant="ghost" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleDeleteMedication(medication.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm font-medium">Dosage:</span>
                    <p className="text-sm text-gray-600">{medication.dosage}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Frequency:</span>
                    <p className="text-sm text-gray-600">{medication.frequency}</p>
                  </div>
                  {medication.prescribing_doctor && (
                    <div>
                      <span className="text-sm font-medium">Prescribed by:</span>
                      <p className="text-sm text-gray-600">{medication.prescribing_doctor}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                    <div>
                      <span className="font-medium">Start:</span>
                      <p>{formatDate(medication.start_date)}</p>
                    </div>
                    <div>
                      <span className="font-medium">End:</span>
                      <p>{formatDate(medication.end_date)}</p>
                    </div>
                  </div>
                  {medication.notes && (
                    <div>
                      <span className="text-sm font-medium">Notes:</span>
                      <p className="text-sm text-gray-600">{medication.notes}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <Pill className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No medications found</h3>
            <p className="text-gray-600 mb-6">
              This patient doesn't have any medications recorded yet.
            </p>
            <Link href={`/patients/${params.id}/medications/add`}>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add First Medication
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 