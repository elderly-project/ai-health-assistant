'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/supabase/functions/_lib/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function AddPatientPage() {
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  useEffect(() => {
    // Get the current user
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    
    getUser();
  }, [supabase]);
  
  // Generate a random password
  const generatePassword = () => {
    const length = 12;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setGeneratedPassword(password);
    return password;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !firstName) {
      toast({
        variant: 'destructive',
        description: 'Please fill in required fields.',
      });
      return;
    }
    
    if (!currentUserId) {
      toast({
        variant: 'destructive',
        description: 'You must be logged in to add patients.',
      });
      return;
    }
    
    try {
      setLoading(true);
      
      // Generate a password if not already generated
      const password = generatedPassword || generatePassword();
      
      // Create a new user in Supabase Auth using edge function
      const { data, error } = await supabase.functions.invoke('create-patient-user', {
        body: {
          email,
          password,
          fullName: `${firstName} ${lastName}`.trim(),
          creatorId: currentUserId, // Pass the creator's ID
        },
      });
      
      if (error) {
        console.error('Function error:', error);
        // throw new Error(`Failed to create patient: ${error.message}`);
      }
      
      if (!data || !data.userId) {
        throw new Error('Failed to create patient account: No user ID returned');
      }
      
      // Check if there was a warning about profile creation
      if (data.warning) {
        console.warn('Profile creation warning:', data.warning, data.profileError);
        // We still show success since the user was created in Auth
      }
      
      toast({
        description: 'Patient account created successfully!',
      });
      
      // Show generated password
      if (!generatedPassword) {
        setGeneratedPassword(password);
        setShowPassword(true);
      }
      
      // Redirect after a short delay if we're not showing the password
      if (!showPassword) {
        setTimeout(() => {
          router.push('/patients');
        }, 1500);
      }
    } catch (error) {
      console.error('Error creating patient:', error);
      toast({
        variant: 'destructive',
        description: `${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <Link href="/patients" className="flex items-center text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Patients
        </Link>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-6">Add New Patient</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email<span className="text-red-500">*</span></Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="patient@example.com"
                required
                className="mt-1"
              />
              <p className="text-sm text-gray-500 mt-1">
                Patient will use this email to log in to their account
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name<span className="text-red-500">*</span></Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First Name"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last Name"
                  className="mt-1"
                />
              </div>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1">
                <Label htmlFor="password">Password</Label>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => generatePassword()}
                  className="text-xs"
                >
                  Generate Password
                </Button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={generatedPassword}
                  readOnly
                  placeholder="Auto-generated password"
                  className="mt-1 pr-24"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={!generatedPassword}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </Button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                A secure password will be auto-generated for the patient
              </p>
            </div>
          </div>
          
          <div className="pt-4 flex justify-end space-x-3">
            <Button type="button" variant="outline" onClick={() => router.push('/patients')}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Patient Account
            </Button>
          </div>
        </form>
        
        {showPassword && generatedPassword && (
          <div className="mt-6 p-4 border border-green-200 bg-green-50 rounded-md">
            <h3 className="font-medium text-green-800 mb-2">Patient Account Created!</h3>
            <p className="text-sm text-green-800 mb-3">
              Please share these login credentials with the patient:
            </p>
            <div className="bg-white p-3 rounded border border-green-200 mb-3">
              <div className="mb-2">
                <span className="font-medium">Email:</span> {email}
              </div>
              <div>
                <span className="font-medium">Password:</span> {generatedPassword}
              </div>
            </div>
            <div className="flex justify-end">
              <Button 
                type="button" 
                onClick={() => router.push('/patients')}
              >
                Continue to Patients
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 