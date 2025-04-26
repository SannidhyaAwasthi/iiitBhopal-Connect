import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import type { StudentProfile, VisibilitySettings, Gender } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox'; // Import Checkbox
import { useToast } from '@/hooks/use-toast';
import { createEvent } from '@/lib/eventActions';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Timestamp } from 'firebase/firestore';

// Define available options (reuse or centralize)
const AVAILABLE_BRANCHES = ['CSE', 'IT', 'ECE'];
const CURRENT_YEAR = new Date().getFullYear();
const AVAILABLE_YEARS = Array.from({ length: 8 }, (_, i) => CURRENT_YEAR + i - 1);
const AVAILABLE_GENDERS: Gender[] = ['Male', 'Female', 'Other', 'Prefer not to say'];

interface CreateEventFormProps {
    user: User | null;
    studentData: StudentProfile | null;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onSuccess: (eventLink: string) => void; // Callback on successful creation
}

export const CreateEventForm: React.FC<CreateEventFormProps> = ({ user, studentData, isOpen, onOpenChange, onSuccess }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [venue, setVenue] = useState('');
    const [posterFile, setPosterFile] = useState<File | null>(null);
    const [startTime, setStartTime] = useState<string>(''); // Store as string for input type datetime-local
    const [endTime, setEndTime] = useState<string>('');
    const [visibility, setVisibility] = useState<VisibilitySettings>({ // State for visibility
        branches: [],
        yearsOfPassing: [],
        genders: [],
    });
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            setPosterFile(event.target.files[0]);
        }
    };

    // --- Visibility Handlers ---
    const handleVisibilityChange = (
        type: keyof VisibilitySettings,
        value: string | number,
        isChecked: boolean
    ) => {
        setVisibility(prev => {
            const currentValues = prev[type] as (string | number)[]; // Type assertion
            let newValues: (string | number)[];

             if (isChecked) {
                 newValues = [...currentValues, value];
             } else {
                 newValues = currentValues.filter(v => v !== value);
             }

             // Ensure correct type for numeric arrays (yearsOfPassing)
             if (type === 'yearsOfPassing') {
                 newValues = newValues.map(Number);
             }

            return { ...prev, [type]: newValues };
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !studentData) {
            toast({ variant: "destructive", title: "Error", description: "You must be logged in to create an event." });
            return;
        }
        if (!title || !description || !venue) {
            toast({ variant: "destructive", title: "Error", description: "Title, Description, and Venue are required." });
            return;
        }

        setIsLoading(true);

        try {
            // Prepare event data including visibility
            const eventData = {
                title,
                description,
                venue,
                location: null, // Placeholder
                startTime: startTime ? Timestamp.fromDate(new Date(startTime)) : null,
                endTime: endTime ? Timestamp.fromDate(new Date(endTime)) : null,
                visibility: visibility, // Include visibility settings
            };

            const { eventId, eventLink } = await createEvent(eventData, posterFile, studentData);

            toast({ title: "Event Created!", description: `Link: ${eventLink}` });
            onSuccess(eventLink);
            // Reset form fields including visibility
            setTitle('');
            setDescription('');
            setVenue('');
            setPosterFile(null);
            setStartTime('');
            setEndTime('');
            setVisibility({ branches: [], yearsOfPassing: [], genders: [] });
            onOpenChange(false); // Close dialog on success

        } catch (error: any) {
            console.error("Error creating event:", error);
            toast({ variant: "destructive", title: "Creation Failed", description: error.message });
        } finally {
            setIsLoading(false);
        }
    };

     const resetForm = () => {
        setTitle('');
        setDescription('');
        setVenue('');
        setPosterFile(null);
        setStartTime('');
        setEndTime('');
        setVisibility({ branches: [], yearsOfPassing: [], genders: [] });
        setIsLoading(false);
    };

     const handleClose = (open: boolean) => {
         if (!open) {
             resetForm(); // Reset form when dialog closes
         }
         onOpenChange(open);
     };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto"> {/* Increased width and added scroll */}
                <DialogHeader>
                    <DialogTitle>Create New Event</DialogTitle>
                    <DialogDescription>
                        Fill in the details for your new event. Specify visibility if needed.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4 pr-2"> {/* Added pr-2 for scrollbar space */}
                    {/* Event Details */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="title" className="text-right">Title <span className="text-red-500">*</span></Label>
                        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="col-span-3" required disabled={isLoading} />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="description" className="text-right">Description <span className="text-red-500">*</span></Label>
                        <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="col-span-3" required disabled={isLoading} rows={3}/>
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="venue" className="text-right">Venue <span className="text-red-500">*</span></Label>
                        <Input id="venue" value={venue} onChange={(e) => setVenue(e.target.value)} className="col-span-3" required disabled={isLoading}/>
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="startTime" className="text-right">Start Time</Label>
                        <Input id="startTime" type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="col-span-3" disabled={isLoading}/>
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="endTime" className="text-right">End Time</Label>
                        <Input id="endTime" type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="col-span-3" disabled={isLoading}/>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="poster" className="text-right">Poster</Label>
                        <Input id="poster" type="file" accept="image/*" onChange={handleFileChange} className="col-span-3 text-sm" disabled={isLoading}/>
                    </div>
                     {/* TODO: Add Location Input (Map) */}

                    {/* --- Visibility Settings --- */}
                    <div className="space-y-4 border-t pt-4 mt-4">
                        <Label className="block text-sm font-medium mb-2">Event Visibility (Leave unchecked for All)</Label>

                         {/* Branches */}
                        <div className="space-y-1">
                            <Label className="text-xs font-medium text-muted-foreground">Branches:</Label>
                             <div className="flex flex-wrap gap-x-4 gap-y-2">
                                {AVAILABLE_BRANCHES.map(branch => (
                                    <div key={`vis-branch-${branch}`} className="flex items-center space-x-2">
                                         <Checkbox
                                            id={`vis-branch-${branch}`}
                                            checked={visibility.branches.includes(branch)}
                                            onCheckedChange={(checked) => handleVisibilityChange('branches', branch, !!checked)}
                                            disabled={isLoading}
                                         />
                                         <Label htmlFor={`vis-branch-${branch}`} className="text-sm font-normal cursor-pointer">{branch}</Label>
                                     </div>
                                ))}
                            </div>
                        </div>

                         {/* Years of Passing */}
                         <div className="space-y-1">
                             <Label className="text-xs font-medium text-muted-foreground">Years of Passing:</Label>
                             <div className="flex flex-wrap gap-x-4 gap-y-2">
                                 {AVAILABLE_YEARS.map(year => (
                                     <div key={`vis-year-${year}`} className="flex items-center space-x-2">
                                         <Checkbox
                                             id={`vis-year-${year}`}
                                             checked={visibility.yearsOfPassing.includes(year)}
                                             onCheckedChange={(checked) => handleVisibilityChange('yearsOfPassing', year, !!checked)}
                                             disabled={isLoading}
                                         />
                                         <Label htmlFor={`vis-year-${year}`} className="text-sm font-normal cursor-pointer">{year}</Label>
                                     </div>
                                 ))}
                             </div>
                         </div>

                         {/* Genders */}
                         <div className="space-y-1">
                             <Label className="text-xs font-medium text-muted-foreground">Genders:</Label>
                             <div className="flex flex-wrap gap-x-4 gap-y-2">
                                 {AVAILABLE_GENDERS.map(gender => (
                                     <div key={`vis-gender-${gender}`} className="flex items-center space-x-2">
                                         <Checkbox
                                             id={`vis-gender-${gender.replace(/\s+/g, '-')}`}
                                             checked={visibility.genders.includes(gender)}
                                             onCheckedChange={(checked) => handleVisibilityChange('genders', gender, !!checked)}
                                             disabled={isLoading}
                                         />
                                         <Label htmlFor={`vis-gender-${gender.replace(/\s+/g, '-')}`} className="text-sm font-normal cursor-pointer">{gender}</Label>
                                     </div>
                                 ))}
                             </div>
                         </div>
                    </div>

                    <DialogFooter>
                         <DialogClose asChild>
                             <Button type="button" variant="outline" disabled={isLoading}>Cancel</Button>
                         </DialogClose>
                         <Button type="submit" disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {isLoading ? 'Creating...' : 'Create Event'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
