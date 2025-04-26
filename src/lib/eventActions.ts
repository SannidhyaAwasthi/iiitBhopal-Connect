import { db, storage } from '@/config/firebase';
import {
    collection,
    addDoc,
    query,
    where,
    orderBy,
    getDocs,
    serverTimestamp,
    doc,
    updateDoc,
    deleteDoc,
    writeBatch,
    getDoc,
    increment,
    arrayUnion,
    arrayRemove,
    Timestamp,
    GeoPoint
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { nanoid } from 'nanoid';
import type { Event, EventRegistration, StudentProfile, VisibilitySettings } from '@/types'; // Import VisibilitySettings
import type { User } from 'firebase/auth'; // Import User type

const EVENTS_COLLECTION = 'events';
const STUDENTS_COLLECTION = 'students';
const STUDENTS_BY_UID_COLLECTION = 'students-by-uid'; // Added for fetching student profile

// === Helper Function for Image Upload ===
async function uploadEventPoster(
    uploaderUid: string,
    imageFile: File,
    eventId: string
): Promise<string> {
    if (!uploaderUid) {
        throw new Error("User ID is missing for poster upload.");
    }
    if (!imageFile || typeof imageFile.name !== 'string' || imageFile.name === '') {
        console.error("[uploadEventPoster] Invalid image file provided (missing or invalid name):", imageFile);
        throw new Error("Invalid image file provided (missing or invalid name).");
    }
    try {
        const uniqueFileName = `${nanoid()}-${imageFile.name}`;
        const imagePath = `eventPosters/${eventId}/${uniqueFileName}`;
        const storageRef = ref(storage, imagePath);
        const uploadResult = await uploadBytes(storageRef, imageFile);
        const downloadURL = await getDownloadURL(uploadResult.ref);
        return downloadURL;
    } catch (uploadError: any) {
        console.error("[uploadEventPoster] Error uploading poster:", uploadError);
        if (uploadError.code?.startsWith('storage/')) {
             throw uploadError;
        }
        throw new Error(`Failed to upload poster: ${uploadError.message || 'Unknown storage error'}`);
    }
}

// === Event Creation ===
export async function createEvent(
    // Include visibility in the input data type
    eventData: Omit<Event, 'id' | 'createdAt' | 'numberOfRegistrations' | 'postedBy' | 'postedByName' | 'postedByScholarNumber' | 'likes' | 'dislikes' | 'eventLink' | 'poster'> & { visibility: VisibilitySettings },
    posterFile: File | null,
    creatorProfile: StudentProfile
): Promise<{ eventId: string; eventLink: string }> {
    if (!creatorProfile || !creatorProfile.uid) {
        throw new Error("Creator profile is required.");
    }
    const eventLink = nanoid(10);
    const tempEventIdForUpload = eventLink; // Use eventLink for temp ID for slightly better grouping
    let posterUrl: string | null = null;
    if (posterFile) {
        posterUrl = await uploadEventPoster(creatorProfile.uid, posterFile, tempEventIdForUpload);
    }
    try {
        // Ensure visibility is included in the document data
        const docData: Omit<Event, 'id'> = {
            ...eventData,
            location: eventData.location || null,
            startTime: eventData.startTime || null,
            endTime: eventData.endTime || null,
            poster: posterUrl,
            createdAt: serverTimestamp() as Timestamp,
            numberOfRegistrations: 0,
            postedBy: creatorProfile.uid,
            postedByName: creatorProfile.name,
            postedByScholarNumber: creatorProfile.scholarNumber,
            likes: [],
            dislikes: [],
            eventLink: eventLink,
            visibility: eventData.visibility, // Pass visibility from input
        };
        const docRef = await addDoc(collection(db, EVENTS_COLLECTION), docData);
        // Optional: If using temp ID, could update storage path here, but keeping simple for now.
        return { eventId: docRef.id, eventLink: eventLink };
    } catch (firestoreError: any) {
        if (posterUrl) {
             try { await deleteObject(ref(storage, posterUrl)); console.log("Cleaned up poster after FS error.")} catch (e) { console.error("Poster cleanup failed", e); }
        }
        throw new Error(`Failed to create event: ${firestoreError.message || 'DB error'}`);
    }
}

// === Event Update ===
export async function updateEvent(
    eventId: string,
    uploaderUid: string,
    // Include visibility in the update data type
    eventData: Partial<Omit<Event, 'id' | 'createdAt' | 'postedBy' | 'postedByName' | 'postedByScholarNumber' | 'likes' | 'dislikes' | 'eventLink' | 'numberOfRegistrations'>>,
    newPosterFile: File | null | undefined, // undefined: no change, null: remove, File: replace
    currentPosterUrl: string | null | undefined
): Promise<void> {
    if (!uploaderUid) throw new Error("Updater UID required.");
    console.log(`[updateEvent] User ${uploaderUid} updating event ${eventId}`);
    const eventRef = doc(db, EVENTS_COLLECTION, eventId);
    let newUploadedUrl: string | null = null; // Track if new upload happens
    let finalPosterUrlForFirestore: string | null | undefined = undefined; // undefined means don't update field

    try {
        // --- Poster Logic ---
        if (newPosterFile === null) { // Explicit request to REMOVE poster
             if (currentPosterUrl) {
                 console.log(`[updateEvent] Removing poster: ${currentPosterUrl}`);
                 try { await deleteObject(ref(storage, currentPosterUrl)); }
                 catch (e) { console.error(`Failed deleting old poster during remove: ${currentPosterUrl}`, e); }
            }
            finalPosterUrlForFirestore = null; // Set Firestore field to null
        } else if (newPosterFile) { // Request to REPLACE poster
            // 1. Delete old poster first (if exists)
            if (currentPosterUrl) {
                console.log(`[updateEvent] Deleting old poster before new upload: ${currentPosterUrl}`);
                try { await deleteObject(ref(storage, currentPosterUrl)); }
                catch (e) { console.error(`Failed deleting old poster before replace: ${currentPosterUrl}`, e); }
            }
            // 2. Upload new poster
             console.log(`[updateEvent] Uploading new poster for ${eventId}`);
             newUploadedUrl = await uploadEventPoster(uploaderUid, newPosterFile, eventId);
             finalPosterUrlForFirestore = newUploadedUrl; // Set Firestore field to new URL
        }
        // else: newPosterFile is undefined, meaning no change requested for poster.
        // finalPosterUrlForFirestore remains undefined.

        // --- Prepare Firestore Update Data ---
        const updateData: { [key: string]: any } = { ...eventData }; // Use any temporarily for easier field manipulation

        // Only add poster field if it was changed (removed or replaced)
        if (finalPosterUrlForFirestore !== undefined) {
            updateData.poster = finalPosterUrlForFirestore;
        }

        // Convert Timestamps if necessary
        if (updateData.startTime && !(updateData.startTime instanceof Timestamp)) {
             updateData.startTime = Timestamp.fromDate(new Date(updateData.startTime as any));
        }
        if (updateData.endTime && !(updateData.endTime instanceof Timestamp)) {
            updateData.endTime = Timestamp.fromDate(new Date(updateData.endTime as any));
        }

        // Convert GeoPoint if necessary
         if (updateData.location && !(updateData.location instanceof GeoPoint)) {
             const loc = updateData.location as any;
             if (typeof loc?.latitude === 'number' && typeof loc?.longitude === 'number') {
                 updateData.location = new GeoPoint(loc.latitude, loc.longitude);
             } else {
                 updateData.location = null; // Default to null if invalid
             }
         }

         // Remove fields that should never be updated this way
         delete updateData.numberOfRegistrations;
         delete updateData.likes;
         delete updateData.dislikes;
         delete updateData.postedBy;
         delete updateData.postedByName;
         delete updateData.postedByScholarNumber;
         delete updateData.createdAt;
         delete updateData.eventLink;

        // --- Perform Firestore Update ---
        if (Object.keys(updateData).length > 0) {
             console.log(`[updateEvent] Updating Firestore doc ${eventId} with:`, updateData);
            await updateDoc(eventRef, updateData);
        } else {
             console.log(`[updateEvent] No changed fields to update in Firestore for ${eventId}.`);
        }
        console.log(`[updateEvent] Event ${eventId} updated successfully.`);

    } catch (error: any) {
         console.error(`[updateEvent] Error updating event ${eventId}:`, error);
         // If a new poster was successfully uploaded but Firestore failed, try to clean up the new poster
         if (newUploadedUrl) {
            console.warn("[updateEvent] Firestore update failed AFTER new poster upload. Cleaning up new poster.");
             try { await deleteObject(ref(storage, newUploadedUrl)); } catch (e) { console.error("New poster cleanup failed after FS error", e); }
         }
         // Re-throw specific errors
         if (error.code === 'permission-denied' || error.message?.includes('permissions')) {
            throw new Error(`Update failed: Permissions.`);
         } else if (error.message?.includes('Invalid image file')) {
             throw error;
         }
        throw new Error(`Failed to update event: ${error.message || 'Unknown error'}`);
    }
}


// === Fetching Events ===
// Fetch all events initially, then filter client-side based on user's profile
export async function fetchEvents(userProfile?: StudentProfile | null): Promise<Event[]> {
    try {
        const q = query(collection(db, EVENTS_COLLECTION), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const allEvents = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));

        // Filter based on visibility if user profile is provided
        if (userProfile) {
             console.log("[fetchEvents] Filtering events for profile:", userProfile.scholarNumber);
            return allEvents.filter(event => {
                const visibility = event.visibility;
                // If no visibility settings, it's visible to all
                if (!visibility) return true;

                const isBranchVisible = visibility.branches?.length === 0 || visibility.branches?.includes(userProfile.branch);
                const isYearVisible = visibility.yearsOfPassing?.length === 0 || visibility.yearsOfPassing?.includes(userProfile.yearOfPassing);
                const isGenderVisible = visibility.genders?.length === 0 || visibility.genders?.includes(userProfile.gender);

                return isBranchVisible && isYearVisible && isGenderVisible;
            });
        } else {
             // If no profile (e.g., logged out), filter for public events only
             console.log("[fetchEvents] No profile provided, filtering for public events.");
            return allEvents.filter(event => {
                 const visibility = event.visibility;
                 // Visible if no restrictions are set
                 return !visibility ||
                        (visibility.branches?.length === 0 &&
                         visibility.yearsOfPassing?.length === 0 &&
                         visibility.genders?.length === 0);
            });
        }
    } catch (error) {
        console.error("[fetchEvents] Error: ", error);
        throw new Error(`Could not fetch events: ${(error as Error).message}`);
    }
}

// Fetch events created BY the user (visibility doesn't apply here)
export async function fetchUserEvents(userId: string): Promise<Event[]> {
    if (!userId) return [];
    try {
        const q = query(collection(db, EVENTS_COLLECTION), where('postedBy', '==', userId), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
    } catch (error) {
        console.error(`[fetchUserEvents] Error for ${userId}: `, error);
        throw new Error(`Could not fetch user events: ${(error as Error).message}`);
    }
}

// === Event Registration ===
export async function registerForEvent(eventId: string, userProfile: StudentProfile): Promise<void> {
    if (!userProfile?.uid || !userProfile?.scholarNumber) throw new Error("Profile required.");
    const eventRef = doc(db, EVENTS_COLLECTION, eventId);
    const registrationRef = doc(db, `${EVENTS_COLLECTION}/${eventId}/registrations`, userProfile.uid);
    const batch = writeBatch(db);
    try {
        const registrationSnap = await getDoc(registrationRef);
        if (registrationSnap.exists()) throw new Error("Already registered.");
        const registrationData: EventRegistration = {
            eventId, uid: userProfile.uid, scholarNumber: userProfile.scholarNumber,
            name: userProfile.name, phoneNumber: userProfile.phoneNumber, email: userProfile.email,
            registrationTime: serverTimestamp() as Timestamp,
        };
        batch.set(registrationRef, registrationData);
        batch.update(eventRef, { numberOfRegistrations: increment(1) });
        await batch.commit();
    } catch (error: any) {
        if (error.message === "Already registered.") throw error;
        if (error.code === 'permission-denied') throw new Error(`Registration failed: Permissions.`);
        throw new Error(`Failed to register: ${error.message || 'Unknown error'}`);
    }
}

export async function checkRegistrationStatus(eventId: string, userId: string): Promise<boolean> {
    if (!userId) return false;
    const registrationRef = doc(db, `${EVENTS_COLLECTION}/${eventId}/registrations`, userId);
    try { return (await getDoc(registrationRef)).exists(); }
    catch (error) { console.error(`[checkRegStatus] Error ${userId}, ${eventId}:`, error); return false; }
}

export async function fetchEventRegistrations(eventId: string): Promise<EventRegistration[]> {
    try {
        const registrationsRef = collection(db, `${EVENTS_COLLECTION}/${eventId}/registrations`);
        const q = query(registrationsRef, orderBy('registrationTime', 'asc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ ...doc.data() } as EventRegistration));
    } catch (error) {
        console.error(`[fetchRegs] Error ${eventId}: `, error);
        throw new Error(`Could not fetch registrations: ${(error as Error).message}`);
    }
}

// === Event Liking/Disliking ===
export async function likeEvent(eventId: string, userId: string): Promise<void> {
    if (!userId) throw new Error("Login required.");
    const eventRef = doc(db, EVENTS_COLLECTION, eventId);
    try { await updateDoc(eventRef, { likes: arrayUnion(userId), dislikes: arrayRemove(userId) }); }
    catch (error: any) { throw new Error(`Like failed: ${error.message}`); }
}

export async function dislikeEvent(eventId: string, userId: string): Promise<void> {
    if (!userId) throw new Error("Login required.");
    const eventRef = doc(db, EVENTS_COLLECTION, eventId);
    try { await updateDoc(eventRef, { dislikes: arrayUnion(userId), likes: arrayRemove(userId) }); }
    catch (error: any) { throw new Error(`Dislike failed: ${error.message}`); }
}

export async function unlikeEvent(eventId: string, userId: string): Promise<void> {
    if (!userId) throw new Error("Login required.");
    const eventRef = doc(db, EVENTS_COLLECTION, eventId);
    try { await updateDoc(eventRef, { likes: arrayRemove(userId), dislikes: arrayRemove(userId) }); }
    catch (error: any) { throw new Error(`Unlike failed: ${error.message}`); }
}

// === Event Deletion ===
export async function deleteEvent(eventId: string, posterUrl?: string | null): Promise<void> {
    console.log(`[deleteEvent] Deleting event ${eventId}`);
    const eventRef = doc(db, EVENTS_COLLECTION, eventId);
    try {
        await deleteDoc(eventRef);
        if (posterUrl) {
            try { await deleteObject(ref(storage, posterUrl)); }
            catch (imageError: any) { console.error(`Poster delete failed: ${posterUrl}`, imageError); }
        }
        // TODO: Delete associated registrations, likes, etc. (maybe via Cloud Function)
    } catch (error: any) {
        if (error.code === 'permission-denied') throw new Error("Delete failed: Permissions.");
        throw new Error(`Failed to delete event: ${error.message || 'Unknown error'}`);
    }
}
