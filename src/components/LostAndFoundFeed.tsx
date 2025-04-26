import type { FC } from 'react';
import { useState, useEffect, useCallback } from 'react';
import type { User } from 'firebase/auth';
import type { StudentProfile, LostAndFoundItem } from '@/types';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import LoadingSpinner from './loading-spinner';
import { fetchLostItems, fetchFoundItems } from '@/lib/lostAndFoundActions';
import { LostItemCard } from './LostItemCard';
import { FoundItemCard } from './FoundItemCard';
import { ReportLostItemDialog } from './ReportLostItemDialog';
import { ReportFoundItemDialog } from './ReportFoundItemDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface LostAndFoundFeedProps {
    user: User | null;
    studentData: StudentProfile | null;
}

const LostAndFoundFeed: FC<LostAndFoundFeedProps> = ({ user, studentData }) => {
    const [lostItems, setLostItems] = useState<LostAndFoundItem[]>([]);
    const [foundItems, setFoundItems] = useState<LostAndFoundItem[]>([]);
    const [loadingLost, setLoadingLost] = useState(true);
    const [loadingFound, setLoadingFound] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isReportLostOpen, setIsReportLostOpen] = useState(false);
    const [isReportFoundOpen, setIsReportFoundOpen] = useState(false);
    const { toast } = useToast();

    const loadItems = useCallback(async () => {
        setLoadingLost(true);
        setLoadingFound(true);
        setError(null);
        try {
            const [lost, found] = await Promise.all([
                fetchLostItems(),
                fetchFoundItems()
            ]);
            setLostItems(lost);
            setFoundItems(found);
        } catch (err: any) {
            console.error("Error fetching lost and found items:", err);
            setError("Failed to load items. Please try again later.");
            toast({
                variant: "destructive",
                title: "Error Loading Items",
                description: err.message || "Could not fetch lost and found items.",
            });
        } finally {
            setLoadingLost(false);
            setLoadingFound(false);
        }
    }, [toast]);

    useEffect(() => {
        loadItems();
    }, [loadItems]);

    // Renamed function for clarity
    const handleUpdateSuccess = () => {
        loadItems(); // Refresh the lists after successful action
        setIsReportLostOpen(false); // Close dialogs if they were open
        setIsReportFoundOpen(false);
    };

    const isLoading = loadingLost || loadingFound;

    // Determine if the user can report items (must be logged in and profile loaded)
    const canReport = user && studentData && user.email !== 'guest@iiitbhopal.ac.in';


    return (
        <div className="lost-found-feed-container max-w-4xl mx-auto p-4 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                <h2 className="text-2xl font-semibold">Lost & Found</h2>
                {canReport ? (
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <Button onClick={() => setIsReportLostOpen(true)} size="sm" variant="outline" className="w-full sm:w-auto">
                            <PlusCircle className="mr-2 h-4 w-4" /> Report Lost Item
                        </Button>
                        <Button onClick={() => setIsReportFoundOpen(true)} size="sm" variant="default" className="w-full sm:w-auto">
                            <PlusCircle className="mr-2 h-4 w-4" /> Report Found Item
                        </Button>
                    </div>
                 ) : (
                     <Alert variant="default" className="w-full sm:w-auto text-sm p-2">
                          <AlertDescription>Login with a student account to report items.</AlertDescription>
                     </Alert>
                 )}
            </div>

            {error && <p className="text-center py-10 text-red-500 dark:text-red-400">{error}</p>}

            <Tabs defaultValue="found" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="found">Found Items</TabsTrigger>
                    <TabsTrigger value="lost">Lost Items</TabsTrigger>
                </TabsList>
                <TabsContent value="found" className="mt-4">
                    {loadingFound ? (
                         <div className="text-center py-10"><LoadingSpinner /> Loading found items...</div>
                    ) : foundItems.length === 0 && !error ? (
                        <p className="text-center py-10 text-muted-foreground">No found items reported yet.</p>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {foundItems.map(item => (
                                <FoundItemCard
                                    key={item.id}
                                    item={item}
                                    currentUser={user}
                                    onUpdate={handleUpdateSuccess} // Pass refresh function
                                />
                            ))}
                        </div>
                    )}
                </TabsContent>
                <TabsContent value="lost" className="mt-4">
                     {loadingLost ? (
                         <div className="text-center py-10"><LoadingSpinner /> Loading lost items...</div>
                    ) : lostItems.length === 0 && !error ? (
                        <p className="text-center py-10 text-muted-foreground">No lost items reported yet.</p>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {lostItems.map(item => (
                                <LostItemCard
                                    key={item.id}
                                    item={item}
                                    currentUser={user}
                                    currentStudentProfile={studentData}
                                    onUpdate={handleUpdateSuccess} // <-- Changed prop name
                                />
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>


            {/* --- Dialogs for Reporting --- */}
             <ReportLostItemDialog
                isOpen={isReportLostOpen}
                onOpenChange={setIsReportLostOpen}
                user={user}
                studentData={studentData}
                onSuccess={handleUpdateSuccess} // Use updated handler name
            />

            <ReportFoundItemDialog
                isOpen={isReportFoundOpen}
                onOpenChange={setIsReportFoundOpen}
                user={user}
                studentData={studentData}
                onSuccess={handleUpdateSuccess} // Use updated handler name
            />

        </div>
    );
};

export default LostAndFoundFeed; // Ensure correct casing
