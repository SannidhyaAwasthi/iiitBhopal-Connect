import React, { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import type { Event, StudentProfile } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Clock, MapPin, User as UserIcon, Share2, ThumbsUp, ThumbsDown, CalendarPlus, CheckSquare, Info, Loader2
} from 'lucide-react';
import { format } from 'date-fns'; // For formatting dates
import { useToast } from '@/hooks/use-toast';
import { registerForEvent, likeEvent, dislikeEvent, unlikeEvent, checkRegistrationStatus } from '@/lib/eventActions';
import Image from 'next/image';

interface EventCardProps {
    event: Event;
    currentUser: User | null;
    currentStudentProfile: StudentProfile | null;
    onUpdate: () => void; // Callback to refresh list/data after action
}

export const EventCard: React.FC<EventCardProps> = ({ event, currentUser, currentStudentProfile, onUpdate }) => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [isLiking, setIsLiking] = useState(false);
    const [isRegistered, setIsRegistered] = useState(event.isRegistered ?? false);
    const [likeStatus, setLikeStatus] = useState(event.userLikeStatus ?? null);
    const [likeCount, setLikeCount] = useState(event.likes?.length ?? 0);
    const [dislikeCount, setDislikeCount] = useState(event.dislikes?.length ?? 0);
    const { toast } = useToast();

    const userId = currentUser?.uid;

    // Effect to check initial registration status if not provided
    useEffect(() => {
        if (userId && event.isRegistered === undefined) { // Only check if status is unknown
            checkRegistrationStatus(event.id, userId)
                .then(status => setIsRegistered(status))
                .catch(err => console.error("Failed to check registration status:", err));
        }
         // Sync local state if props change (e.g., parent re-fetches)
         setIsRegistered(event.isRegistered ?? false);
         setLikeStatus(event.userLikeStatus ?? null);
         setLikeCount(event.likes?.length ?? 0);
         setDislikeCount(event.dislikes?.length ?? 0);

    }, [event.id, userId, event.isRegistered, event.userLikeStatus, event.likes, event.dislikes]);

    const handleRegister = async () => {
        if (!currentUser || !currentStudentProfile) {
            toast({ variant: "destructive", title: "Login Required", description: "Please login to register." });
            return;
        }
        if (isRegistered) {
             toast({ variant: "default", title: "Already Registered", description: "You are already registered for this event." });
             return;
        }

        setIsRegistering(true);
        try {
            await registerForEvent(event.id, currentStudentProfile);
            toast({ title: "Registration Successful!" });
            setIsRegistered(true); // Update local state immediately
            onUpdate(); // Notify parent to potentially refresh counts
        } catch (error: any) {
            console.error("Error registering for event:", error);
            toast({ variant: "destructive", title: "Registration Failed", description: error.message });
        } finally {
            setIsRegistering(false);
        }
    };

    const handleLikeDislike = async (action: 'like' | 'dislike' | 'unlike') => {
        if (!currentUser) {
            toast({ variant: "destructive", title: "Login Required", description: "Please login to react." });
            return;
        }
        setIsLiking(true);
        const currentLikeStatus = likeStatus;
        const currentLikes = likeCount;
        const currentDislikes = dislikeCount;

        // Optimistic UI updates
        let newLikeStatus: 'liked' | 'disliked' | null = null;
        let newLikes = currentLikes;
        let newDislikes = currentDislikes;

        if (action === 'like') {
            newLikeStatus = 'liked';
            newLikes = currentLikeStatus === 'liked' ? currentLikes : currentLikes + 1;
            newDislikes = currentLikeStatus === 'disliked' ? currentDislikes - 1 : currentDislikes;
        } else if (action === 'dislike') {
            newLikeStatus = 'disliked';
            newLikes = currentLikeStatus === 'liked' ? currentLikes - 1 : currentLikes;
            newDislikes = currentLikeStatus === 'disliked' ? currentDislikes : currentDislikes + 1;
        } else { // unlike
             newLikes = currentLikeStatus === 'liked' ? currentLikes - 1 : currentLikes;
             newDislikes = currentLikeStatus === 'disliked' ? currentDislikes - 1 : currentDislikes;
        }

        setLikeStatus(newLikeStatus);
        setLikeCount(newLikes < 0 ? 0 : newLikes);
        setDislikeCount(newDislikes < 0 ? 0 : newDislikes);

        try {
            if (action === 'like') {
                await likeEvent(event.id, currentUser.uid);
            } else if (action === 'dislike') {
                await dislikeEvent(event.id, currentUser.uid);
            } else {
                await unlikeEvent(event.id, currentUser.uid);
            }
            // Optional: call onUpdate() if parent needs precise counts immediately,
            // but optimistic updates handle the local view.
             // onUpdate();

        } catch (error: any) {
            console.error(`Error ${action} event:`, error);
            toast({ variant: "destructive", title: "Action Failed", description: error.message });
            // Revert optimistic updates on error
            setLikeStatus(currentLikeStatus);
            setLikeCount(currentLikes);
            setDislikeCount(currentDislikes);
        } finally {
            setIsLiking(false);
        }
    };

    const handleShare = () => {
        const url = `${window.location.origin}/events/${event.eventLink}`;
        navigator.clipboard.writeText(url)
            .then(() => {
                toast({ title: "Link Copied!", description: "Event link copied to clipboard." });
            })
            .catch(err => {
                console.error("Failed to copy link:", err);
                toast({ variant: "destructive", title: "Copy Failed", description: "Could not copy link." });
            });
    };

    // Formatting Dates (provide defaults)
    const startTimeFormatted = event.startTime ? format(event.startTime.toDate(), 'Pp') : 'Date TBD';
    const endTimeFormatted = event.endTime ? format(event.endTime.toDate(), 'Pp') : null;
    const createdAtFormatted = format(event.createdAt.toDate(), 'P');

    return (
        <Card className="flex flex-col h-full shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader>
                {event.poster && (
                    <div className="relative w-full h-48 mb-3 rounded-md overflow-hidden border">
                        <Image
                            src={event.poster}
                            alt={`${event.title} Poster`}
                            layout="fill"
                            objectFit="cover"
                            loading="lazy"
                         />
                    </div>
                )}
                <CardTitle className="text-xl font-semibold">{event.title}</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                    Posted on {createdAtFormatted} by {event.postedByName} ({event.postedByScholarNumber})
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-3 text-sm">
                <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <p className="whitespace-pre-wrap">{event.description}</p>
                </div>
                <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <p>Venue: {event.venue}</p>
                </div>
                {/* TODO: Add Location Map Display if GeoPoint exists */} 
                <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <p>
                        {startTimeFormatted}
                        {endTimeFormatted ? ` - ${endTimeFormatted}` : ''}
                    </p>
                </div>
                 <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CalendarPlus className="h-3.5 w-3.5 flex-shrink-0" />
                    <p>{event.numberOfRegistrations} Registration{event.numberOfRegistrations !== 1 ? 's' : ''}</p>
                </div>
            </CardContent>
            <CardFooter className="border-t pt-4 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2">
                <div className="flex items-center gap-2">
                     <Button
                        variant={likeStatus === 'liked' ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => handleLikeDislike(likeStatus === 'liked' ? 'unlike' : 'like')}
                        disabled={isLiking}
                        aria-label="Like"
                     >
                         <ThumbsUp className={`h-4 w-4 ${likeStatus === 'liked' ? 'text-primary' : ''}`} />
                         <span className="ml-1 text-xs">{likeCount}</span>
                    </Button>
                    <Button
                        variant={likeStatus === 'disliked' ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => handleLikeDislike(likeStatus === 'disliked' ? 'unlike' : 'dislike')}
                        disabled={isLiking}
                        aria-label="Dislike"
                     >
                         <ThumbsDown className={`h-4 w-4 ${likeStatus === 'disliked' ? 'text-destructive' : ''}`} />
                         <span className="ml-1 text-xs">{dislikeCount}</span>
                     </Button>
                     <Button variant="ghost" size="sm" onClick={handleShare} aria-label="Share">
                        <Share2 className="h-4 w-4" />
                    </Button>
                </div>
                <Button
                    size="sm"
                    onClick={handleRegister}
                    disabled={isRegistering || isRegistered}
                    className="w-full sm:w-auto"
                    variant={isRegistered ? "outline" : "default"}
                >
                     {isRegistering ? (
                         <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                     ) : isRegistered ? (
                         <CheckSquare className="mr-2 h-4 w-4" />
                     ) : (
                         <CalendarPlus className="mr-2 h-4 w-4" />
                     )}
                     {isRegistering ? 'Registering...' : isRegistered ? 'Registered' : 'Register'}
                 </Button>
            </CardFooter>
        </Card>
    );
};
