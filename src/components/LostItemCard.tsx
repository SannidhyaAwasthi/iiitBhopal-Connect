
import type { FC } from 'react';
import { useState } from 'react'; // Already imported
import type { LostAndFoundItem, StudentProfile } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, MapPin, User as UserIcon, Info, CheckSquare, Loader2, Image as ImageIcon, Trash2 } from 'lucide-react'; // Added Trash2
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast'; // Already imported
import { reportItemAsFound, deleteFoundItem } from '@/lib/lostAndFoundActions'; // Added deleteFoundItem
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
} from "@/components/ui/alert-dialog"; // Already imported
import type { User } from 'firebase/auth';
import Image from 'next/image'; // Already imported

interface LostItemCardProps {
    item: LostAndFoundItem;
    currentUser: User | null;
    currentStudentProfile: StudentProfile | null;
    // Renamed prop for clarity, assuming parent component can handle this
    onUpdate: () => void; 
}

// Helper function to check if a string is a valid URL (basic check)
const isValidHttpUrl = (string: string | undefined | null): boolean => {
  if (!string) return false;
  try {
    const url = new URL(string);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_) {
    return false;
  }
}

export const LostItemCard: FC<LostItemCardProps> = ({ item, currentUser, currentStudentProfile, onUpdate }) => {
    const [isReportingFound, setIsReportingFound] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false); // <-- Added isDeleting state
    const { toast } = useToast();

    const isReporter = currentUser?.uid === item.reporterId;

    const handleReportFound = async () => {
         console.log("[LostItemCard] handleReportFound triggered for item:", item.id);
        if (!currentUser || !currentStudentProfile) {
            console.error("[LostItemCard] Cannot report found: User or profile missing.");
            toast({ variant: "destructive", title: "Action Failed", description: "You must be logged in with a loaded profile to report an item as found." });
            setIsReportingFound(false); // Reset loading state
            return;
        }
        if (isReporter) { // Simplified check
            console.warn("[LostItemCard] User attempting to report their own lost item as found:", currentUser.uid);
            toast({ variant: "destructive", title: "Action Failed", description: "You cannot report your own lost item as found." });
             setIsReportingFound(false); // Reset loading state
            return;
        }

        setIsReportingFound(true);
        try {
            console.log("[LostItemCard] Calling reportItemAsFound with item:", item, "and finder profile:", currentStudentProfile);
            // Pass the necessary parts of the lost item and the finder's profile
            await reportItemAsFound(item, currentStudentProfile);
            toast({ title: "Item Reported as Found", description: "A new 'found' post has been created. Refreshing list..." });
            onUpdate(); // Trigger refresh using the updated prop name
            // Don't reset isLoading here if dialog closes or component unmounts
        } catch (error: any) {
            console.error("[LostItemCard] Error reporting item as found:", error);
            toast({
                variant: "destructive",
                title: "Report Failed",
                description: error.message || "Could not report the item as found.",
            });
             setIsReportingFound(false); // Reset loading state ONLY on error
        }
    };

    // <-- Added handleDelete function -->
    const handleDelete = async () => {
        if (!isReporter) return;
        setIsDeleting(true);
        try {
            // Assuming deleteFoundItem can handle both types by ID
            await deleteFoundItem(item.id, item.imageUrl); 
            toast({ title: "Post Deleted", description: "The lost item post has been removed." });
            onUpdate(); // Refresh list - item will disappear
        } catch (error: any) {
            console.error("[LostItemCard] Error deleting lost item post:", error);
            toast({ variant: "destructive", title: "Delete Failed", description: error.message });
            setIsDeleting(false); // Only reset if delete failed
        }
         // Don't reset on success as component might unmount
    };

    const formattedTimestamp = item.timestamp ? formatDistanceToNow(item.timestamp.toDate(), { addSuffix: true }) : 'Date unknown';
    const hasValidImageUrl = isValidHttpUrl(item.imageUrl); // Check if imageUrl is a valid URL

    return (
        <Card className="flex flex-col h-full shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader>
                 {/* Display Image only if imageUrl is a valid URL string */}
                 {hasValidImageUrl && (
                    <div className="relative w-full h-40 mb-2 rounded-md overflow-hidden border">
                        <Image
                            src={item.imageUrl!} // Use non-null assertion because we checked with hasValidImageUrl
                            alt={`Image for ${item.title}`}
                            layout="fill"
                            objectFit="cover"
                            loading="lazy"
                         />
                    </div>
                )}
                <CardTitle className="text-lg font-semibold">{item.title}</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                    Lost {formattedTimestamp}
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
                     {/* Display location or 'Unknown' */}
                    <p>Lost near: {item.location || 'Unknown'}</p>
                </div>
                <div className="flex items-center gap-2">
                    <UserIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <p>Reported by: {item.reporterName} ({item.reporterScholarNumber})</p>
                </div>
            </CardContent>
            <CardFooter className="border-t pt-4 flex flex-col items-stretch gap-2"> {/* Added gap-2 for spacing */} 
                 {/* Option 1: User is NOT the reporter -> Show "I Found This" button */} 
                 {currentUser && currentStudentProfile && !isReporter && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button size="sm" className="w-full" disabled={isReportingFound}>
                                {isReportingFound ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckSquare className="mr-2 h-4 w-4" />}
                                {isReportingFound ? "Reporting..." : "I Found This Item"}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Report as Found?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will create a new "Found Item" post based on this lost item report.
                                    Your details will be used as the reporter for the new post.
                                    The original 'lost' post will be marked as inactive.
                                    Are you sure you found this specific item?
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={isReportingFound}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleReportFound} disabled={isReportingFound}>
                                     {isReportingFound ? "Reporting..." : "Yes, Report as Found"}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                 )}

                 {/* Option 2: User IS the reporter -> Show "Delete Post" button */} 
                 {currentUser && currentStudentProfile && isReporter && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" className="w-full" disabled={isDeleting}>
                                    {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4" />}
                                    Delete Post
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Delete Lost Item Post?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete your "lost item" post.
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
                 )}

                 {/* Option 3: User not logged in */} 
                 {!currentUser && (
                     <p className="text-xs text-muted-foreground italic text-center w-full">Login to report if found.</p>
                 )}

                 {/* Option 4: User logged in, profile loading */} 
                 {currentUser && !currentStudentProfile && (
                      <p className="text-xs text-muted-foreground italic text-center w-full">Loading profile...</p>
                 )}
            </CardFooter>
        </Card>
    );
};
