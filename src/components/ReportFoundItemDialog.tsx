import type { FC } from 'react';
import { useState, useRef } from 'react';
import type { User } from 'firebase/auth';
import type { StudentProfile } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { addFoundItem } from '@/lib/lostAndFoundActions';
import { Loader2, Upload } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import Image from 'next/image'; // Import next/image

interface ReportFoundItemDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    user: User | null;
    studentData: StudentProfile | null;
    onSuccess: () => void; // Callback on successful report
}

export const ReportFoundItemDialog: FC<ReportFoundItemDialogProps> = ({ isOpen, onOpenChange, user, studentData, onSuccess }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [location, setLocation] = useState('');
    const [foundDate, setFoundDate] = useState<Date | undefined>(new Date());
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null); // For previewing selected image
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null); // Ref for file input
    const { toast } = useToast();

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.value) {
            setFoundDate(new Date(e.target.value));
        } else {
            setFoundDate(undefined);
        }
    };

    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
             // Basic validation (optional: size, type)
             if (file.size > 5 * 1024 * 1024) { // 5MB limit
                 toast({ variant: "destructive", title: "Image Too Large", description: "Please select an image smaller than 5MB." });
                 return;
             }
            setImageFile(file);
            // Create a preview URL
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        } else {
            setImageFile(null);
            setImagePreview(null);
        }
    };

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setLocation('');
        setFoundDate(new Date());
        setImageFile(null);
        setImagePreview(null);
        setError(null);
        setIsLoading(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = ''; // Clear the file input
        }
    };

     // Format date for input type="datetime-local"
     const formatDateForInput = (date: Date | undefined): string => {
        if (!date) return '';
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
        if (!title || !location || !foundDate) {
            setError('Title, location, and date/time found are required.');
            toast({ variant: "destructive", title: "Missing Fields", description: "Please fill in all required fields." });
            return;
        }
         // Image is now optional, no need for check here

        setIsLoading(true);

        try {
            await addFoundItem({
                type: 'found',
                title,
                description: description || undefined,
                timestamp: Timestamp.fromDate(foundDate),
                location,
                reporterId: user.uid,
                reporterName: studentData.name,
                reporterScholarNumber: studentData.scholarNumber,
                status: 'active', // Found items start as active
                claimers: [], // Initialize empty claimers array
            }, imageFile); // Pass image file (which can be null)

            toast({ title: "Found Item Reported", description: "Thank you for reporting the item." });
            resetForm();
            onSuccess(); // Trigger refresh and close dialog

        } catch (err: any) {
            console.error("Error reporting found item:", err);
            setError(err.message || 'Failed to report found item.');
            toast({ variant: "destructive", title: "Report Failed", description: err.message || 'An unexpected error occurred.' });
            setIsLoading(false); // Keep loading false on error
        }
    };

    const handleClose = (open: boolean) => {
        if (!open) {
            resetForm(); // Reset form when dialog closes
        }
        onOpenChange(open);
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                    <DialogTitle>Report Found Item</DialogTitle>
                    <DialogDescription>
                        Provide details about the item you found. Uploading a picture helps!
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    {error && (
                        <p className="text-sm text-red-500">{error}</p>
                    )}
                    <div className="space-y-1">
                        <Label htmlFor="found-title">Item Title <span className="text-red-500">*</span></Label>
                        <Input
                            id="found-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g., iPhone 13, Silver Keyring, ID Card"
                            required
                            disabled={isLoading}
                        />
                    </div>
                     <div className="space-y-1">
                        <Label htmlFor="found-image">Image (Optional)</Label>
                        <Input
                            id="found-image"
                            type="file"
                            ref={fileInputRef}
                            accept="image/*"
                            onChange={handleImageChange}
                            className="mt-1 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-input file:bg-secondary file:text-secondary-foreground hover:file:bg-secondary/80 file:text-sm file:font-medium cursor-pointer"
                            disabled={isLoading}
                        />
                        {imagePreview && (
                            <div className="mt-2 border rounded-md p-2 flex justify-center">
                                <Image
                                    src={imagePreview}
                                    alt="Selected image preview"
                                    width={150}
                                    height={150}
                                    className="object-contain rounded-md"
                                />
                            </div>
                        )}
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="found-description">Description (Optional)</Label>
                        <Textarea
                            id="found-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Any identifying details? (e.g., color, condition, where exactly you found it)"
                            rows={3}
                            disabled={isLoading}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="found-location">Location Found <span className="text-red-500">*</span></Label>
                        <Input
                            id="found-location"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="e.g., Near Audi steps, BH1 Ground Floor, Sports Complex Gate"
                            required
                            disabled={isLoading}
                        />
                    </div>
                     <div className="space-y-1">
                        <Label htmlFor="found-datetime">Date & Time Found <span className="text-red-500">*</span></Label>
                        <Input
                            id="found-datetime"
                            type="datetime-local"
                            value={formatDateForInput(foundDate)}
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
                            {isLoading ? 'Submitting...' : 'Report Found Item'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
