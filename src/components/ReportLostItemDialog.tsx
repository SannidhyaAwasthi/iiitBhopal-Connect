import type { FC } from 'react';
import { useState } from 'react';
import type { User } from 'firebase/auth';
import type { StudentProfile } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { addLostItem } from '@/lib/lostAndFoundActions';
import { Loader2 } from 'lucide-react';
import { Timestamp } from 'firebase/firestore'; // Import Timestamp

interface ReportLostItemDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    user: User | null;
    studentData: StudentProfile | null;
    onSuccess: () => void; // Callback on successful report
}

export const ReportLostItemDialog: FC<ReportLostItemDialogProps> = ({ isOpen, onOpenChange, user, studentData, onSuccess }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [location, setLocation] = useState('');
    const [lostDate, setLostDate] = useState<Date | undefined>(new Date()); // Use Date object for picker
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.value) {
            setLostDate(new Date(e.target.value));
        } else {
            setLostDate(undefined);
        }
    };

     // Format date for input type="datetime-local"
     const formatDateForInput = (date: Date | undefined): string => {
        if (!date) return '';
        // Format: YYYY-MM-DDTHH:mm
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };


    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError(null);

        if (!user || !studentData) {
            setError('You must be logged in and profile loaded to report an item.');
            toast({ variant: "destructive", title: "Error", description: "User not logged in or profile missing." });
            return;
        }
        if (!title || !location || !lostDate) {
            setError('Title, location, and date/time lost are required.');
            toast({ variant: "destructive", title: "Missing Fields", description: "Please fill in all required fields." });
            return;
        }

        setIsLoading(true);

        try {
            await addLostItem({
                type: 'lost',
                title,
                description: description || undefined, // Store as undefined if empty
                timestamp: Timestamp.fromDate(lostDate), // Convert Date to Firestore Timestamp
                location,
                reporterId: user.uid,
                reporterName: studentData.name,
                reporterScholarNumber: studentData.scholarNumber,
                status: 'active', // Lost items are initially active
            });

            toast({ title: "Lost Item Reported", description: "Your report has been submitted." });
            setTitle('');
            setDescription('');
            setLocation('');
            setLostDate(new Date());
            onSuccess(); // Trigger refresh and close dialog via parent

        } catch (err: any) {
            console.error("Error reporting lost item:", err);
            setError(err.message || 'Failed to report lost item.');
            toast({ variant: "destructive", title: "Report Failed", description: err.message || 'An unexpected error occurred.' });
        } finally {
            setIsLoading(false);
        }
    };

    // Reset form state when dialog closes
    const handleClose = (open: boolean) => {
        if (!open) {
            setTitle('');
            setDescription('');
            setLocation('');
            setLostDate(new Date());
            setError(null);
            setIsLoading(false);
        }
        onOpenChange(open);
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Report Lost Item</DialogTitle>
                    <DialogDescription>
                        Fill in the details about the item you lost.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    {error && (
                        <p className="text-sm text-red-500">{error}</p>
                    )}
                    <div className="space-y-1">
                        <Label htmlFor="lost-title">Item Title <span className="text-red-500">*</span></Label>
                        <Input
                            id="lost-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g., Black Wallet, Blue Water Bottle"
                            required
                            disabled={isLoading}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="lost-description">Description (Optional)</Label>
                        <Textarea
                            id="lost-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Any specific details? (e.g., brand, scratches, contents)"
                            rows={3}
                            disabled={isLoading}
                        />
                    </div>
                     <div className="space-y-1">
                        <Label htmlFor="lost-location">Location Lost <span className="text-red-500">*</span></Label>
                        <Input
                            id="lost-location"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="e.g., Library 2nd Floor, Canteen, AB1 Room 101"
                            required
                            disabled={isLoading}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="lost-datetime">Date & Time Lost <span className="text-red-500">*</span></Label>
                        <Input
                            id="lost-datetime"
                            type="datetime-local"
                            value={formatDateForInput(lostDate)}
                            onChange={handleDateChange}
                            required
                            disabled={isLoading}
                        />
                    </div>

                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline" disabled={isLoading}>Cancel</Button>
                        </DialogClose>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {isLoading ? 'Submitting...' : 'Report Lost Item'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
