import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { User } from 'firebase/auth';
import type { StudentProfile, Event } from '@/types';
import { Button } from '@/components/ui/button';
import { PlusCircle, CalendarClock, CalendarCheck, CalendarX, Loader2 } from 'lucide-react';
import LoadingSpinner from './loading-spinner';
import { fetchEvents } from '@/lib/eventActions';
import { EventCard } from './EventCard';
import { CreateEventForm } from './CreateEventForm';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Timestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';

interface EventsFeedProps {
    user: User | null;
    studentData: StudentProfile | null;
    setActiveSection: (section: string) => void; // To navigate to 'my-events'
}

type EventViewMode = 'upcoming' | 'past';

export const EventsFeed: React.FC<EventsFeedProps> = ({ user, studentData, setActiveSection }) => {
    const [allVisibleEvents, setAllVisibleEvents] = useState<Event[]>([]); // All events fetched
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
    const [viewMode, setViewMode] = useState<EventViewMode>('upcoming'); // Default view
    const { toast } = useToast();

    const loadEvents = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Fetch all events visible to the user/profile
            const fetchedEvents = await fetchEvents(studentData);

            // Process events to add user-specific status (like/dislike)
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

            setAllVisibleEvents(processedEvents);
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
            setAllVisibleEvents([]); // Clear on error
        } finally {
            setLoading(false);
        }
    }, [toast, user, studentData]);

    useEffect(() => {
        // Load events based on user and studentData availability
        if (user !== undefined) { // Load even if studentData is loading/null (might show public events)
           loadEvents();
        } else {
           setLoading(true); // User state not determined yet
        }
    }, [user, studentData, loadEvents]); // Reload if user or studentData changes


    // Filter events based on viewMode (upcoming/past)
    const filteredEvents = useMemo(() => {
        const now = Timestamp.now();
        return allVisibleEvents.filter(event => {
            const eventTime = event.endTime || event.startTime; // Prefer end time if available
            if (!eventTime) {
                 // Events without time are considered upcoming unless explicitly filtered out
                 return viewMode === 'upcoming';
            }
            return viewMode === 'upcoming' ? eventTime >= now : eventTime < now;
        }).sort((a, b) => {
             // Sort upcoming ascending, past descending
             const timeA = a.endTime || a.startTime;
             const timeB = b.endTime || b.startTime;
             const timeAMs = timeA?.toMillis() ?? (viewMode === 'upcoming' ? Infinity : -Infinity);
             const timeBMs = timeB?.toMillis() ?? (viewMode === 'upcoming' ? Infinity : -Infinity);
             return viewMode === 'upcoming' ? timeAMs - timeBMs : timeBMs - timeAMs;
         });
    }, [allVisibleEvents, viewMode]);

    const handleCreateSuccess = (eventLink: string) => {
        loadEvents(); // Refresh events after successful creation
    };

    // User can create if logged in and profile data exists
    const canCreate = user && studentData;

    const buttonBaseClass = "flex-1 sm:flex-none";
    const activeViewClass = "bg-primary text-primary-foreground hover:bg-primary/90";
    const inactiveViewClass = "bg-secondary text-secondary-foreground hover:bg-secondary/80";

    return (
        <div className="events-feed-container max-w-4xl mx-auto p-4 space-y-6">
             <div className="flex flex-col sm:flex-row flex-wrap justify-between items-start sm:items-center mb-4 gap-4">
                <h2 className="text-2xl font-semibold w-full sm:w-auto">Events</h2>

                 {/* Action Buttons */}
                 <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    {canCreate ? (
                         <Button onClick={() => setIsCreateEventOpen(true)} size="sm" variant="default" className={buttonBaseClass}>
                             <PlusCircle className="mr-2 h-4 w-4" /> Create Event
                        </Button>
                     ) : (
                        user !== undefined &&
                         <Alert variant="default" className={`${buttonBaseClass} text-sm p-2`}>
                              <AlertDescription>
                                  {user ? "Profile loading or unavailable." : "Login to create events."}
                              </AlertDescription>
                         </Alert>
                     )}
                      <Button
                         onClick={() => setActiveSection('my-events')}
                         size="sm"
                         variant="outline"
                         className={buttonBaseClass}
                         disabled={!user} // Disable if not logged in
                         title={!user ? "Login to view your events" : "View My Events"}
                     >
                         <CalendarCheck className="mr-2 h-4 w-4" /> My Events
                     </Button>
                 </div>

                {/* View Toggle Buttons */}
                <div className="flex gap-1 border p-0.5 rounded-md bg-muted w-full sm:w-auto">
                    <Button
                        size="sm"
                        variant="ghost"
                        className={cn(buttonBaseClass, "h-8", viewMode === 'upcoming' ? activeViewClass : inactiveViewClass)}
                        onClick={() => setViewMode('upcoming')}
                    >
                        <CalendarClock className="mr-2 h-4 w-4" /> Upcoming
                    </Button>
                    <Button
                        size="sm"
                         variant="ghost"
                         className={cn(buttonBaseClass, "h-8", viewMode === 'past' ? activeViewClass : inactiveViewClass)}
                        onClick={() => setViewMode('past')}
                    >
                         <CalendarX className="mr-2 h-4 w-4" /> Past
                    </Button>
                </div>
            </div>

            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

            {/* Loading State */}
            {loading && (
                <div className="text-center py-10">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    <p className="mt-2 text-muted-foreground">Loading events...</p>
                </div>
            )}

            {/* Empty State */}
            {!loading && filteredEvents.length === 0 && !error && (
                <p className="text-center py-10 text-muted-foreground">
                    No {viewMode} events found{viewMode === 'upcoming' ? ' matching your profile or posted yet' : ''}.
                </p>
            )}

             {/* Login Prompt (if applicable) */}
             {user === null && !loading && allVisibleEvents.length === 0 && (
                 <p className="text-center py-10 text-muted-foreground">Please log in to view events.</p>
             )}


            {/* Display Events */}
            {!loading && filteredEvents.length > 0 && !error && (
                <div className="flex flex-col gap-6">
                    {filteredEvents.map(event => (
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
