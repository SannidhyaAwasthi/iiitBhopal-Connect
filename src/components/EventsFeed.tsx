import React, { useState, useEffect, useCallback } from 'react';
import type { User } from 'firebase/auth';
import type { StudentProfile, Event } from '@/types';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import LoadingSpinner from './loading-spinner';
import { fetchEvents } from '@/lib/eventActions'; // fetchEvents now accepts profile
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
            // Pass studentData to fetchEvents for filtering
            const fetchedEvents = await fetchEvents(studentData);

            // Process events to add user-specific status (like/dislike)
            const processedEvents = fetchedEvents.map(event => {
                 const userId = user?.uid;
                 const userLikeStatus = userId ? (
                     event.likes?.includes(userId) ? 'liked' :
                     event.dislikes?.includes(userId) ? 'disliked' :
                     null
                 ) : null;
                 // Registration status check might be done in EventCard now
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
    // Depend on studentData as well now
    }, [toast, user, studentData]);

    useEffect(() => {
        // Load events only if the user object is defined and studentData is determined
        if (user !== undefined && studentData !== undefined) {
           loadEvents();
        } else {
           // User or profile state is not yet determined
           setLoading(true); // Keep loading
        }
    }, [user, studentData, loadEvents]); // Add studentData dependency


    const handleCreateSuccess = (eventLink: string) => {
        loadEvents(); // Refresh events after successful creation
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
                    user !== undefined && studentData !== undefined && // Only show if both states are determined
                    <Alert variant="default" className="w-full sm:w-auto text-sm p-2">
                          <AlertDescription>
                              {user ? "Profile loading or unavailable." : "Login to create events."}
                          </AlertDescription>
                     </Alert>
                 )}
            </div>

            {error && <p className="text-center py-10 text-red-500 dark:text-red-400">{error}</p>}

            {/* Show loading spinner if user or profile is loading, or events are loading */}
            {(loading || user === undefined || studentData === undefined) && (
                <div className="text-center py-10"><LoadingSpinner /> Loading events...</div>
            )}

             {/* Show login prompt only when user is known to be null */}
             {user === null && !loading && (
                 <p className="text-center py-10 text-muted-foreground">Please log in to view events.</p>
             )}


             {/* Show no events message only when not loading and no error */}
            {!loading && events.length === 0 && !error && (
                <p className="text-center py-10 text-muted-foreground">No events matching your profile or no events posted yet.</p>
            )}

            {/* Display events only if not loading and no error */}
            {!loading && events.length > 0 && !error && (
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

             {/* Create Event Form Dialog */}
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
