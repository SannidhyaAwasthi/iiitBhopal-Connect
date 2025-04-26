
'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import LoadingSpinner from '@/components/loading-spinner';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        // User is logged in, redirect to the main dashboard/home page
        router.push('/home'); // Ensure this matches the actual home route
      } else {
        // User is not logged in, redirect to the login page
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  // Show loading spinner while checking auth state and redirecting
  return <LoadingSpinner />;
}

    