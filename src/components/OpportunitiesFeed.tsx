import React, { useState, useEffect, useCallback } from 'react';
import type { User } from 'firebase/auth';
import type { StudentProfile, Opportunity } from '@/types';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import LoadingSpinner from './loading-spinner';
import { fetchOpportunities } from '@/lib/opportunityActions'; // Assuming this action exists
import { OpportunityCard } from './OpportunityCard';
import { CreateOpportunityForm } from './CreateOpportunityForm'; // Import the creation form
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";


interface OpportunitiesFeedProps {
    user: User | null;
    studentData: StudentProfile | null;
}

export const OpportunitiesFeed: React.FC<OpportunitiesFeedProps> = ({ user, studentData }) => {
    const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCreateOpportunityOpen, setIsCreateOpportunityOpen] = useState(false);
    const [appliedOpportunities, setAppliedOpportunities] = useState<string[]>([]); // Track which opportunities the user has marked as applied
    const { toast } = useToast();
    const [jd, setJd] = useState('');
    const [isOpenJD, setIsOpenJD] = useState(false); // Track open JD

    const loadOpportunities = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Pass studentData for eligibility filtering
            const fetchedOpportunities = await fetchOpportunities(studentData);
            setOpportunities(fetchedOpportunities);
        } catch (err: any) {
            console.error("Error fetching opportunities:", err);
            setError("Failed to load opportunities. Please try again later.");
            if (!(err.code === 'permission-denied' || err.message?.includes('permissions'))) {
                 toast({
                    variant: "destructive",
                    title: "Error Loading Opportunities",
                    description: err.message || "Could not fetch opportunities.",
                });
            }
             setOpportunities([]); // Clear opportunities on error
        } finally {
            setLoading(false);
        }
    }, [toast, studentData]); // Depend on studentData

    useEffect(() => {
        // Load opportunities whenever studentData changes (or initially)
        if (user !== undefined) { // Only load when auth state is settled
            loadOpportunities();
        }
    }, [user, studentData, loadOpportunities]); // Add studentData as dependency

    const handleCreateSuccess = () => {
        loadOpportunities(); // Refresh list after successful creation
    };

     const handleMarkAsApplied = (opportunityId: string) => {
         setAppliedOpportunities([...appliedOpportunities, opportunityId]);
         toast({ title: "Marked as Applied!", description: "This opportunity has been added to your applications." });
     };

    const canCreate = user && studentData; // User must be logged in and profile loaded

    return (
        <div className="opportunities-feed-container max-w-4xl mx-auto p-4 space-y-6">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                <h2 className="text-2xl font-semibold">Opportunities</h2>
                {canCreate ? (
                     <Button onClick={() => setIsCreateOpportunityOpen(true)} size="sm" variant="default">
                         <PlusCircle className="mr-2 h-4 w-4" /> Post Opportunity
                    </Button>
                 ) : (
                      user !== undefined && // Show only if auth is settled
                     <Alert variant="default" className="w-full sm:w-auto text-sm p-2">
                          <AlertDescription>
                              {user ? "Loading profile or profile unavailable..." : "Login to post opportunities."}
                          </AlertDescription>
                     </Alert>
                 )}
            </div>

            {error && <p className="text-center py-10 text-red-500 dark:text-red-400">{error}</p>}

            {loading && (
                <div className="text-center py-10"><LoadingSpinner /> Loading opportunities...</div>
            )}

            {!loading && opportunities.length === 0 && !error && (
                 <p className="text-center py-10 text-muted-foreground">
                     {user ? "No opportunities matching your eligibility found, or none posted yet." : "Login to view opportunities."}
                 </p>
             )}

            {!loading && opportunities.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2">
                    {opportunities.map(opp => (
                        <OpportunityCard
                            key={opp.id}
                            opportunity={opp}
                            currentUser={user}
                            currentStudentProfile={studentData}
                            onMarkAsApplied={() => handleMarkAsApplied(opp.id)} // Pass the ID
                            applied={appliedOpportunities.includes(opp.id)} // Pass applied state
                            setJd={() => { setJd(opp.description || ''); setIsOpenJD(true) }}
                        />
                    ))}
                </div>
            )}

             <CreateOpportunityForm
                 user={user}
                 studentData={studentData}
                 isOpen={isCreateOpportunityOpen}
                 onOpenChange={setIsCreateOpportunityOpen}
                 onSuccess={handleCreateSuccess}
             />

             <Dialog open={isOpenJD} onOpenChange={setIsOpenJD}>
                 <DialogContent>
                     <DialogHeader>
                         <DialogTitle> Job Description </DialogTitle>
                     </DialogHeader>
                     <p>{jd}</p>
                 </DialogContent>
             </Dialog>
        </div>
    );
};
