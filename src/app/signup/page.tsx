'use client';

import { useState, useEffect } from 'react';
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
  console.log("[getBranchName] Input code:", code);
  switch (code) {
    case '01': return 'ECE';
    case '02': return 'CSE';
    case '03': return 'IT';
    default: 
      console.error("[getBranchName] Unknown branch code:", code);
      return 'Unknown'; // Or potentially throw an error if this shouldn't happen
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
  const [signupSuccess, setSignupSuccess] = useState(false);
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
      setError("Invalid Scholar Number format. Expected format: YY(U/P)XXZZZ.");
      toast({ variant: "destructive", title: "Signup Error", description: "Invalid Scholar Number format." });
      return;
    }

    setLoading(true);

    try {
      console.log("[handleSignup] Starting signup process...");
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log("[handleSignup] Auth user created/retrieved:", user.uid);

      // Update user profile
      await updateProfile(user, { displayName: name });
      console.log("[handleSignup] Profile updated with displayName:", name);

      // Extract data from scholar number
      const [, admissionYearStr, programType, branchCode, rollNumber] = match;
      const admissionYear = parseInt(`20${admissionYearStr}`, 10);
      const programDuration = programType === 'U' ? 4 : 2;
      const yearOfPassing = admissionYear + programDuration;
      
      // --- Debugging getBranchName --- 
      console.log("[handleSignup] Determining branch from code:", branchCode);
      const branch = getBranchName(branchCode);
      console.log("[handleSignup] Branch determined:", branch);
      if (branch === 'Unknown') {
        console.warn("[handleSignup] Branch resolved to 'Unknown'. Check getBranchName logic and input.");
        // Consider if you want to stop signup here if branch is Unknown
      }
      // --- End Debugging getBranchName --- 

      // Store user data in Firestore
      const studentData = {
        name: name,
        scholarNumber: scholarNumber,
        email: email,
        phoneNumber: phoneNumber,
        branch: branch,
        yearOfPassing: yearOfPassing,
        programType: programType === 'U' ? 'Undergraduate' : 'Postgraduate',
        specialRoles: [],
        uid: user.uid,
      };

      // --- Debugging Firestore --- 
      console.log("[handleSignup] Firestore instance (db):", db); // Check if db object exists
      console.log("[handleSignup] Student data prepared:", JSON.stringify(studentData, null, 2));
      console.log(`[handleSignup] Attempting to write to Firestore collection 'students' with ID: ${scholarNumber}`);
      
      await setDoc(doc(db, 'students', scholarNumber), studentData);
      console.log("[handleSignup] Successfully wrote to 'students' collection.");

      console.log(`[handleSignup] Attempting to write to Firestore collection 'students-by-uid' with ID: ${user.uid}`);
      await setDoc(doc(db, 'students-by-uid', user.uid), { scholarNumber: scholarNumber });
      console.log("[handleSignup] Successfully wrote to 'students-by-uid' collection.");
      // --- End Debugging Firestore --- 

      // Show success toast
      toast({
        title: "Signup Successful!",
        description: "Your account has been created. Redirecting to login...",
      });

      // Set signup success to trigger redirect
      setSignupSuccess(true);
      // Keep loading true until redirect starts in useEffect
      // setLoading(false); // We remove this so the button stays disabled until redirect

    } catch (error: any) {
      console.error('Signup error during Firestore write or earlier:', error);
      // Check if the error is specifically a Firestore permission error
      if (error.code === 'permission-denied') {
         setError("Firestore permission denied. Check your security rules.");
         toast({ variant: "destructive", title: "Signup Failed", description: "Database permission error. Contact support." });
      } else {
        setError(error.message || "An unexpected error occurred during signup.");
        toast({
          variant: "destructive",
          title: "Signup Failed",
          description: error.message || "An unexpected error occurred.",
        });
      }
      setLoading(false); // Stop loading only on error
    }
  };

  // Handle redirect after successful signup
  useEffect(() => {
    if (signupSuccess) {
      console.log("[useEffect] Signup success detected, preparing redirect...");
      // Wait for 1.5 seconds to allow toast visibility, then redirect
      const timer = setTimeout(() => {
        console.log("[useEffect] Redirecting to /login");
        router.push('/login');
      }, 1500);
      return () => clearTimeout(timer); // Cleanup timer on unmount
    }
  }, [signupSuccess, router]);

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
                value={scholarNumber}
                onChange={(e) => setScholarNumber(e.target.value.toUpperCase())}
                required
                pattern="\d{2}[UP](0[1-3])\d{3}"
                title="Format: YY(U/P)XXZZZ"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">Format: YY(U/P)XXZZZ</p>
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
                minLength={6}
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
