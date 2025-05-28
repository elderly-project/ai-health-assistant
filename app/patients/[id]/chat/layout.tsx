import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PropsWithChildren } from 'react';

export default async function PatientChatLayout({ 
  children,
  params 
}: PropsWithChildren<{ params: { id: string } }>) {
  // Keep cookies in the JS execution context for Next.js build
  const cookieStore = cookies();

  const supabase = createServerComponentClient({ cookies: () => cookieStore });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect('/login');
  }

  // Check if the user has access to this patient
  const { data: relationship, error } = await supabase
    .from('patient_relationships')
    .select('*')
    .eq('provider_id', user.id)
    .eq('patient_id', params.id)
    .single();

  if (error || !relationship) {
    return redirect('/patients');
  }

  return <>{children}</>;
} 