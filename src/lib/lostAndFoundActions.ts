import { db, storage } from '@/config/firebase'; // Make sure storage is exported from firebase config
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
    arrayUnion,
    arrayRemove,
    deleteDoc,
    writeBatch,
    getDoc,
    Timestamp // Import Timestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'; // Import storage functions
import { v4 as uuidv4 } from 'uuid';
import type { LostAndFoundItem, StudentProfile, ClaimerInfo } from '@/types';

const LOST_AND_FOUND_COLLECTION = 'lostAndFound';
const STUDENTS_COLLECTION = 'students'; // Assuming this is the name
const STUDENTS_BY_UID_COLLECTION = 'students-by-uid';

// === Reporting Items ===

/**
 * Adds a new 'lost' item report to Firestore.
 */
export async function addLostItem(itemData: Omit<LostAndFoundItem, 'id' | 'imageUrl' | 'claimers' | 'confirmedClaimer'>) {
    console.log("[addLostItem] Attempting to add:", itemData);
    try {
        const docRef = await addDoc(collection(db, LOST_AND_FOUND_COLLECTION), {
            ...itemData,
            type: 'lost',
            status: 'active', // Explicitly set status
            createdAt: serverTimestamp(), // Add creation timestamp for potential sorting/filtering
        });
        console.log("[addLostItem] Lost item reported successfully with ID: ", docRef.id);
        return docRef.id;
    } catch (error) {
        console.error("[addLostItem] Error adding lost item: ", error);
        throw new Error("Failed to report lost item.");
    }
}

/**
 * Adds a new 'found' item report to Firestore, optionally uploading an image.
 */
export async function addFoundItem(
    itemData: Omit<LostAndFoundItem, 'id' | 'imageUrl' | 'confirmedClaimer'>,
    imageFile: File | null
) {
    console.log("[addFoundItem] Attempting to add:", itemData, "with image:", !!imageFile);
    let imageUrl: string | undefined = undefined;

    if (imageFile) {
        try {
            // Use reporterId for folder structure
             if (!itemData.reporterId) {
                 throw new Error("Reporter ID is missing for image upload.");
             }
            const uniqueFileName = `${uuidv4()}-${imageFile.name}`;
            // Define the storage path. Ensure rules allow writes here.
            const imagePath = `lostAndFound/${itemData.reporterId}/${uniqueFileName}`;
            const storageRef = ref(storage, imagePath);

            console.log(`[addFoundItem] Uploading image to: ${imagePath}`);
            const uploadResult = await uploadBytes(storageRef, imageFile);
            imageUrl = await getDownloadURL(uploadResult.ref);
            console.log(`[addFoundItem] Image uploaded successfully: ${imageUrl}`);
        } catch (uploadError: any) {
            console.error("[addFoundItem] Error uploading found item image:", uploadError);
            // Provide more specific error feedback if possible
             if (uploadError.code === 'storage/unauthorized') {
                 throw new Error("Permission denied: You don't have permission to upload images. Check Storage Rules.");
             } else if (uploadError.code === 'storage/object-not-found') {
                 throw new Error("Upload path not found. Check Storage setup.");
             } else {
                throw new Error(`Failed to upload image: ${uploadError.message || 'Unknown storage error'}`);
             }
        }
    }

    try {
        const docData = {
            ...itemData,
            type: 'found',
            status: 'active',
            imageUrl: imageUrl, // Add the URL if upload was successful
            claimers: [], // Initialize empty array
            createdAt: serverTimestamp(),
            timestamp: itemData.timestamp || Timestamp.now() // Ensure timestamp exists
        };
        console.log("[addFoundItem] Preparing to write to Firestore:", docData);

        const docRef = await addDoc(collection(db, LOST_AND_FOUND_COLLECTION), docData);
        console.log("[addFoundItem] Found item reported successfully with ID: ", docRef.id);
        return docRef.id;
    } catch (firestoreError: any) {
        console.error("[addFoundItem] Error adding found item to Firestore: ", firestoreError);
        // If image upload succeeded but Firestore failed, attempt to delete the image
        if (imageUrl) {
            console.warn("[addFoundItem] Firestore write failed after image upload. Attempting image cleanup.");
            try {
                const imageRefToDelete = ref(storage, imageUrl);
                await deleteObject(imageRefToDelete);
                console.log("[addFoundItem] Cleaned up uploaded image due to Firestore error.");
            } catch (cleanupError) {
                console.error("[addFoundItem] Error cleaning up image:", cleanupError);
            }
        }
        // Provide more specific Firestore error feedback if possible
        if (firestoreError.code === 'permission-denied') {
            throw new Error("Permission denied: Could not save the found item report. Check Firestore Rules.");
        } else {
             throw new Error(`Failed to report found item: ${firestoreError.message || 'Unknown database error'}`);
        }
    }
}


// === Fetching Items ===

/**
 * Fetches active 'lost' items, ordered by timestamp descending.
 */
export async function fetchLostItems(): Promise<LostAndFoundItem[]> {
     console.log("[fetchLostItems] Fetching active lost items...");
    try {
        const q = query(
            collection(db, LOST_AND_FOUND_COLLECTION),
            where('type', '==', 'lost'),
            where('status', '==', 'active'),
            orderBy('timestamp', 'desc')
        );
        const querySnapshot = await getDocs(q);
         console.log(`[fetchLostItems] Fetched ${querySnapshot.docs.length} lost items.`);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LostAndFoundItem));
    } catch (error) {
        console.error("[fetchLostItems] Error fetching lost items: ", error);
        throw new Error("Could not fetch lost items.");
    }
}

/**
 * Fetches active 'found' items, ordered by timestamp descending.
 */
export async function fetchFoundItems(): Promise<LostAndFoundItem[]> {
     console.log("[fetchFoundItems] Fetching active found items...");
    try {
        const q = query(
            collection(db, LOST_AND_FOUND_COLLECTION),
            where('type', '==', 'found'),
            where('status', '==', 'active'),
            orderBy('timestamp', 'desc')
        );
        const querySnapshot = await getDocs(q);
         console.log(`[fetchFoundItems] Fetched ${querySnapshot.docs.length} found items.`);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LostAndFoundItem));
    } catch (error) {
        console.error("[fetchFoundItems] Error fetching found items: ", error);
        throw new Error("Could not fetch found items.");
    }
}


// === Actions on Items ===

/**
 * Creates a 'found' item report based on an existing 'lost' item.
 * This uses the finder's profile details for the new report.
 */
export async function reportItemAsFound(lostItem: LostAndFoundItem, finderProfile: StudentProfile | null) {
     console.log(`[reportItemAsFound] Reporting lost item ID ${lostItem.id} as found by user:`, finderProfile?.uid);
     if (!finderProfile) {
        console.error("[reportItemAsFound] Finder profile is missing.");
        throw new Error("User profile not available. Cannot report item as found.");
    }
    if (!finderProfile.uid || !finderProfile.name || !finderProfile.scholarNumber) {
         console.error("[reportItemAsFound] Finder profile is incomplete:", finderProfile);
        throw new Error("Finder profile data is incomplete.");
    }

    try {
        // Create the data for the new 'found' item post
        const newFoundItemData: Omit<LostAndFoundItem, 'id' | 'imageUrl' | 'confirmedClaimer'> = {
            type: 'found',
            title: `Found: ${lostItem.title}`, // Pre-fill title
            description: lostItem.description, // Copy description
            timestamp: Timestamp.now(), // Set found timestamp to now
            location: lostItem.location, // Copy location
            reporterId: finderProfile.uid, // Use finder's details
            reporterName: finderProfile.name,
            reporterScholarNumber: finderProfile.scholarNumber,
            status: 'active',
            claimers: [],
            // Do not copy imageUrl from lost item
        };

        console.log("[reportItemAsFound] Data for new 'found' post:", newFoundItemData);

        // Call addFoundItem to create the new document (no image initially)
        const newDocId = await addFoundItem(newFoundItemData, null);

        console.log(`[reportItemAsFound] Successfully created new 'found' post (ID: ${newDocId}) based on lost item ID ${lostItem.id}.`);

        // Optionally, you might want to update the original lost item's status,
        // but the current approach keeps them separate.
        // await updateDoc(doc(db, LOST_AND_FOUND_COLLECTION, lostItem.id), { status: 'inactive' });

    } catch (error) {
        console.error("[reportItemAsFound] Error reporting item as found: ", error);
        // Rethrow the specific error from addFoundItem or a general one
        throw error instanceof Error ? error : new Error("Failed to report item as found.");
    }
}


/**
 * Adds a user's UID to the 'claimers' array of a 'found' item.
 */
export async function claimItem(itemId: string, userId: string) {
     console.log(`[claimItem] User ${userId} attempting to claim item ${itemId}`);
    if (!userId) throw new Error("User must be logged in to claim.");
    const itemRef = doc(db, LOST_AND_FOUND_COLLECTION, itemId);
    try {
        await updateDoc(itemRef, {
            claimers: arrayUnion(userId)
        });
        console.log(`[claimItem] User ${userId} successfully claimed item ${itemId}`);
    } catch (error) {
        console.error(`[claimItem] Error claiming item ${itemId} for user ${userId}: `, error);
        throw new Error("Failed to claim item.");
    }
}

/**
 * Removes a user's UID from the 'claimers' array of a 'found' item.
 */
export async function unclaimItem(itemId: string, userId: string) {
      console.log(`[unclaimItem] User ${userId} attempting to unclaim item ${itemId}`);
     if (!userId) throw new Error("User must be logged in to unclaim.");
    const itemRef = doc(db, LOST_AND_FOUND_COLLECTION, itemId);
    try {
        await updateDoc(itemRef, {
            claimers: arrayRemove(userId)
        });
        console.log(`[unclaimItem] User ${userId} successfully unclaimed item ${itemId}`);
    } catch (error) {
        console.error(`[unclaimItem] Error unclaiming item ${itemId} for user ${userId}: `, error);
        throw new Error("Failed to unclaim item.");
    }
}

/**
 * Confirms a claim: sets the 'found' item status to 'inactive',
 * sets the confirmedClaimer, and clears the claimers array.
 */
export async function confirmClaim(itemId: string, claimerUid: string) {
    console.log(`[confirmClaim] Attempting to confirm claim for item ${itemId} by user ${claimerUid}`);
    const itemRef = doc(db, LOST_AND_FOUND_COLLECTION, itemId);
    try {
        await updateDoc(itemRef, {
            status: 'inactive', // Mark as inactive/returned
            confirmedClaimer: claimerUid,
            claimers: [] // Clear the list of pending claimers
        });
        console.log(`[confirmClaim] Claim confirmed for item ${itemId} by user ${claimerUid}`);
    } catch (error) {
        console.error(`[confirmClaim] Error confirming claim for item ${itemId}: `, error);
        throw new Error("Failed to confirm claim.");
    }
}

/**
 * Deletes a 'found' item post and its associated image (if any).
 */
export async function deleteFoundItem(itemId: string, imageUrl?: string) {
    console.log(`[deleteFoundItem] Attempting to delete found item ${itemId}`);
    const itemRef = doc(db, LOST_AND_FOUND_COLLECTION, itemId);
    try {
        // Delete Firestore document
        await deleteDoc(itemRef);
        console.log(`[deleteFoundItem] Deleted Firestore document ${itemId}`);

        // If there's an image URL, delete the image from Storage
        if (imageUrl) {
             console.log(`[deleteFoundItem] Attempting to delete associated image: ${imageUrl}`);
            try {
                const imageRefToDelete = ref(storage, imageUrl);
                await deleteObject(imageRefToDelete);
                console.log(`[deleteFoundItem] Deleted associated image: ${imageUrl}`);
            } catch (imageError: any) {
                 // Log error but don't fail the whole operation if image deletion fails
                 console.error(`[deleteFoundItem] Failed to delete image ${imageUrl}:`, imageError);
                 if (imageError.code === 'storage/object-not-found') {
                     console.warn(`[deleteFoundItem] Image ${imageUrl} not found in storage, possibly already deleted.`);
                 } else if (imageError.code === 'storage/unauthorized') {
                      console.error(`[deleteFoundItem] Permission denied to delete image ${imageUrl}. Check Storage Rules.`);
                 }
            }
        }
    } catch (error) {
        console.error(`[deleteFoundItem] Error deleting found item post ${itemId}: `, error);
        throw new Error("Failed to delete found item post.");
    }
}


// === Helper Functions ===

/**
 * Fetches basic details (name, scholarNumber) for a list of user UIDs.
 * Uses the 'students-by-uid' collection to find the scholar number,
 * then fetches the full profile from the 'students' collection.
 */
export async function fetchClaimerDetails(claimerUids: string[]): Promise<ClaimerInfo[]> {
     console.log("[fetchClaimerDetails] Fetching details for UIDs:", claimerUids);
    if (!claimerUids || claimerUids.length === 0) {
        return [];
    }

    try {
        const promises = claimerUids.map(async (uid) => {
            try {
                 // 1. Look up scholarNumber using UID
                 console.log(`[fetchClaimerDetails] Looking up scholar number for UID: ${uid}`);
                 const uidMapRef = doc(db, STUDENTS_BY_UID_COLLECTION, uid);
                 const uidMapSnap = await getDoc(uidMapRef);
                 if (!uidMapSnap.exists()) {
                     console.warn(`[fetchClaimerDetails] No UID map found for UID: ${uid}`);
                     return null; // Skip if no mapping found
                 }
                 const scholarNumber = uidMapSnap.data()?.scholarNumber;
                 if (!scholarNumber) {
                      console.warn(`[fetchClaimerDetails] Scholar number missing in map for UID: ${uid}`);
                     return null;
                 }
                  console.log(`[fetchClaimerDetails] Found scholar number ${scholarNumber} for UID: ${uid}`);


                 // 2. Look up student details using scholarNumber
                  console.log(`[fetchClaimerDetails] Looking up student profile for scholar number: ${scholarNumber}`);
                 const studentRef = doc(db, STUDENTS_COLLECTION, scholarNumber);
                 const studentSnap = await getDoc(studentRef);

                if (studentSnap.exists()) {
                    const studentData = studentSnap.data() as StudentProfile;
                     console.log(`[fetchClaimerDetails] Found student profile for ${scholarNumber}:`, studentData.name);
                    return {
                        uid: uid,
                        name: studentData.name || 'Unknown Name',
                        scholarNumber: studentData.scholarNumber || 'Unknown Scholar No.',
                    };
                } else {
                    console.warn(`[fetchClaimerDetails] No student profile found for scholar #: ${scholarNumber} (UID: ${uid})`);
                    // Return basic info if profile not found but UID and scholar number are known
                    return { uid: uid, name: 'Unknown Name', scholarNumber: scholarNumber };
                }
            } catch (error) {
                console.error(`[fetchClaimerDetails] Error fetching details for UID ${uid}:`, error);
                return null; // Return null on error for this specific user
            }
        });

        const results = await Promise.all(promises);
        const validDetails = results.filter(detail => detail !== null) as ClaimerInfo[];
        console.log("[fetchClaimerDetails] Fetched details:", validDetails);
        return validDetails;

    } catch (error) {
        console.error("[fetchClaimerDetails] Error fetching claimer details batch:", error);
        return []; // Return empty array on batch error
    }
}
