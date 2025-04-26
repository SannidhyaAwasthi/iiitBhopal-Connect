import React, { useState, useEffect } from 'react';
import type { EventRegistration } from '@/types';
import { fetchEventRegistrations } from '@/lib/eventActions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import LoadingSpinner from './loading-spinner';
import { Alert, AlertDescription } from './ui/alert';
import { format } from 'date-fns';

interface EventRegistrationsDialogProps {
    eventId: string;
    eventTitle: string;
    triggerButton: React.ReactNode; // Allow custom trigger button
}

export const EventRegistrationsDialog: React.FC<EventRegistrationsDialogProps> = ({ eventId, eventTitle, triggerButton }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Fetch registrations only when the dialog is open
        if (isOpen) {
            setLoading(true);
            setError(null);
            setRegistrations([]); // Clear previous
            fetchEventRegistrations(eventId)
                .then(data => {
                    setRegistrations(data);
                })
                .catch(err => {
                    console.error("Failed to fetch registrations:", err);
                    setError(err.message || "Could not load registrations.");
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }, [isOpen, eventId]);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>{triggerButton}</DialogTrigger>
            <DialogContent className="max-w-3xl"> {/* Increased width */} 
                <DialogHeader>
                    <DialogTitle>Registrations for "{eventTitle}"</DialogTitle>
                </DialogHeader>
                <div className="mt-4 max-h-[60vh] overflow-y-auto"> {/* Added scroll */} 
                    {loading ? (
                        <div className="text-center p-6"><LoadingSpinner /></div>
                    ) : error ? (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    ) : registrations.length === 0 ? (
                        <p className="text-center text-muted-foreground p-6">No registrations yet.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Scholar No.</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Phone</TableHead>
                                    <TableHead>Registered At</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {registrations.map((reg) => (
                                    <TableRow key={reg.uid}> {/* Use UID as key */} 
                                        <TableCell>{reg.name}</TableCell>
                                        <TableCell>{reg.scholarNumber}</TableCell>
                                        <TableCell>{reg.email}</TableCell>
                                        <TableCell>{reg.phoneNumber || '-'}</TableCell>
                                        <TableCell>
                                            {format(reg.registrationTime.toDate(), 'Pp')}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>
                 <DialogClose asChild className="mt-4">
                     <Button variant="outline">Close</Button>
                 </DialogClose>
            </DialogContent>
        </Dialog>
    );
};
