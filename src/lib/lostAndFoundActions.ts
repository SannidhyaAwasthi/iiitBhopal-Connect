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

// === Reporting Items ===

/**
 * Adds a new 'lost' item report to Firestore.
 */
export async function addLostItem(itemData: Omit<LostAndFoundItem, 'id' | 'imageUrl' | 'claimers' | 'confirmedClaimer'>) {
    try {
        const docRef = await addDoc(collection(db, LOST_AND_FOUND_COLLECTION), {
            ...itemData,
            type: 'lost',
            status: 'active', // Explicitly set status
            createdAt: serverTimestamp(), // Add creation timestamp for potential sorting/filtering
        });
        console.log("Lost item reported successfully with ID: ", docRef.id);
        return docRef.id;
    } catch (error) {
        console.error("Error adding lost item: ", error);
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
    let imageUrl: string | undefined = undefined;

    if (imageFile) {
        try {
            // Use reporterId for folder structure
            const uniqueFileName = `${uuidv4()}-${imageFile.name}`;
            const imagePath = `lostAndFound/${itemData.reporterId}/${uniqueFileName}`;
            const storageRef = ref(storage, imagePath);

            console.log(`Uploading image to: ${imagePath}`);
            const uploadResult = await uploadBytes(storageRef, imageFile);
            imageUrl = await getDownloadURL(uploadResult.ref);
            console.log(`Image uploaded successfully: ${imageUrl}`);
        } catch (uploadError) {
            console.error("Error uploading found item image:", uploadError);
            // Decide if you want to throw or continue without image
            throw new Error("Failed to upload image for found item.");
        }
    }

    try {
        const docRef = await addDoc(collection(db, LOST_AND_FOUND_COLLECTION), {
            ...itemData,
            type: 'found',
            status: 'active',
            imageUrl: imageUrl, // Add the URL if upload was successful
            claimers: [], // Initialize empty array
            createdAt: serverTimestamp(),
        });
        console.log("Found item reported successfully with ID: ", docRef.id);
        return docRef.id;
    } catch (error) {
        console.error("Error adding found item: ", error);
        // If image upload succeeded but Firestore failed, consider deleting the image
        if (imageUrl) {
            try {
                const imageRefToDelete = ref(storage, imageUrl);
                await deleteObject(imageRefToDelete);
                console.log("Cleaned up uploaded image due to Firestore error.");
            } catch (cleanupError) {
                console.error("Error cleaning up image:", cleanupError);
            }
        }
        throw new Error("Failed to report found item.");
    }
}


// === Fetching Items ===

/**
 * Fetches active 'lost' items, ordered by timestamp descending.
 */
export async function fetchLostItems(): Promise<LostAndFoundItem[]> {
    try {
        const q = query(
            collection(db, LOST_AND_FOUND_COLLECTION),
            where('type', '==', 'lost'),
            where('status', '==', 'active'),
            orderBy('timestamp', 'desc')
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LostAndFoundItem));
    } catch (error) {
        console.error("Error fetching lost items: ", error);
        throw new Error("Could not fetch lost items.");
    }
}

/**
 * Fetches active 'found' items, ordered by timestamp descending.
 */
export async function fetchFoundItems(): Promise<LostAndFoundItem[]> {
    try {
        const q = query(
            collection(db, LOST_AND_FOUND_COLLECTION),
            where('type', '==', 'found'),
            where('status', '==', 'active'),
            orderBy('timestamp', 'desc')
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LostAndFoundItem));
    } catch (error) {
        console.error("Error fetching found items: ", error);
        throw new Error("Could not fetch found items.");
    }
}


// === Actions on Items ===

/**
 * Creates a 'found' item report based on an existing 'lost' item.
 * This effectively marks the lost item indirectly by creating a corresponding found item.
 * We don't change the status of the original 'lost' item here.
 */
export async function reportItemAsFound(lostItem: LostAndFoundItem, finderProfile: StudentProfile) {
     if (!finderProfile) {
        throw new Error("Finder profile is required.");
    }
    try {
        // Create a new 'found' item document
        await addFoundItem({
            type: 'found', // Explicitly 'found'
            title: `Found: ${lostItem.title}`, // Pre-fill title
            description: lostItem.description, // Copy description
            timestamp: Timestamp.now(), // Set found timestamp to now
            location: lostItem.location, // Copy location (or ask for confirmation?)
            reporterId: finderProfile.uid,
            reporterName: finderProfile.name,
            reporterScholarNumber: finderProfile.scholarNumber,
            status: 'active',
            claimers: [],
            // Do not copy imageUrl from the lost item as it likely doesn't have one
        }, null); // No image needed initially when reporting based on a lost item

        console.log(`Reported lost item '${lostItem.title}' as found.`);
        // Note: We are NOT changing the status of the original lostItem document.
        // The feed will show both the original 'lost' and the new 'found' post.
        // Filtering logic in the UI might hide the original 'lost' post if a corresponding 'found' exists,
        // or users can manually manage/delete their 'lost' posts later.

    } catch (error) {
        console.error("Error reporting item as found: ", error);
        throw new Error("Failed to report item as found.");
    }
}


/**
 * Adds a user's UID to the 'claimers' array of a 'found' item.
 */
export async function claimItem(itemId: string, userId: string) {
    if (!userId) throw new Error("User must be logged in to claim.");
    const itemRef = doc(db, LOST_AND_FOUND_COLLECTION, itemId);
    try {
        await updateDoc(itemRef, {
            claimers: arrayUnion(userId)
        });
        console.log(`User ${userId} claimed item ${itemId}`);
    } catch (error) {
        console.error("Error claiming item: ", error);
        throw new Error("Failed to claim item.");
    }
}

/**
 * Removes a user's UID from the 'claimers' array of a 'found' item.
 */
export async function unclaimItem(itemId: string, userId: string) {
     if (!userId) throw new Error("User must be logged in to unclaim.");
    const itemRef = doc(db, LOST_AND_FOUND_COLLECTION, itemId);
    try {
        await updateDoc(itemRef, {
            claimers: arrayRemove(userId)
        });
        console.log(`User ${userId} unclaimed item ${itemId}`);
    } catch (error) {
        console.error("Error unclaiming item: ", error);
        throw new Error("Failed to unclaim item.");
    }
}

/**
 * Confirms a claim: sets the 'found' item status to 'inactive',
 * sets the confirmedClaimer, and clears the claimers array.
 */
export async function confirmClaim(itemId: string, claimerUid: string) {
    const itemRef = doc(db, LOST_AND_FOUND_COLLECTION, itemId);
    try {
        await updateDoc(itemRef, {
            status: 'inactive', // Mark as inactive/returned
            confirmedClaimer: claimerUid,
            claimers: [] // Clear the list of pending claimers
        });
        console.log(`Claim confirmed for item ${itemId} by user ${claimerUid}`);
    } catch (error) {
        console.error("Error confirming claim: ", error);
        throw new Error("Failed to confirm claim.");
    }
}

/**
 * Deletes a 'found' item post and its associated image (if any).
 */
export async function deleteFoundItem(itemId: string, imageUrl?: string) {
    const itemRef = doc(db, LOST_AND_FOUND_COLLECTION, itemId);
    try {
        // Delete Firestore document
        await deleteDoc(itemRef);
        console.log(`Deleted found item post ${itemId}`);

        // If there's an image URL, delete the image from Storage
        if (imageUrl) {
            try {
                const imageRefToDelete = ref(storage, imageUrl);
                await deleteObject(imageRefToDelete);
                console.log(`Deleted associated image: ${imageUrl}`);
            } catch (imageError) {
                console.error(`Failed to delete image ${imageUrl}:`, imageError);
                // Log error but don't fail the whole operation if image deletion fails
            }
        }
    } catch (error) {
        console.error("Error deleting found item post: ", error);
        throw new Error("Failed to delete found item post.");
    }
}


// === Helper Functions ===

/**
 * Fetches basic details (name, scholarNumber) for a list of user UIDs.
 * Assumes a 'students' collection where the document ID is the scholarNumber.
 * Requires an intermediate 'students-by-uid' lookup collection.
 */
export async function fetchClaimerDetails(claimerUids: string[]): Promise<ClaimerInfo[]> {
    if (!claimerUids || claimerUids.length === 0) {
        return [];
    }

    const userDetails: ClaimerInfo[] = [];
    const batch = writeBatch(db); // Use batch for potential future writes, not needed for reads

    try {
        // Limit concurrent fetches if needed, but for small numbers, Promise.all is fine.
        const promises = claimerUids.map(async (uid) => {
            try {
                 // 1. Look up scholarNumber using UID
                 const uidMapRef = doc(db, 'students-by-uid', uid);
                 const uidMapSnap = await getDoc(uidMapRef);
                 if (!uidMapSnap.exists()) {
                     console.warn(`No UID map found for claimer UID: ${uid}`);
                     return null; // Skip if no mapping found
                 }
                 const scholarNumber = uidMapSnap.data()?.scholarNumber;
                 if (!scholarNumber) {
                      console.warn(`Scholar number missing in map for claimer UID: ${uid}`);
                     return null;
                 }


                 // 2. Look up student details using scholarNumber
                 const studentRef = doc(db, STUDENTS_COLLECTION, scholarNumber);
                 const studentSnap = await getDoc(studentRef);

                if (studentSnap.exists()) {
                    const studentData = studentSnap.data() as StudentProfile; // Assuming StudentProfile type matches
                    return {
                        uid: uid, // Use the original UID passed in
                        name: studentData.name || 'Unknown Name',
                        scholarNumber: studentData.scholarNumber || 'Unknown Scholar No.',
                    };
                } else {
                    console.warn(`No student profile found for claimer UID: ${uid} (Scholar #: ${scholarNumber})`);
                    // Return basic info if profile not found but UID is known
                    return { uid: uid, name: 'Unknown Name', scholarNumber: scholarNumber };
                }
            } catch (error) {
                console.error(`Error fetching details for claimer UID ${uid}:`, error);
                return null; // Return null on error for this specific user
            }
        });

        const results = await Promise.all(promises);

        // Filter out null results (errors or not found)
        return results.filter(detail => detail !== null) as ClaimerInfo[];

    } catch (error) {
        console.error("Error fetching claimer details in batch:", error);
        // Return empty or partially fetched details depending on desired behavior
        return [];
    }
}
