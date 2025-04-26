import React, { useState, useEffect, useCallback, Dispatch, SetStateAction } from 'react'; // Added Dispatch, SetStateAction
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
    setActiveSection: Dispatch<SetStateAction<string>>; // Added setActiveSection prop type
}

export const EventsFeed: React.FC<EventsFeedProps> = ({ user, studentData, setActiveSection }) => { // Added setActiveSection to destructuring
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
        if (user !== undefined) {
           if (user) {
               loadEvents();
           } else {
               setEvents([]);
               setLoading(false);
               setError(null);
           }
        }
    }, [user, loadEvents]);

    const handleCreateSuccess = (eventLink: string) => {
        loadEvents();
    };

    const canCreate = user && studentData; // Simplified canCreate check

    return (
        <div className="events-feed-container max-w-3xl mx-auto p-4 space-y-6"> 
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                <h2 className="text-2xl font-semibold">Upcoming Events</h2>
                {canCreate ? (
                     <Button onClick={() => setIsCreateEventOpen(true)} size="sm" variant="default">
                         <PlusCircle className="mr-2 h-4 w-4" /> Create Event
                    </Button>
                 ) : (
                     user !== undefined &&
                    <Alert variant="default" className="w-full sm:w-auto text-sm p-2">
                          <AlertDescription>
                               {"Login with a student account to create events."}
                          </AlertDescription>
                     </Alert>
                 )}
            </div>

            {error && <p className="text-center py-10 text-red-500 dark:text-red-400">{error}</p>}

            {loading && user !== undefined && (
                <div className="text-center py-10"><LoadingSpinner /> Loading events...</div>
            )}

            {!user && user !== undefined && !loading && (
                 <p className="text-center py-10 text-muted-foreground">Please log in to view events.</p>
             )}

            {user && !loading && events.length === 0 && !error && (
                <p className="text-center py-10 text-muted-foreground">No events posted yet.</p>
            )}

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
