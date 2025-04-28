'use client';

import React, { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import type { StudentProfile, Opportunity } from '@/types';
import LoadingSpinner from './loading-spinner';
import { fetchOpportunities } from '@/lib/opportunityActions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface UserApplicationsProps {
    user: User | null;
    studentData: StudentProfile | null;
}

const UserApplications: React.FC<UserApplicationsProps> = ({ user, studentData }) => {
    const [availableOpportunities, setAvailableOpportunities] = useState<Opportunity[]>([]);
    const [appliedOpportunities, setAppliedOpportunities] = useState<string[]>([]); // Track which opportunities the user has marked as applied (just IDs)
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadOpportunities = async () => {
            setLoading(true);
            setError(null);
            try {
                // Fetch ALL opportunities (regardless of eligibility) just to get counts
                const allOpportunities = await fetchOpportunities();

                // Then fetch only the ELIGIBLE opportunities for display
                if (studentData) {
                    const eligibleOpps = await fetchOpportunities(studentData);
                    setAvailableOpportunities(eligibleOpps);
                } else {
                    setAvailableOpportunities([]);
                }

                setLoading(false);
            } catch (err: any) {
                console.error("Error fetching opportunities:", err);
                setError("Failed to load opportunities. Please try again later.");
                setAvailableOpportunities([]);
            } finally {
                setLoading(false);
            }
        };

        if (user !== undefined) {
            loadOpportunities();
        }
    }, [user, studentData]);

    // -- Mock Applying --
    const totalOpportunities = availableOpportunities.length;
    const notEligibleOpportunities = 0;

    if (loading) {
        return <div className="text-center py-10"><LoadingSpinner /> Loading applications...</div>;
    }

    if (error) {
        return <p className="text-center py-10 text-red-500 dark:text-red-400">{error}</p>;
    }

    return (
        <div className="user-applications-container max-w-3xl mx-auto p-4 space-y-6">
            <h2 className="text-2xl font-semibold mb-4">My Applications</h2>

            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                 {/* Total Opportunities */}
                <Card>
                     <CardHeader>
                         <CardTitle>Total Opportunities</CardTitle>
                         <CardDescription>All posted opportunities.</CardDescription>
                     </CardHeader>
                     <CardContent>
                         <div className="text-2xl font-bold">{totalOpportunities}</div>
                     </CardContent>
                </Card>

                 {/* Available (Eligible) Opportunities */}
                 <Card>
                     <CardHeader>
                         <CardTitle>Eligible Opportunities</CardTitle>
                         <CardDescription>Opportunities you are eligible for.</CardDescription>
                     </CardHeader>
                     <CardContent>
                         <div className="text-2xl font-bold">{availableOpportunities.length}</div>
                     </CardContent>
                 </Card>

                {/* Marked as Applied Opportunities */}
                <Card>
                     <CardHeader>
                         <CardTitle>Marked as Applied</CardTitle>
                         <CardDescription>Opportunities you've marked as applied to.</CardDescription>
                     </CardHeader>
                     <CardContent>
                         <div className="text-2xl font-bold">{appliedOpportunities.length}</div>
                     </CardContent>
                 </Card>

                 {/* Not Eligible Opportunities (if you still want to track this) */}
                 {/* <Card>
                     <CardHeader>
                         <CardTitle>Not Eligible</CardTitle>
                         <CardDescription>Opportunities you aren't eligible for.</CardDescription>
                     </CardHeader>
                     <CardContent>
                         <div className="text-2xl font-bold">{notEligibleOpportunities}</div>
                     </CardContent>
                 </Card> */}
            </div>

            {/* Implement a list of applied opportunities here if you want to show more details */}

        </div>
    );
};

export default UserApplications;
