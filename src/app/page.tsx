
'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
// Remove Dashboard import as it's now handled by layout
import LoadingSpinner from '@/components/loading-spinner';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push('/home'); // Redirect logged-in users to the new homepage
      } else {
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  // Show loading spinner while checking auth state and redirecting
  return <LoadingSpinner />;

  // // Original logic (keeping for reference, but replaced by redirect)
  // if (loading) {
  //   return <LoadingSpinner />;
  // }
  // if (!user) {
  //   // Redirecting handled by useEffect, show loading or null while redirecting
  //   return <LoadingSpinner />;
  // }
  // // Dashboard is rendered by the layout, this page just triggers the redirect
  // return null;
}
