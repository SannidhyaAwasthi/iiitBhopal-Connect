import React from 'react';
import type { User } from 'firebase/auth';
import type { StudentProfile } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"; // Added Button import

interface UserProfileProps {
    user: User | null; // Firebase auth user
    studentData: StudentProfile | null; // Fetched student profile data
}

// Helper to get initials
const getInitials = (name: string = '') => {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();
};

// Helper component to display a profile field
const ProfileField: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="grid grid-cols-3 gap-4 items-center">
        <span className="text-sm font-medium text-muted-foreground text-right col-span-1">{label}</span>
        <span className="text-sm col-span-2">{value || '-'}</span>
    </div>
);

const UserProfile: React.FC<UserProfileProps> = ({ user, studentData }) => {

    if (!studentData) {
        return <p>Loading profile data...</p>;
    }

    const isGuest = studentData.email === 'guest@iiitbhopal.ac.in'; // Keep check for display logic if needed

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-2xl font-semibold">My Profile</h2>
            <Card>
                <CardHeader className="flex flex-row items-center gap-4 pb-4">
                    <Avatar className="h-16 w-16">
                        <AvatarFallback className="text-xl">{getInitials(studentData.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-grow">
                        <CardTitle className="text-xl mb-1">{studentData.name}</CardTitle>
                        <CardDescription>{studentData.email}</CardDescription>
                         {studentData.specialRoles && studentData.specialRoles.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                                {studentData.specialRoles.map(role => (
                                    <Badge key={role} variant="secondary">{role}</Badge>
                                ))}
                            </div>
                        )}
                    </div>
                </CardHeader>
                <Separator />
                <CardContent className="pt-6 space-y-4">
                    <ProfileField label="Scholar Number" value={studentData.scholarNumber} />
                    <ProfileField label="Phone Number" value={studentData.phoneNumber} />
                    {!isGuest && (
                        <>
                            <ProfileField label="Branch" value={studentData.branch} />
                            <ProfileField label="Program" value={studentData.programType} />
                            <ProfileField label="Year of Passing" value={studentData.yearOfPassing} />
                            <ProfileField label="Gender" value={studentData.gender} />
                        </>
                    )}
                     {/* Add more fields as needed */} 

                    {/* Removed Edit Profile Button Section */}
                     
                </CardContent>
            </Card>
        </div>
    );
};

export default UserProfile;
