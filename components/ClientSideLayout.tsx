'use client';

import Link from 'next/link';
import { User } from '@supabase/supabase-js';
import LogoutButton from '@/components/LogoutButton';
import { PropsWithChildren } from 'react';

interface ClientSideLayoutProps {
  user: User | null;
}

export default function ClientSideLayout({ 
  children, 
  user 
}: PropsWithChildren<ClientSideLayoutProps>) {
  return (
    <div className="flex flex-col min-h-screen">
      <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
        <div className="w-full max-w-6xl flex justify-between items-center p-3 text-sm">
          <div className="flex flex-1 justify-between items-center">
            <Link href="/" className="font-bold text-xl">
              Health Assistant
            </Link>
            {user && (
              <div className="hidden sm:flex space-x-2">
                <Link
                  href="/dashboard"
                  className="py-2 px-3 cursor-pointer hover:bg-slate-100 font-medium rounded-md"
                >
                  Dashboard
                </Link>
                <Link
                  href="/patients"
                  className="py-2 px-3 cursor-pointer hover:bg-slate-100 font-medium rounded-md"
                >
                  Patients
                </Link>
                <Link
                  href="/files"
                  className="py-2 px-3 cursor-pointer hover:bg-slate-100 font-medium rounded-md"
                >
                  Prescriptions
                </Link>
                <Link
                  href="/chat"
                  className="py-2 px-3 cursor-pointer hover:bg-slate-100 font-medium rounded-md"
                >
                  Chat
                </Link>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <div className="hidden sm:block text-sm">
                  {user.email}
                </div>
                <LogoutButton />
              </div>
            ) : (
              <Link
                href="/login"
                className="py-2 px-4 rounded-md no-underline bg-btn-background hover:bg-btn-background-hover"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </nav>
      <main className="w-full flex flex-col items-center grow bg-background">
        {children}
      </main>
    </div>
  );
} 