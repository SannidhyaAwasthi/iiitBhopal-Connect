import React, { useState, useEffect, useCallback } from 'react';
import type { User } from 'firebase/auth';
import type { StudentProfile, Event } from '@/types';
import { Button } from '@/components/ui/button';
import LoadingSpinner from './loading-spinner';
import { fetchUserEvents, deleteEvent } from '@/lib/eventActions'; // Import the actions
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Edit, Trash2, Users } from 'lucide-react'; // Icons for buttons
import { EventRegistrationsDialog } from './EventRegistrationsDialog'; // Import Registrations Dialog
import { EditEventForm } from './EditEventForm'; // Import Edit Form Dialog

interface UserEventsProps {
    user: User; // Assume user is always present here
    studentData: StudentProfile | null; // Student data might still be loading initially
}

const UserEvents: React.FC<UserEventsProps> = ({ user, studentData }) => {
    const [myEvents, setMyEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedEventForEdit, setSelectedEventForEdit] = useState<Event | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    // Note: Registration dialog state is managed within EventRegistrationsDialog itself
    const { toast } = useToast();

    // --- Load User Events --- 
    const loadUserEvents = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const events = await fetchUserEvents(user.uid);
            setMyEvents(events);
        } catch (err: any) {
            console.error("Error fetching user events:", err);
            setError("Failed to load your events.");
            toast({ variant: "destructive", title: "Error Loading Events", description: err.message });
        } finally {
            setLoading(false);
        }
    }, [user.uid, toast]);

    useEffect(() => {
        loadUserEvents();
    }, [loadUserEvents]);

    // --- Handle Delete --- 
    const handleDelete = async (eventId: string, posterUrl?: string | null) => {
        if (!window.confirm("Are you sure you want to delete this event? This action cannot be undone.")) return;
        const originalEvents = [...myEvents];
        setMyEvents(prevEvents => prevEvents.filter(event => event.id !== eventId));
        try {
            await deleteEvent(eventId, posterUrl); 
            toast({ title: "Event Deleted Successfully" });
        } catch (error: any) { 
            console.error("Error deleting event:", error);
            toast({ variant: "destructive", title: "Delete Failed", description: error.message });
            setMyEvents(originalEvents);
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

    return (
        <div className="user-events-container space-y-6 max-w-4xl mx-auto"> 
            <h2 className="text-2xl font-semibold">My Events</h2>

            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

            {loading ? (
                <div className="text-center py-10"><LoadingSpinner /> Loading your events...</div>
            ) : myEvents.length === 0 && !error ? (
                <p className="text-center py-10 text-muted-foreground">You haven't created any events yet.</p>
            ) : (
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
                                <Button variant="outline" size="sm" onClick={() => handleEdit(event)} title="Edit Event">
                                    <Edit className="h-4 w-4 mr-1 sm:mr-0 lg:mr-1" /> 
                                    <span className="hidden sm:inline">Edit</span>
                                </Button>
                                
                                {/* Delete Button */} 
                                <Button variant="destructive" size="sm" onClick={() => handleDelete(event.id, event.poster)} title="Delete Event">
                                    <Trash2 className="h-4 w-4 mr-1 sm:mr-0 lg:mr-1" /> 
                                    <span className="hidden sm:inline">Delete</span>
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

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
