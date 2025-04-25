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

    const handleReportSuccess = () => {
        loadItems(); // Refresh the lists after successful reporting
        setIsReportLostOpen(false);
        setIsReportFoundOpen(false);
    };

    const isLoading = loadingLost || loadingFound;

    return (
        <div className="lost-found-feed-container max-w-4xl mx-auto p-4 space-y-6">
            <div className="flex justify-between items-center mb-4 gap-4">
                <h2 className="text-2xl font-semibold">Lost & Found</h2>
                <div className="flex gap-2">
                    <Button onClick={() => setIsReportLostOpen(true)} size="sm" variant="outline" disabled={!user || !studentData}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Report Lost Item
                    </Button>
                    <Button onClick={() => setIsReportFoundOpen(true)} size="sm" variant="default" disabled={!user || !studentData}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Report Found Item
                    </Button>
                </div>
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
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {foundItems.map(item => (
                                <FoundItemCard
                                    key={item.id}
                                    item={item}
                                    currentUser={user}
                                    onUpdate={loadItems} // Pass refresh function
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
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {lostItems.map(item => (
                                <LostItemCard
                                    key={item.id}
                                    item={item}
                                    currentUser={user}
                                    currentStudentProfile={studentData}
                                    onItemFoundReported={handleReportSuccess} // Trigger refresh when found is reported
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
                onSuccess={handleReportSuccess}
            />

            <ReportFoundItemDialog
                isOpen={isReportFoundOpen}
                onOpenChange={setIsReportFoundOpen}
                user={user}
                studentData={studentData}
                onSuccess={handleReportSuccess}
            />

        </div>
    );
};

export default LostAndFoundFeed;
