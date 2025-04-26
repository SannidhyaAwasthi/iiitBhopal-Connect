import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import type { StudentProfile } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { createEvent } from '@/lib/eventActions';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";

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
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            setPosterFile(event.target.files[0]);
        }
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
            // Prepare event data (excluding fields handled by createEvent)
            const eventData = {
                title,
                description,
                venue,
                // TODO: Add GeoPoint conversion if location input is added
                location: null, // Placeholder
                // Convert date strings to Timestamps or null
                startTime: startTime ? Timestamp.fromDate(new Date(startTime)) : null,
                endTime: endTime ? Timestamp.fromDate(new Date(endTime)) : null,
            };

            const { eventId, eventLink } = await createEvent(eventData, posterFile, studentData);

            toast({ title: "Event Created!", description: `Link: ${eventLink}` });
            onSuccess(eventLink);
            // Reset form fields
            setTitle('');
            setDescription('');
            setVenue('');
            setPosterFile(null);
            setStartTime('');
            setEndTime('');
            onOpenChange(false); // Close dialog on success

        } catch (error: any) {
            console.error("Error creating event:", error);
            toast({ variant: "destructive", title: "Creation Failed", description: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create New Event</DialogTitle>
                    <DialogDescription>
                        Fill in the details for your new event.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="title" className="text-right">Title</Label>
                        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="col-span-3" required />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="description" className="text-right">Description</Label>
                        <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="col-span-3" required />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="venue" className="text-right">Venue</Label>
                        <Input id="venue" value={venue} onChange={(e) => setVenue(e.target.value)} className="col-span-3" required />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="startTime" className="text-right">Start Time</Label>
                        <Input id="startTime" type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="endTime" className="text-right">End Time</Label>
                        <Input id="endTime" type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="poster" className="text-right">Poster</Label>
                        <Input id="poster" type="file" accept="image/*" onChange={handleFileChange} className="col-span-3" />
                    </div>
                    {/* TODO: Add Location Input (Map) */}
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

// Need to import Timestamp from firebase/firestore in the component using this form
// or handle the conversion within the action itself.
import { Timestamp } from 'firebase/firestore';
