import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function Index() {
  const cookeStore = cookies();
  const supabase = createServerComponentClient({ cookies: () => cookeStore });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/dashboard');
  }

  return (
    <div className="w-full flex flex-col items-center">
      <div className="flex flex-col gap-14 max-w-4xl px-3 py-16 lg:py-24 text-foreground">
        <div className="flex flex-col items-center mb-4 lg:mb-12">
          <h1 className="text-4xl lg:text-5xl font-bold text-center mb-4">Your Personal Health Assistant</h1>
          <p className="text-xl lg:text-2xl !leading-tight mx-auto max-w-xl text-center my-8">
            Manage medications, track appointments, and get answers about your prescriptions with ease.
          </p>
          <div className="flex flex-row gap-4 mt-6">
            <Link
              href="/login"
              className="bg-foreground py-3 px-6 rounded-lg font-mono text-sm text-background"
            >
              Get Started
            </Link>
          </div>
        </div>
        
        <div className="w-full p-[1px] bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
          <div className="flex flex-col items-center text-center p-6 rounded-lg border">
            <svg className="w-12 h-12 mb-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            <h3 className="text-xl font-bold mb-2">Medication Management</h3>
            <p className="text-gray-600">Keep track of all your medications, dosages, and schedules in one place.</p>
          </div>
          
          <div className="flex flex-col items-center text-center p-6 rounded-lg border">
            <svg className="w-12 h-12 mb-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 className="text-xl font-bold mb-2">Appointment Tracking</h3>
            <p className="text-gray-600">Never miss a doctor's appointment with our easy-to-use scheduling system.</p>
          </div>
          
          <div className="flex flex-col items-center text-center p-6 rounded-lg border">
            <svg className="w-12 h-12 mb-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <h3 className="text-xl font-bold mb-2">AI Assistant</h3>
            <p className="text-gray-600">Chat with our AI to get answers about your medications and health concerns.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
