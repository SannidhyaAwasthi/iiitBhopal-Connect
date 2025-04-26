
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { FirebaseProvider } from '@/context/firebase-context';
import { Toaster } from "@/components/ui/toaster";
import DashboardLayout from '@/components/dashboard'; // Import the DashboardLayout

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'IIIT Bhopal Connect',
  description: 'Connecting students at IIIT Bhopal',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className={`antialiased`} suppressHydrationWarning={true}>
        <FirebaseProvider>
          {/* Wrap the children with DashboardLayout */}
          <DashboardLayout>
              {children}
          </DashboardLayout>
          <Toaster />
        </FirebaseProvider>
      </body>
    </html>
  );
}
