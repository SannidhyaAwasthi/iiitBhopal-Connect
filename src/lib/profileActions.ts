import { db, storage } from '@/config/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

/**
 * Uploads a user's resume PDF to Firebase Storage.
 * @param userId - The UID of the user.
 * @param file - The PDF file to upload.
 * @returns The download URL of the uploaded resume.
 */
export async function uploadResume(userId: string, file: File): Promise<string> {
    if (!userId) {
        throw new Error("User ID is required to upload resume.");
    }
    if (!file || file.type !== 'application/pdf') {
        throw new Error("Invalid file type. Only PDF files are allowed.");
    }
    // Consider adding a size limit check here as well

    const filePath = `resumes/${userId}/resume.pdf`; // Standardize file name
    const storageRef = ref(storage, filePath);

    console.log(`[uploadResume] Uploading resume for user ${userId} to ${filePath}`);

    try {
        // Upload the file, replacing any existing file with the same name
        const uploadResult = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(uploadResult.ref);
        console.log(`[uploadResume] Resume uploaded successfully. URL: ${downloadURL}`);
        return downloadURL;
    } catch (error: any) {
        console.error(`[uploadResume] Failed to upload resume for user ${userId}:`, error);
        // Handle specific storage errors if needed (e.g., permissions)
        if (error.code === 'storage/unauthorized') {
            throw new Error("Permission denied to upload resume. Check Storage rules.");
        }
        throw new Error(`Resume upload failed: ${error.message || 'Unknown storage error'}`);
    }
}

/**
 * Deletes a user's resume from Firebase Storage.
 * @param userId - The UID of the user whose resume should be deleted.
 */
export async function deleteResume(userId: string): Promise<void> {
     if (!userId) {
         throw new Error("User ID is required to delete resume.");
     }
     const filePath = `resumes/${userId}/resume.pdf`;
     const storageRef = ref(storage, filePath);

     console.log(`[deleteResume] Deleting resume for user ${userId} from ${filePath}`);

     try {
         await deleteObject(storageRef);
         console.log(`[deleteResume] Resume deleted successfully for user ${userId}.`);
     } catch (error: any) {
         console.error(`[deleteResume] Failed to delete resume for user ${userId}:`, error);
         if (error.code === 'storage/object-not-found') {
             console.warn(`[deleteResume] Resume not found for user ${userId}, possibly already deleted.`);
             // Don't throw an error if the file wasn't found, just return successfully.
             return;
         } else if (error.code === 'storage/unauthorized') {
             throw new Error("Permission denied to delete resume. Check Storage rules.");
         }
         throw new Error(`Resume deletion failed: ${error.message || 'Unknown storage error'}`);
     }
 }


/**
 * Updates the resumeUrl field in the user's student document.
 * @param userId - The UID of the user.
 * @param scholarNumber - The scholar number of the user (required to find the document).
 * @param resumeUrl - The new resume URL, or null to remove it.
 */
export async function updateStudentResumeUrl(userId: string, scholarNumber: string, resumeUrl: string | null): Promise<void> {
    if (!userId || !scholarNumber) {
        throw new Error("User ID and Scholar Number are required to update resume URL.");
    }

    const studentDocRef = doc(db, 'students', scholarNumber);

    console.log(`[updateStudentResumeUrl] Updating resume URL for user ${userId} (Scholar: ${scholarNumber}) to: ${resumeUrl ?? 'null'}`);

    try {
         // Check if document exists before updating (optional, but good practice)
         const studentSnap = await getDoc(studentDocRef);
         if (!studentSnap.exists()) {
             throw new Error(`Student document not found for scholar number: ${scholarNumber}`);
         }
         // Security check: Ensure the UID in the document matches the authenticated user's UID
         if (studentSnap.data()?.uid !== userId) {
            console.error(`[updateStudentResumeUrl] Mismatch: User ${userId} trying to update profile for ${studentSnap.data()?.uid}`);
            throw new Error("Authorization error: Cannot update another user's profile.");
         }

        await updateDoc(studentDocRef, {
            resumeUrl: resumeUrl // Update the field, setting it to null removes it
        });
        console.log(`[updateStudentResumeUrl] Resume URL updated successfully for ${scholarNumber}.`);
    } catch (error: any) {
        console.error(`[updateStudentResumeUrl] Failed to update resume URL for ${scholarNumber}:`, error);
        if (error.code === 'permission-denied') {
            throw new Error("Permission denied to update profile. Check Firestore rules.");
        }
        throw new Error(`Failed to update profile: ${error.message || 'Unknown database error'}`);
    }
}