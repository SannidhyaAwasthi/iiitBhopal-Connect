'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";

// Scholar number format: YY(U/P)XXZZZ
const scholarNumberRegex = /^(\d{2})([UP])(0[1-3])(\d{3})$/;

const getBranchName = (code: string): string => {
  switch (code) {
    case '01': return 'ECE';
    case '02': return 'CSE';
    case '03': return 'IT';
    default: return 'Unknown';
  }
};

export default function SignupPage() {
  const [name, setName] = useState('');
  const [scholarNumber, setScholarNumber] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
   const { toast } = useToast();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); // Clear previous errors

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
       toast({ variant: "destructive", title: "Signup Error", description: "Passwords do not match." });
      return;
    }

    const match = scholarNumber.match(scholarNumberRegex);
    if (!match) {
      setError("Invalid Scholar Number format. Expected format: YY(U/P)XXZZZ (e.g., 22U01030).");
        toast({ variant: "destructive", title: "Signup Error", description: "Invalid Scholar Number format." });
      return;
    }

    setLoading(true);

    try {
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update user profile (optional, Firebase Auth profile)
      await updateProfile(user, { displayName: name });

      // Extract data from scholar number
      const [, admissionYearStr, programType, branchCode, rollNumber] = match;
      const admissionYear = parseInt(`20${admissionYearStr}`, 10);
      const programDuration = programType === 'U' ? 4 : 2;
      const yearOfPassing = admissionYear + programDuration;
      const branch = getBranchName(branchCode);

      // Store user data in Firestore "students" collection
      // Using scholarNumber as the document ID for easy lookup
      await setDoc(doc(db, 'students', scholarNumber), {
        name: name,
        scholarNumber: scholarNumber,
        email: email,
        phoneNumber: phoneNumber,
        branch: branch,
        yearOfPassing: yearOfPassing,
        programType: programType === 'U' ? 'Undergraduate' : 'Postgraduate',
        // Add default fields if needed
        specialRoles: [], // e.g., 'CR', 'Admin'
        // section: 'A', // Example, adjust as needed
      });

      toast({ title: "Signup Successful", description: "Your account has been created." });
      router.push('/'); // Redirect to homepage after successful signup

    } catch (error: any) {
      console.error('Signup error:', error);
      setError(error.message || "An unexpected error occurred during signup.");
        toast({
          variant: "destructive",
          title: "Signup Failed",
          description: error.message || "An unexpected error occurred.",
       });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-secondary">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">IIIT Bhopal Connect</CardTitle>
          <CardDescription>Create a new account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-3">
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
             <div className="space-y-1">
              <Label htmlFor="scholarNumber">Scholar Number</Label>
              <Input
                id="scholarNumber"
                type="text"
                placeholder="e.g., 22U01030"
                value={scholarNumber}
                onChange={(e) => setScholarNumber(e.target.value.toUpperCase())} // Ensure U/P are uppercase
                required
                pattern="\d{2}[UP](0[1-3])\d{3}" // Basic pattern validation on input
                title="Format: YY(U/P)XXZZZ (e.g., 22U01030)"
                disabled={loading}
              />
               <p className="text-xs text-muted-foreground">Format: YY(U/P)XXZZZ (e.g., 22U01030)</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Your Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-1">
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
             <div className="space-y-1">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                type="tel"
                placeholder="Your Phone Number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
                 disabled={loading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6} // Firebase requires at least 6 characters
                 disabled={loading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                 disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing up...' : 'Sign Up'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center text-sm">
          Already have an account?{' '}
          <Link href="/login" className="ml-1 text-primary hover:underline">
            Login
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
