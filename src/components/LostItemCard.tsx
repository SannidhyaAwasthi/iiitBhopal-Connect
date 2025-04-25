import type { FC } from 'react';
import { useState } from 'react';
import type { LostAndFoundItem, StudentProfile } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, MapPin, User as UserIcon, Info } from 'lucide-react';
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
import LoadingSpinner from './loading-spinner'; // Import LoadingSpinner

interface LostItemCardProps {
    item: LostAndFoundItem;
    currentUser: User | null; // Needed to check if user can report as found
    currentStudentProfile: StudentProfile | null; // Needed for reporting
    onItemFoundReported: () => void; // Callback after reporting
}

export const LostItemCard: FC<LostItemCardProps> = ({ item, currentUser, currentStudentProfile, onItemFoundReported }) => {
    const [isReportingFound, setIsReportingFound] = useState(false);
    const { toast } = useToast();

    const handleReportFound = async () => {
        if (!currentUser || !currentStudentProfile) {
            toast({ variant: "destructive", title: "Action Failed", description: "You must be logged in to report an item as found." });
            return;
        }
        if (currentUser.uid === item.reporterId) {
            toast({ variant: "destructive", title: "Action Failed", description: "You cannot report your own lost item as found." });
            return;
        }


        setIsReportingFound(true);
        try {
            await reportItemAsFound(item, currentStudentProfile);
            toast({ title: "Item Reported as Found", description: "A new 'found' post has been created." });
            onItemFoundReported(); // Trigger refresh in the parent component
        } catch (error: any) {
            console.error("Error reporting item as found:", error);
            toast({
                variant: "destructive",
                title: "Report Failed",
                description: error.message || "Could not report the item as found.",
            });
        } finally {
            setIsReportingFound(false);
        }
    };

    const formattedTimestamp = item.timestamp ? formatDistanceToNow(item.timestamp.toDate(), { addSuffix: true }) : 'Date unknown';

    return (
        <Card className="flex flex-col h-full shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader>
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
                    <p>Lost near: {item.location}</p>
                </div>
                <div className="flex items-center gap-2">
                    <UserIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <p>Reported by: {item.reporterName} ({item.reporterScholarNumber})</p>
                </div>
            </CardContent>
            <CardFooter className="border-t pt-4">
                 {currentUser && currentUser.uid !== item.reporterId && ( // Only show button if not the reporter
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button size="sm" className="w-full" disabled={isReportingFound}>
                                {isReportingFound ? <LoadingSpinner /> : "I Found This Item"}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Report as Found?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will create a new "Found Item" post based on this lost item report.
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
                 {currentUser && currentUser.uid === item.reporterId && (
                     <p className="text-xs text-muted-foreground italic text-center w-full">You reported this item.</p>
                 )}
                  {!currentUser && (
                     <p className="text-xs text-muted-foreground italic text-center w-full">Login to report if found.</p>
                 )}
            </CardFooter>
        </Card>
    );
};
