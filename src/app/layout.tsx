'use client'; // Required for using usePathname

import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Use Inter font
import './globals.css';
import { FirebaseProvider } from '@/context/firebase-context';
import { Toaster } from "@/components/ui/toaster";
import { Dashboard } from '@/components/dashboard'; // Import the Dashboard component
import { usePathname } from 'next/navigation';

const inter = Inter({ subsets: ['latin'] }); // Initialize Inter font

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
    <html lang="en">
      <head>
         {/* Add title here if not using static metadata */}
         <title>IIIT Bhopal Connect</title>
         <meta name="description" content="Connecting students at IIIT Bhopal" />
       </head>
      <body className={`${inter.className} antialiased`} suppressHydrationWarning={true}>
        <FirebaseProvider>
           {showDashboard ? (
             // Wrap children with Dashboard for protected routes
             <Dashboard>
               {children} {/* The actual page content will be rendered here */}
             </Dashboard>
           ) : (
             // Render children directly for login/signup pages
             children
           )}
          <Toaster />
        </FirebaseProvider>
      </body>
    </html>
  );

    
