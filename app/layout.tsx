import { Inter } from 'next/font/google';
import './globals.css';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

import { Toaster } from '@/components/ui/toaster';
import LogoutButton from '@/components/LogoutButton';
import Providers from '@/lib/providers';
import { PropsWithChildren } from 'react';

// Use client components to avoid hydration errors from browser extensions
import ClientSideLayout from '@/components/ClientSideLayout';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Health Assistant',
  description:
    'A health assistant application that helps you manage medications and appointments.',
};

export default async function RootLayout({ children }: PropsWithChildren) {
  // Keep cookies in the JS execution context for Next.js build
  const cookieStore = cookies();

  const supabase = createServerComponentClient({ cookies: () => cookieStore });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en" className={inter.className}>
      <body className="min-h-screen flex flex-col">
        <Providers>
          <ClientSideLayout user={user}>
            {children}
          </ClientSideLayout>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
