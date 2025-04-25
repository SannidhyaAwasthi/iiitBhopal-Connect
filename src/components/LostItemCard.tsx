import type { FC } from 'react';
import { useState } from 'react';
import type { LostAndFoundItem, StudentProfile } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, MapPin, User as UserIcon, Info, CheckSquare, Loader2, Image as ImageIcon } from 'lucide-react'; // Added ImageIcon
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { reportItemAsFound } from '@/lib/lostAndFoundActions';
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
import type { User } from 'firebase/auth';
import Image from 'next/image'; // Import next/image for displaying image

interface LostItemCardProps {
    item: LostAndFoundItem;
    currentUser: User | null;
    currentStudentProfile: StudentProfile | null;
    onItemFoundReported: () => void;
}

export const LostItemCard: FC<LostItemCardProps> = ({ item, currentUser, currentStudentProfile, onItemFoundReported }) => {
    const [isReportingFound, setIsReportingFound] = useState(false);
    const { toast } = useToast();

    const handleReportFound = async () => {
         console.log("[LostItemCard] handleReportFound triggered for item:", item.id);
        if (!currentUser || !currentStudentProfile) {
            console.error("[LostItemCard] Cannot report found: User or profile missing.");
            toast({ variant: "destructive", title: "Action Failed", description: "You must be logged in with a loaded profile to report an item as found." });
            setIsReportingFound(false); // Reset loading state
            return;
        }
        if (currentUser.uid === item.reporterId) {
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
            onItemFoundReported(); // Trigger refresh - this might close the dialog automatically
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
        // Do not set isLoading false here on success, let the dialog handle it or the component unmount.
    };

    const formattedTimestamp = item.timestamp ? formatDistanceToNow(item.timestamp.toDate(), { addSuffix: true }) : 'Date unknown';

    return (
        <Card className="flex flex-col h-full shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader>
                 {/* Display Image if available */}
                 {item.imageUrl && (
                    <div className="relative w-full h-40 mb-2 rounded-md overflow-hidden border">
                        <Image
                            src={item.imageUrl}
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
            <CardFooter className="border-t pt-4">
                 {currentUser && currentStudentProfile && currentUser.uid !== item.reporterId && (
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
                 {currentUser && currentStudentProfile && currentUser.uid === item.reporterId && (
                     <p className="text-xs text-muted-foreground italic text-center w-full">You reported this item lost.</p>
                 )}
                 {!currentUser && (
                     <p className="text-xs text-muted-foreground italic text-center w-full">Login to report if found.</p>
                 )}
                 {currentUser && !currentStudentProfile && (
                      <p className="text-xs text-muted-foreground italic text-center w-full">Loading profile...</p>
                 )}
            </CardFooter>
        </Card>
    );
};
