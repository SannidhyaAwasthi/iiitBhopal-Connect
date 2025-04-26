import React, { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import type { Event } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth'; // Import useAuth to get user UID
import { updateEvent } from '@/lib/eventActions';
import { Loader2, X, Image as ImageIconPlaceholder } from 'lucide-react'; // Added ImageIconPlaceholder
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose, // Import DialogClose
} from '@/components/ui/dialog';
import { Timestamp, GeoPoint } from 'firebase/firestore';
import Image from 'next/image';

interface EditEventFormProps {
  event: Event; // The event object being edited
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSuccess: () => void; // Callback on successful update
}

// Helper to convert Firestore Timestamp to yyyy-MM-ddTHH:mm string for input
const formatTimestampForInput = (timestamp: Timestamp | null | undefined): string => {
  if (!timestamp) return '';
  try {
    const date = timestamp.toDate();
    // Adjust for local timezone offset before formatting
    const tzOffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
    const localDate = new Date(date.getTime() - tzOffset);
    return localDate.toISOString().slice(0, 16);
  } catch (e) {
    console.error("Error formatting timestamp:", e);
    return '';
  }
};

export const EditEventForm: React.FC<EditEventFormProps> = ({
  event,
  isOpen,
  onOpenChange,
  onSuccess,
}) => {
  const { user } = useAuth(); // Get current user from auth context
  const { toast } = useToast();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [venue, setVenue] = useState('');
  const [startTime, setStartTime] = useState(''); // yyyy-MM-ddTHH:mm format
  const [endTime, setEndTime] = useState(''); // yyyy-MM-ddTHH:mm format
  // Location state would go here if implementing map input
  // const [location, setLocation] = useState<GeoPoint | null>(null);

  // Poster state
  const [currentPosterUrl, setCurrentPosterUrl] = useState<string | null | undefined>(undefined); // URL for preview
  const [newPosterFile, setNewPosterFile] = useState<File | null>(null); // The actual new file selected
  const [removePoster, setRemovePoster] = useState(false); // Flag to explicitly remove

  // Control state
  const [isLoading, setIsLoading] = useState(false);

  // Effect to initialize form when dialog opens or event changes
  useEffect(() => {
    if (isOpen && event) {
      setTitle(event.title);
      setDescription(event.description);
      setVenue(event.venue);
      setStartTime(formatTimestampForInput(event.startTime));
      setEndTime(formatTimestampForInput(event.endTime));
      setCurrentPosterUrl(event.poster); // Set initial preview URL
      // Reset poster actions
      setNewPosterFile(null);
      setRemovePoster(false);
      setIsLoading(false); // Reset loading state
      // setLocation(event.location); // Initialize location if implemented
    }
  }, [event, isOpen]); // Rerun when dialog opens or the specific event prop changes

  // Handle poster file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewPosterFile(file); // Store the file object
      setRemovePoster(false); // Selecting a new file cancels removal intent
      // Generate and set preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setCurrentPosterUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
        // If selection was cancelled, revert state
        setNewPosterFile(null);
        setCurrentPosterUrl(event.poster); // Revert preview to original
    }
  };

  // Handle explicit poster removal
  const handleRemovePosterClick = () => {
    setRemovePoster(true);
    setNewPosterFile(null); // Clear any selected new file
    setCurrentPosterUrl(null); // Clear the preview
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ variant: 'destructive', title: 'Error', description: 'Authentication error.' });
      return;
    }
    if (!title || !description || !venue) {
      toast({ variant: 'destructive', title: 'Error', description: 'Title, Description, and Venue are required.' });
      return;
    }

    setIsLoading(true);

    try {
      // 1. Determine changed fields for Firestore update
      const eventDataToUpdate: { [key: string]: any } = {}; // Use simple object for flexibility

      if (title !== event.title) eventDataToUpdate.title = title;
      if (description !== event.description) eventDataToUpdate.description = description;
      if (venue !== event.venue) eventDataToUpdate.venue = venue;

      const originalStartTimeStr = formatTimestampForInput(event.startTime);
      if (startTime !== originalStartTimeStr) {
        eventDataToUpdate.startTime = startTime ? Timestamp.fromDate(new Date(startTime)) : null;
      }
      const originalEndTimeStr = formatTimestampForInput(event.endTime);
      if (endTime !== originalEndTimeStr) {
        eventDataToUpdate.endTime = endTime ? Timestamp.fromDate(new Date(endTime)) : null;
      }

      // Add location update logic here if implemented
      // if (location !== event.location) eventDataToUpdate.location = location;


      // 2. Determine poster action for the updateEvent function
      //    - `undefined`: No change requested for the poster field.
      //    - `null`: Explicitly remove the poster (set field to null in Firestore).
      //    - `File object`: Replace the existing poster with this new file.
      let posterAction: File | null | undefined = undefined; // Default to no change
      if (removePoster) {
        posterAction = null; // Remove it
      } else if (newPosterFile) {
        posterAction = newPosterFile; // Replace it
      }


      // 3. Call the update action
      await updateEvent(
        event.id,
        user.uid, // Pass the current user's UID
        eventDataToUpdate,
        posterAction,
        event.poster // Pass the original poster URL for comparison/deletion
      );

      toast({ title: 'Event Updated Successfully!' });
      onSuccess(); // Trigger refresh in parent
      onOpenChange(false); // Close dialog

    } catch (error: any) {
      console.error('Error updating event:', error);
      toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {/* Trigger is handled by the parent component */}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Event: {event?.title || 'Loading...'}</DialogTitle>
          <DialogDescription>
            Modify the details for your event. Changes will be saved upon submission.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-3"> {/* Added scroll & padding */}

          {/* --- Poster Section --- */}
          <div className="space-y-2">
            <Label>Poster Image</Label>
            <div className="relative aspect-video w-full border rounded bg-muted flex items-center justify-center overflow-hidden"> {/* Changed aspect ratio */}
              {currentPosterUrl ? (
                <Image src={currentPosterUrl} alt="Poster preview" layout="fill" objectFit="contain" />
              ) : (
                <div className="text-center text-muted-foreground p-4">
                    <ImageIconPlaceholder className="mx-auto h-12 w-12 opacity-50" />
                    <p className="mt-2 text-xs">No Poster</p>
                 </div>
              )}
              {/* Remove Button overlay */}
              {currentPosterUrl && !removePoster && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-1.5 right-1.5 h-7 w-7 z-10 rounded-full" // Adjusted style
                  onClick={handleRemovePosterClick}
                  title="Remove poster image"
                  disabled={isLoading}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Input
              id="poster-edit"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="text-xs" // Smaller text for file input
              disabled={isLoading}
            />
            {removePoster && <p className="text-xs text-destructive font-medium">Poster will be removed upon saving.</p>}
            {newPosterFile && !removePoster && <p className="text-xs text-green-600 font-medium">New poster selected. Old one will be replaced.</p>}
          </div>

          {/* --- Text Fields --- */}
          <div className="grid gap-1.5"> {/* Reduced gap */}
            <Label htmlFor="title-edit">Title</Label>
            <Input id="title-edit" value={title} onChange={(e) => setTitle(e.target.value)} required disabled={isLoading} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="description-edit">Description</Label>
            <Textarea id="description-edit" value={description} onChange={(e) => setDescription(e.target.value)} required disabled={isLoading} rows={4} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="venue-edit">Venue</Label>
            <Input id="venue-edit" value={venue} onChange={(e) => setVenue(e.target.value)} required disabled={isLoading} />
          </div>

          {/* --- Date/Time Fields --- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="startTime-edit">Start Time (Optional)</Label>
              <Input id="startTime-edit" type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} disabled={isLoading} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="endTime-edit">End Time (Optional)</Label>
              <Input id="endTime-edit" type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={isLoading} />
            </div>
          </div>

          {/* --- Location Field Placeholder --- */}
          {/*
          <div className="grid gap-1.5">
            <Label htmlFor="location-edit">Location (Optional)</Label>
            // Add Map Input Component Here
            <p className='text-xs text-muted-foreground'>Map input not implemented yet.</p>
          </div>
          */}

          {/* --- Footer --- */}
          <DialogFooter className="mt-4 pt-4 border-t"> {/* Added border */}
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isLoading}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isLoading ? 'Saving Changes...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
