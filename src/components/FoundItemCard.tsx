import type { FC } from 'react';
import { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import type { LostAndFoundItem, Student, ClaimerInfo } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, MapPin, User as UserIcon, CheckCircle, XCircle, Trash2, Users, Info, Loader2 } from 'lucide-react'; // Added Loader2 here
import { formatDistanceToNow } from 'date-fns';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { claimItem, unclaimItem, confirmClaim, deleteFoundItem, fetchClaimerDetails } from '@/lib/lostAndFoundActions';
import LoadingSpinner from './loading-spinner'; // Import LoadingSpinner
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface FoundItemCardProps {
    item: LostAndFoundItem;
    currentUser: User | null;
    onUpdate: () => void; // Callback to refresh the list after an action
}

export const FoundItemCard: FC<FoundItemCardProps> = ({ item, currentUser, onUpdate }) => {
    const [isClaiming, setIsClaiming] = useState(false);
    const [isConfirming, setIsConfirming] = useState<string | false>(false); // Store UID being confirmed or false
    const [isDeleting, setIsDeleting] = useState(false);
    const [claimerDetails, setClaimerDetails] = useState<ClaimerInfo[]>([]);
    const [loadingClaimers, setLoadingClaimers] = useState(false);
    const { toast } = useToast();

    const isReporter = currentUser?.uid === item.reporterId;
    const hasClaimed = currentUser ? item.claimers?.includes(currentUser.uid) : false;

    // Fetch claimer details when the claimers array changes and the user is the reporter
    useEffect(() => {
        const getClaimers = async () => {
            if (isReporter && item.claimers && item.claimers.length > 0) {
                setLoadingClaimers(true);
                try {
                    const details = await fetchClaimerDetails(item.claimers);
                    setClaimerDetails(details);
                } catch (error) {
                    console.error("Error fetching claimer details:", error);
                    toast({ variant: "destructive", title: "Error", description: "Could not load claimer information." });
                } finally {
                    setLoadingClaimers(false);
                }
            } else {
                setClaimerDetails([]); // Clear details if no claimers or not the reporter
            }
        };
        getClaimers();
    }, [item.claimers, isReporter, toast]);


    const handleClaim = async () => {
        if (!currentUser) return;
        setIsClaiming(true);
        try {
            await claimItem(item.id, currentUser.uid);
            toast({ title: "Item Claimed", description: "The reporter has been notified." });
            onUpdate(); // Refresh list
        } catch (error: any) {
            console.error("Error claiming item:", error);
            toast({ variant: "destructive", title: "Claim Failed", description: error.message });
        } finally {
            setIsClaiming(false);
        }
    };

    const handleUnclaim = async () => {
        if (!currentUser) return;
        setIsClaiming(true); // Reuse claiming state for unclaim action
        try {
            await unclaimItem(item.id, currentUser.uid);
            toast({ title: "Claim Removed" });
            onUpdate(); // Refresh list
        } catch (error: any) {
            console.error("Error unclaiming item:", error);
            toast({ variant: "destructive", title: "Unclaim Failed", description: error.message });
        } finally {
            setIsClaiming(false);
        }
    };

    const handleConfirmClaim = async (claimerUid: string) => {
        if (!isReporter) return;
        setIsConfirming(claimerUid); // Set the UID being confirmed
        try {
            await confirmClaim(item.id, claimerUid);
            toast({ title: "Claim Confirmed", description: "The item has been marked as returned." });
            onUpdate(); // Refresh list
        } catch (error: any) {
            console.error("Error confirming claim:", error);
            toast({ variant: "destructive", title: "Confirmation Failed", description: error.message });
        } finally {
            setIsConfirming(false); // Reset confirming state
        }
    };

     const handleDelete = async () => {
        if (!isReporter) return;
        setIsDeleting(true);
        try {
            await deleteFoundItem(item.id, item.imageUrl); // Pass imageUrl for deletion
            toast({ title: "Post Deleted", description: "The found item post has been removed." });
            onUpdate(); // Refresh list - item will disappear
        } catch (error: any) {
            console.error("Error deleting found item post:", error);
            toast({ variant: "destructive", title: "Delete Failed", description: error.message });
            setIsDeleting(false); // Only reset if delete failed
        }
         // Don't reset on success as component might unmount
    };


    const formattedTimestamp = item.timestamp ? formatDistanceToNow(item.timestamp.toDate(), { addSuffix: true }) : 'Date unknown';

    return (
        <Card className="flex flex-col h-full shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader>
                {item.imageUrl && (
                    <div className="relative w-full h-40 mb-2 rounded-md overflow-hidden border">
                        <Image
                            src={item.imageUrl}
                            alt={item.title}
                            layout="fill"
                            objectFit="cover"
                            loading="lazy"
                         />
                    </div>
                )}
                <CardTitle className="text-lg font-semibold">{item.title}</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                    Found {formattedTimestamp}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-2 text-sm">
                 {item.description && (
                     <div className="flex items-start gap-2">
                        <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <p>{item.description}</p>
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <p>Found near: {item.location}</p>
                </div>
                 <div className="flex items-center gap-2">
                    <UserIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <p>Reported by: {item.reporterName} ({item.reporterScholarNumber})</p>
                </div>
            </CardContent>
            <CardFooter className="border-t pt-4 flex flex-col items-stretch gap-3">
                {isReporter && (
                    <>
                        {loadingClaimers ? (
                             <div className="text-center text-sm text-muted-foreground"><LoadingSpinner /> Loading claimers...</div>
                        ) : claimerDetails.length > 0 ? (
                             <div className="space-y-2">
                                 <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3"/> Claimed By:</h4>
                                 <ul className="max-h-24 overflow-y-auto space-y-1.5 pr-2">
                                     {claimerDetails.map(claimer => (
                                         <li key={claimer.uid} className="flex justify-between items-center text-xs bg-secondary p-1.5 rounded">
                                             <span>{claimer.name} ({claimer.scholarNumber})</span>
                                             <Button
                                                 size="sm" // Changed from "xs" to "sm"
                                                 variant="outline"
                                                 className="h-6 px-2" // Custom styling kept
                                                 onClick={() => handleConfirmClaim(claimer.uid)}
                                                 disabled={!!isConfirming} // Disable all confirm buttons while one is processing
                                             >
                                                {isConfirming === claimer.uid ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                                                 {isConfirming === claimer.uid ? 'Confirming...' : 'Confirm'}
                                             </Button>
                                         </li>
                                     ))}
                                 </ul>
                             </div>
                         ) : (
                             <p className="text-xs text-muted-foreground italic text-center">No claims yet.</p>
                         )}

                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm" className="w-full mt-2" disabled={isDeleting}>
                                     {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4" />}
                                     Delete Post
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Delete Found Item Post?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete this "found item" post. Make sure you have returned the item or no longer need the post.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                                     {isDeleting ? "Deleting..." : "Yes, Delete Post"}
                                </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>

                    </>
                )}

                {!isReporter && currentUser && (
                    hasClaimed ? (
                        <Button size="sm" variant="outline" className="w-full" onClick={handleUnclaim} disabled={isClaiming}>
                            {isClaiming ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <XCircle className="mr-2 h-4 w-4" />}
                            Unclaim Item
                        </Button>
                    ) : (
                        <Button size="sm" className="w-full" onClick={handleClaim} disabled={isClaiming}>
                             {isClaiming ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4" />}
                             Claim Item
                        </Button>
                    )
                )}
                 {!currentUser && (
                     <p className="text-xs text-muted-foreground italic text-center w-full">Login to claim this item.</p>
                 )}
            </CardFooter>
        </Card>
    );
};
