import React from 'react';
import type { Opportunity, StudentProfile } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from "@/components/ui/badge";
import { ExternalLink, CalendarDays, Users, Edit, Trash2, Loader2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { deleteOpportunity } from '@/lib/opportunityActions'; // Action for deleting
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

interface OpportunityCardProps {
    opportunity: Opportunity;
    currentUser: User | null;
    currentStudentProfile: StudentProfile | null;
    onUpdate: () => void; // Callback to refresh list after deletion
    onEdit: (opportunity: Opportunity) => void; // Callback to trigger editing
}

export const OpportunityCard: React.FC<OpportunityCardProps> = ({ opportunity, currentUser, currentStudentProfile, onUpdate, onEdit }) => {
    const [isDeleting, setIsDeleting] = React.useState(false);
    const { toast } = useToast();

    const deadlineFormatted = format(opportunity.deadline.toDate(), 'PPpp'); // e.g., Aug 15, 2024, 11:59 PM
    const postedAtFormatted = formatDistanceToNow(opportunity.createdAt.toDate(), { addSuffix: true });

    const isOwner = currentUser?.uid === opportunity.postedBy;

    const handleDelete = async () => {
        if (!isOwner) return;
        setIsDeleting(true);
        try {
            await deleteOpportunity(opportunity.id);
            toast({ title: "Opportunity Deleted", description: "The opportunity has been removed." });
            onUpdate(); // Refresh the list
        } catch (error: any) {
            console.error("Error deleting opportunity:", error);
            toast({ variant: "destructive", title: "Delete Failed", description: error.message });
            setIsDeleting(false); // Only reset on failure
        }
        // Don't reset on success as component might unmount
    };

    const handleEditClick = () => {
        if (isOwner) {
            onEdit(opportunity);
        }
    };

    const renderEligibility = () => {
        const { branches = [], yearsOfPassing = [], genders = [] } = opportunity.eligibility;
        const hasRestrictions = branches.length > 0 || yearsOfPassing.length > 0 || genders.length > 0;

        if (!hasRestrictions) {
            return <p className="text-xs text-muted-foreground">Open to all eligible students.</p>;
        }

        return (
            <div className="text-xs text-muted-foreground space-y-1">
                {branches.length > 0 && <div><strong>Branches:</strong> {branches.join(', ')}</div>}
                {yearsOfPassing.length > 0 && <div><strong>Passing Year:</strong> {yearsOfPassing.join(', ')}</div>}
                {genders.length > 0 && <div><strong>Genders:</strong> {genders.join(', ')}</div>}
            </div>
        );
    };


    return (
        <Card className="flex flex-col h-full shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader>
                <div className="flex justify-between items-start gap-2">
                     <div>
                        <CardTitle className="text-lg font-semibold mb-1">{opportunity.title}</CardTitle>
                        <CardDescription className="text-xs text-muted-foreground">
                            Posted {postedAtFormatted} by {opportunity.postedByName} ({opportunity.postedByScholarNumber})
                        </CardDescription>
                     </div>
                     <div className="flex gap-1 shrink-0">
                         <Badge variant="secondary" className="capitalize">{opportunity.locationType}</Badge>
                         <Badge variant="outline" className="capitalize">{opportunity.opportunityType}</Badge>
                     </div>
                </div>
            </CardHeader>
            <CardContent className="flex-grow space-y-3 text-sm">
                 {opportunity.description && (
                    <p className="whitespace-pre-wrap line-clamp-4">{opportunity.description}</p>
                 )}
                 <div className="flex items-center gap-2">
                     <CalendarDays className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                     <p>Deadline: <span className="font-medium">{deadlineFormatted}</span></p>
                 </div>
                 <div className="flex items-start gap-2">
                     <Users className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                     <div>
                         <p className="font-medium text-xs mb-1">Eligibility:</p>
                         {renderEligibility()}
                     </div>
                 </div>
            </CardContent>
            <CardFooter className="border-t pt-4 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2">
                 <Button asChild variant="default" size="sm" className="w-full sm:w-auto">
                     <a href={opportunity.applyLink} target="_blank" rel="noopener noreferrer">
                         Apply Now <ExternalLink className="ml-2 h-4 w-4" />
                     </a>
                 </Button>
                 {isOwner && (
                    <div className="flex gap-2 justify-end mt-2 sm:mt-0 w-full sm:w-auto">
                        {/* Edit Button */}
                        <Button variant="outline" size="sm" onClick={handleEditClick} disabled={isDeleting} title="Edit Opportunity">
                             <Edit className="h-4 w-4 mr-1 sm:mr-0 md:mr-1" />
                             <span className="hidden md:inline">Edit</span>
                        </Button>
                        {/* Delete Button */}
                        <AlertDialog>
                             <AlertDialogTrigger asChild>
                                 <Button variant="destructive" size="sm" disabled={isDeleting} title="Delete Opportunity">
                                     {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-1 sm:mr-0 md:mr-1" /> : <Trash2 className="h-4 w-4 mr-1 sm:mr-0 md:mr-1" />}
                                     <span className="hidden md:inline">Delete</span>
                                 </Button>
                             </AlertDialogTrigger>
                             <AlertDialogContent>
                                 <AlertDialogHeader>
                                     <AlertDialogTitle>Delete Opportunity?</AlertDialogTitle>
                                     <AlertDialogDescription>
                                         This action cannot be undone. This will permanently delete this opportunity post.
                                     </AlertDialogDescription>
                                 </AlertDialogHeader>
                                 <AlertDialogFooter>
                                     <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                                     <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                                         {isDeleting ? "Deleting..." : "Yes, Delete"}
                                     </AlertDialogAction>
                                 </AlertDialogFooter>
                             </AlertDialogContent>
                         </AlertDialog>
                     </div>
                 )}
            </CardFooter>
        </Card>
    );
};
