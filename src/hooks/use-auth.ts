import { useFirebase } from '@/context/firebase-context';

export const useAuth = () => {
  const context = useFirebase();
  if (context === undefined) {
    throw new Error('useAuth must be used within a FirebaseProvider');
  }
  return context;
};
