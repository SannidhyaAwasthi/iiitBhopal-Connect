'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({ title: "Login Successful", description: "Welcome back!" });
      router.push('/'); // Redirect to homepage after successful login
    } catch (error: any) {
      console.error('Login error:', error);
       toast({
          variant: "destructive",
          title: "Login Failed",
          description: error.message || "An unexpected error occurred.",
       });
    } finally {
      setLoading(false);
    }
  };

   const handleGuestLogin = async () => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, 'guest@example.com', 'guestpassword'); // Use secure guest credentials
      toast({ title: "Guest Login Successful", description: "Logged in as Guest." });
      router.push('/');
    } catch (error: any) {
      console.error('Guest login error:', error);
       // Pre-create guest user in Firebase console if needed.
       if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
         toast({
            variant: "destructive",
            title: "Guest Login Failed",
            description: "Guest account not set up correctly. Please contact admin.",
         });
       } else {
        toast({
           variant: "destructive",
           title: "Guest Login Failed",
           description: error.message || "An unexpected error occurred.",
        });
       }
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="flex items-center justify-center min-h-screen bg-secondary">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">IIIT Bhopal Connect</CardTitle>
          <CardDescription>Login to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@iiitbhopal.ac.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </Button>
             <Button type="button" variant="outline" className="w-full mt-2" onClick={handleGuestLogin} disabled={loading}>
              {loading ? 'Logging in...' : 'Login as Guest'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center text-sm">
          Don't have an account?{' '}
          <Link href="/signup" className="ml-1 text-primary hover:underline">
            Sign up
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
