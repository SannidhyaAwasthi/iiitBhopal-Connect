import React, { useState, useEffect, useCallback } from 'react';
import type { User } from 'firebase/auth';
import type { StudentProfile, Event } from '@/types';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import LoadingSpinner from './loading-spinner';
import { fetchEvents } from '@/lib/eventActions';
import { EventCard } from './EventCard';
import { CreateEventForm } from './CreateEventForm';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from "@/components/ui/alert";

interface EventsFeedProps {
    user: User | null;
    studentData: StudentProfile | null;
}

export const EventsFeed: React.FC<EventsFeedProps> = ({ user, studentData }) => {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
    const { toast } = useToast();

    const loadEvents = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const fetchedEvents = await fetchEvents();

            const processedEvents = fetchedEvents.map(event => {
                 const userId = user?.uid;
                 const userLikeStatus = userId ? (
                     event.likes?.includes(userId) ? 'liked' :
                     event.dislikes?.includes(userId) ? 'disliked' :
                     null
                 ) : null;
                 return {
                     ...event,
                     userLikeStatus: userLikeStatus,
                 } as Event;
            });

            setEvents(processedEvents);
        } catch (err: any) {
            console.error("Error fetching events:", err);
            setError("Failed to load events. Please try again later.");
            if (!(err.code === 'permission-denied' || err.message?.includes('permissions'))) {
                 toast({
                    variant: "destructive",
                    title: "Error Loading Events",
                    description: err.message || "Could not fetch events.",
                });
            }
        } finally {
            setLoading(false);
        }
    }, [toast, user]);

    useEffect(() => {
        // Load events only if the user object is defined (could be null or a user)
        if (user !== undefined) {
           loadEvents();
        } else {
           // User state is not yet determined (initial load)
           setLoading(true); // Keep loading until user state is known
        }
    }, [user, loadEvents]);


    const handleCreateSuccess = (eventLink: string) => {
        loadEvents();
    };

    // User can create if logged in and profile data exists
    const canCreate = user && studentData;

    return (
        <div className="events-feed-container max-w-3xl mx-auto p-4 space-y-6">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                <h2 className="text-2xl font-semibold">Upcoming Events</h2>
                {canCreate ? (
                     <Button onClick={() => setIsCreateEventOpen(true)} size="sm" variant="default">
                         <PlusCircle className="mr-2 h-4 w-4" /> Create Event
                    </Button>
                 ) : (
                    // Show alert if user is loaded but cannot create (missing profile or logged out)
                     user !== undefined &&
                    <Alert variant="default" className="w-full sm:w-auto text-sm p-2">
                          <AlertDescription>
                              {user ? "Profile loading or unavailable." : "Login to create events."}
                          </AlertDescription>
                     </Alert>
                 )}
            </div>

            {error && <p className="text-center py-10 text-red-500 dark:text-red-400">{error}</p>}

            {loading && user !== undefined && (
                <div className="text-center py-10"><LoadingSpinner /> Loading events...</div>
            )}

             {/* Show login prompt only when user is known to be null */}
             {user === null && !loading && (
                 <p className="text-center py-10 text-muted-foreground">Please log in to view events.</p>
             )}


            {user && !loading && events.length === 0 && !error && (
                <p className="text-center py-10 text-muted-foreground">No events posted yet.</p>
            )}

            {/* Display events only if user is logged in and not loading */}
            {user && !loading && events.length > 0 && (
                <div className="flex flex-col gap-6">
                    {events.map(event => (
                        <EventCard
                            key={event.id}
                            event={event}
                            currentUser={user}
                            currentStudentProfile={studentData}
                            onUpdate={loadEvents}
                        />
                    ))}
                </div>
            )}

             <CreateEventForm
                 user={user}
                 studentData={studentData}
                 isOpen={isCreateEventOpen}
                 onOpenChange={setIsCreateEventOpen}
                 onSuccess={handleCreateSuccess}
             />
        </div>
    );
};
