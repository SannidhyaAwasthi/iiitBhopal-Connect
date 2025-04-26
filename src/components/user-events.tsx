import React, { useState, useEffect, useCallback } from 'react';
import type { User } from 'firebase/auth';
import type { StudentProfile, Event } from '@/types';
import { Button } from '@/components/ui/button';
import LoadingSpinner from './loading-spinner';
import { fetchUserEvents, deleteEvent } from '@/lib/eventActions'; // Import the actions
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Edit, Trash2, Users, Loader2 } from 'lucide-react'; // Icons for buttons, Added Loader2
import { EventRegistrationsDialog } from './EventRegistrationsDialog'; // Import Registrations Dialog
import { EditEventForm } from './EditEventForm'; // Import Edit Form Dialog

interface UserEventsProps {
    user: User | null; // Allow null for consistency
    studentData: StudentProfile | null; // Student data might still be loading initially
}

const UserEvents: React.FC<UserEventsProps> = ({ user, studentData }) => {
    const [myEvents, setMyEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null); // Track deleting state
    const [error, setError] = useState<string | null>(null);
    const [selectedEventForEdit, setSelectedEventForEdit] = useState<Event | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const { toast } = useToast();

    // --- Load User Events ---
    const loadUserEvents = useCallback(async () => {
        if (!user) {
            setLoading(false);
            setError("You must be logged in to see your events.");
            setMyEvents([]); // Clear events if user logs out
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const events = await fetchUserEvents(user.uid);
            setMyEvents(events);
        } catch (err: any) {
            console.error("Error fetching user events:", err);
             if (err.code === 'permission-denied') {
                 setError("You don't have permission to view your events (check Firestore rules).");
             } else {
                 setError("Failed to load your events.");
             }
            toast({ variant: "destructive", title: "Error Loading Events", description: err.message });
            setMyEvents([]); // Clear events on error
        } finally {
            setLoading(false);
        }
    }, [user, toast]);

    useEffect(() => {
        loadUserEvents();
    }, [loadUserEvents]);

    // --- Handle Delete ---
    const handleDelete = async (eventId: string, posterUrl?: string | null) => {
        if (!window.confirm("Are you sure you want to delete this event? This action cannot be undone.")) return;
        setDeletingId(eventId); // Set deleting state
        const originalEvents = [...myEvents];
        // Optimistic UI update
        setMyEvents(prevEvents => prevEvents.filter(event => event.id !== eventId));
        try {
            await deleteEvent(eventId, posterUrl);
            toast({ title: "Event Deleted Successfully" });
            // No need to call loadUserEvents, optimistic update handles it
        } catch (error: any) {
            console.error("Error deleting event:", error);
            toast({ variant: "destructive", title: "Delete Failed", description: error.message });
            setMyEvents(originalEvents); // Revert optimistic update on error
        } finally {
            setDeletingId(null); // Reset deleting state
        }
    };

    // --- Handle Edit ---
    const handleEdit = (event: Event) => {
         setSelectedEventForEdit(event);
         setIsEditDialogOpen(true);
    };

    const handleEditSuccess = () => {
        setIsEditDialogOpen(false);
        setSelectedEventForEdit(null);
        loadUserEvents(); // Refresh the list after successful edit
    };

    if (loading) {
        return <div className="text-center py-10"><LoadingSpinner /> Loading your events...</div>;
    }

    if (error) {
        return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>;
    }

    if (!user) {
        return <p className="text-center py-10 text-muted-foreground">Please log in to view your events.</p>;
    }


    if (myEvents.length === 0) {
        return <p className="text-center py-10 text-muted-foreground">You haven't created any events yet.</p>;
    }

    return (
        <div className="user-events-container space-y-6 max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold">My Events</h2>

            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

            <div className="space-y-4">
                {myEvents.map(event => (
                    <div key={event.id} className="p-4 border rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:shadow-sm transition-shadow duration-150">
                        <div className="flex-grow">
                            <h3 className="font-semibold text-lg">{event.title}</h3>
                            <p className="text-sm text-muted-foreground line-clamp-2">{event.description}</p>
                            <p className="text-xs text-muted-foreground mt-1">Venue: {event.venue}</p>
                            <p className="text-xs text-muted-foreground">Registrations: {event.numberOfRegistrations}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-start sm:justify-end shrink-0 mt-3 sm:mt-0">
                            {/* View Registrations Button & Dialog */}
                            <EventRegistrationsDialog
                                eventId={event.id}
                                eventTitle={event.title}
                                triggerButton={
                                    <Button variant="outline" size="sm" title="View Registrations">
                                        <Users className="h-4 w-4 mr-1 sm:mr-0 lg:mr-1" />
                                        <span className="hidden sm:inline lg:hidden xl:inline">({event.numberOfRegistrations})</span>
                                        <span className="sm:hidden lg:inline xl:hidden">Regs</span>
                                    </Button>
                                }
                            />

                            {/* Edit Button */}
                            <Button variant="outline" size="sm" onClick={() => handleEdit(event)} title="Edit Event" disabled={deletingId === event.id}>
                                <Edit className="h-4 w-4 mr-1 sm:mr-0 lg:mr-1" />
                                <span className="hidden sm:inline">Edit</span>
                            </Button>

                            {/* Delete Button */}
                            <Button variant="destructive" size="sm" onClick={() => handleDelete(event.id, event.poster)} title="Delete Event" disabled={deletingId === event.id}>
                                {deletingId === event.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1 sm:mr-0 lg:mr-1" />}
                                <span className="hidden sm:inline">Delete</span>
                            </Button>
                        </div>
                    </div>
                ))}
            </div>


             {/* Edit Event Dialog (conditionally rendered) */}
             {selectedEventForEdit && (
                 <EditEventForm
                     event={selectedEventForEdit}
                     isOpen={isEditDialogOpen}
                     onOpenChange={setIsEditDialogOpen}
                     onSuccess={handleEditSuccess}
                 />
             )}
        </div>
    );
};

export default UserEvents;
