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
// Fetch events, filter by visibility, and enrich with user-specific like/registration status.
export async function fetchEvents(
    userProfile?: StudentProfile | null, // For visibility filtering
    userId?: string | null // For checking like/registration status
): Promise<Event[]> {
    console.log(`[fetchEvents] Called with userId: ${userId ?? 'none'}`);
    try {
        const q = query(collection(db, EVENTS_COLLECTION), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const allEvents = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));

        // 1. Filter based on visibility
        let visibleEvents: Event[];
        if (userProfile) {
             console.log("[fetchEvents] Filtering events for profile:", userProfile.scholarNumber);
             visibleEvents = allEvents.filter(event => {
                const visibility = event.visibility;
                if (!visibility) return true; // Visible if no settings
                const isBranchVisible = (visibility.branches?.length ?? 0) === 0 || visibility.branches?.includes(userProfile.branch);
                const isYearVisible = (visibility.yearsOfPassing?.length ?? 0) === 0 || visibility.yearsOfPassing?.includes(userProfile.yearOfPassing);
                const isGenderVisible = (visibility.genders?.length ?? 0) === 0 || visibility.genders?.includes(userProfile.gender);
                return isBranchVisible && isYearVisible && isGenderVisible;
            });
        } else {
             console.log("[fetchEvents] No profile, filtering for public events.");
             visibleEvents = allEvents.filter(event => {
                 const visibility = event.visibility;
                 return !visibility || ((visibility.branches?.length ?? 0) === 0 && (visibility.yearsOfPassing?.length ?? 0) === 0 && (visibility.genders?.length ?? 0) === 0);
            });
        }
        console.log(`[fetchEvents] ${visibleEvents.length} events visible after filtering.`);

        // 2. Enrich with user-specific data (like/registration status) if userId is provided
        if (userId && visibleEvents.length > 0) {
            console.log(`[fetchEvents] Enriching ${visibleEvents.length} visible events for user ${userId}...`);
            // Check registration status in batch
            const eventIds = visibleEvents.map(e => e.id);
            const registrationStatuses = await getEventsRegistrationStatus(userId, eventIds);
            console.log(`[fetchEvents] Registration statuses fetched:`, registrationStatuses);

            // Map to add userLikeStatus and isRegistered
            const enrichedEvents = visibleEvents.map(event => {
                let userLikeStatus: 'liked' | 'disliked' | null = null;
                if (event.likes?.includes(userId)) {
                    userLikeStatus = 'liked';
                } else if (event.dislikes?.includes(userId)) {
                    userLikeStatus = 'disliked';
                }
                const isRegistered = registrationStatuses[event.id] ?? false;
                return { ...event, userLikeStatus, isRegistered };
            });
            console.log(`[fetchEvents] Enrichment complete.`);
            return enrichedEvents;
        } else {
            // If no user or no visible events, return events without enrichment (or set defaults)
            console.log(`[fetchEvents] No user or no visible events, returning ${visibleEvents.length} events without enrichment.`);
            return visibleEvents.map(event => ({ ...event, userLikeStatus: null, isRegistered: false }));
        }

    } catch (error) {
        console.error("[fetchEvents] Error: ", error);
        throw new Error(`Could not fetch events: ${(error as Error).message}`);
    }
}

// Fetch events created BY the user
export async function fetchUserEvents(
    userId: string,
    // Add currentUserId to check like/registration status for events listed on "My Events"
    currentUserId?: string | null
): Promise<Event[]> {
    if (!userId) return [];
    console.log(`[fetchUserEvents] Fetching events created by ${userId}. Current user: ${currentUserId ?? 'none'}`);
    try {
        const q = query(collection(db, EVENTS_COLLECTION), where('postedBy', '==', userId), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const userCreatedEvents = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
        console.log(`[fetchUserEvents] Found ${userCreatedEvents.length} events created by ${userId}.`);

        // Enrich with current user's like/registration status if provided
        if (currentUserId && userCreatedEvents.length > 0) {
            console.log(`[fetchUserEvents] Enriching events for current user ${currentUserId}...`);
            const eventIds = userCreatedEvents.map(e => e.id);
            const registrationStatuses = await getEventsRegistrationStatus(currentUserId, eventIds);

            const enrichedEvents = userCreatedEvents.map(event => {
                let userLikeStatus: 'liked' | 'disliked' | null = null;
                if (event.likes?.includes(currentUserId)) {
                    userLikeStatus = 'liked';
                } else if (event.dislikes?.includes(currentUserId)) {
                    userLikeStatus = 'disliked';
                }
                 const isRegistered = registrationStatuses[event.id] ?? false;
                return { ...event, userLikeStatus, isRegistered };
            });
            console.log(`[fetchUserEvents] Enrichment complete.`);
            return enrichedEvents;
        } else {
             // Return basic data if no current user or no events found
             return userCreatedEvents.map(event => ({ ...event, userLikeStatus: null, isRegistered: false }));
        }

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
    try { 
        const docSnap = await getDoc(registrationRef);
        return docSnap.exists(); 
    }
    catch (error) { 
        console.error(`[checkRegStatus] Error checking registration for user ${userId} on event ${eventId}:`, error); 
        return false; 
    }
}

export async function getEventsRegistrationStatus(userId: string, eventIds: string[]): Promise<Record<string, boolean>> {
    if (!userId || eventIds.length === 0) return {};

    const registrationStatuses: Record<string, boolean> = {};
    eventIds.forEach(id => registrationStatuses[id] = false);

    // Firestore 'in' query is limited to 10? No, doc gets are fine.
    // Check docs individually for now, batching might be complex with subcollections
    const checks = eventIds.map(async (eventId) => {
        const registrationRef = doc(db, `${EVENTS_COLLECTION}/${eventId}/registrations`, userId);
        try {
            const docSnap = await getDoc(registrationRef);
            return { eventId, isRegistered: docSnap.exists() };
        } catch (error) {
            console.error(`[getEventsRegStatus] Error checking registration for user ${userId} on event ${eventId}:`, error);
            return { eventId, isRegistered: false };
        }
    });

    const results = await Promise.all(checks);
    results.forEach(result => {
        registrationStatuses[result.eventId] = result.isRegistered;
    });

    console.log(`[getEventsRegStatus] Checked ${eventIds.length} events for user ${userId}. Results:`, registrationStatuses);
    return registrationStatuses;
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
