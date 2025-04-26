
'use client'; // Required for using usePathname

import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { FirebaseProvider } from '@/context/firebase-context';
import { Toaster } from "@/components/ui/toaster";
import DashboardLayout from '@/components/dashboard'; // Import the DashboardLayout
import { usePathname } from 'next/navigation'; // Import usePathname

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// Metadata can still be defined statically if needed, but layout rendering is dynamic
// export const metadata: Metadata = {
//   title: 'IIIT Bhopal Connect',
//   description: 'Connecting students at IIIT Bhopal',
// };


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  // Determine if the current route is one where the dashboard layout should NOT be shown
  const noDashboardRoutes = ['/login', '/signup'];
  const showDashboard = !noDashboardRoutes.includes(pathname);

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
         {/* Add title here if not using static metadata */}
         <title>IIIT Bhopal Connect</title>
         <meta name="description" content="Connecting students at IIIT Bhopal" />
       </head>
      <body className={`antialiased`} suppressHydrationWarning={true}>
        <FirebaseProvider>
           {showDashboard ? (
             // Wrap children with DashboardLayout for protected routes
             <DashboardLayout>
               {children}
             </DashboardLayout>
           ) : (
             // Render children directly for login/signup pages
             children
           )}
          <Toaster />
        </FirebaseProvider>
      </body>
    </html>
  );
}
