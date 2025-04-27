import { db } from '@/config/firebase';
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
    Timestamp
} from 'firebase/firestore';
import type { Opportunity, OpportunityEligibility, StudentProfile } from '@/types';

const OPPORTUNITIES_COLLECTION = 'opportunities';

// === Opportunity Creation ===
export async function createOpportunity(
    opportunityData: Omit<Opportunity, 'id' | 'createdAt' | 'postedBy' | 'postedByName' | 'postedByScholarNumber'>,
    creatorProfile: StudentProfile
): Promise<string> {
    if (!creatorProfile?.uid) {
        throw new Error("Creator profile is required.");
    }

    // Validate Deadline is in the future (re-check just in case)
    if (opportunityData.deadline.toDate() <= new Date()) {
        throw new Error("Deadline must be in the future.");
    }

    try {
        const docData: Omit<Opportunity, 'id'> = {
            ...opportunityData,
            postedBy: creatorProfile.uid,
            postedByName: creatorProfile.name,
            postedByScholarNumber: creatorProfile.scholarNumber,
            createdAt: serverTimestamp() as Timestamp,
        };

        const docRef = await addDoc(collection(db, OPPORTUNITIES_COLLECTION), docData);
        console.log("[createOpportunity] Opportunity posted successfully with ID: ", docRef.id);
        return docRef.id;

    } catch (firestoreError: any) {
        console.error("[createOpportunity] Error adding opportunity to Firestore: ", firestoreError);
        if (firestoreError.code === 'permission-denied') {
            throw new Error("Permission denied: Could not save the opportunity. Check Firestore Rules.");
        } else {
            throw new Error(`Failed to post opportunity: ${firestoreError.message || 'Unknown database error'}`);
        }
    }
}

// === Fetching Opportunities ===
// Fetch opportunities, filtering by eligibility based on the viewing user's profile
export async function fetchOpportunities(
    userProfile?: StudentProfile | null
): Promise<Opportunity[]> {
    console.log(`[fetchOpportunities] Called for profile: ${userProfile?.scholarNumber ?? 'none'}`);

    try {
        // Base query ordered by deadline ascending (most urgent first)
        let q = query(collection(db, OPPORTUNITIES_COLLECTION), orderBy('deadline', 'asc'));

        // Add a filter to only fetch opportunities where the deadline is in the future
        q = query(q, where('deadline', '>', Timestamp.now()));

        const querySnapshot = await getDocs(q);
        const allActiveOpportunities = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Opportunity));
        console.log(`[fetchOpportunities] Fetched ${allActiveOpportunities.length} active opportunities.`);


        // --- Filter based on user eligibility ---
        if (userProfile) {
            console.log("[fetchOpportunities] Filtering opportunities for profile:", userProfile.scholarNumber);
            const eligibleOpportunities = allActiveOpportunities.filter(opp => {
                const eligibility = opp.eligibility;
                if (!eligibility) return true; // Visible if no settings

                const isBranchEligible = eligibility.branches?.length === 0 || eligibility.branches?.includes(userProfile.branch);
                const isYearEligible = eligibility.yearsOfPassing?.length === 0 || eligibility.yearsOfPassing?.includes(userProfile.yearOfPassing);
                const isGenderEligible = eligibility.genders?.length === 0 || eligibility.genders?.includes(userProfile.gender);

                // Log filtering decision for debugging
                // console.log(`[Filter Check] Opp ID: ${opp.id}, Title: ${opp.title}`);
                // console.log(`  - Branch: Need ${eligibility.branches.join(',') || 'All'}, Has ${userProfile.branch}, Eligible: ${isBranchEligible}`);
                // console.log(`  - Year: Need ${eligibility.yearsOfPassing.join(',') || 'All'}, Has ${userProfile.yearOfPassing}, Eligible: ${isYearEligible}`);
                // console.log(`  - Gender: Need ${eligibility.genders.join(',') || 'All'}, Has ${userProfile.gender}, Eligible: ${isGenderEligible}`);

                return isBranchEligible && isYearEligible && isGenderEligible;
            });
            console.log(`[fetchOpportunities] ${eligibleOpportunities.length} opportunities remaining after eligibility filtering.`);
            return eligibleOpportunities;
        } else {
            // If no user profile, filter for opportunities with NO eligibility restrictions
            console.log("[fetchOpportunities] No profile, filtering for public opportunities.");
            const publicOpportunities = allActiveOpportunities.filter(opp => {
                const eligibility = opp.eligibility;
                return !eligibility || (
                    (eligibility.branches?.length ?? 0) === 0 &&
                    (eligibility.yearsOfPassing?.length ?? 0) === 0 &&
                    (eligibility.genders?.length ?? 0) === 0
                );
            });
             console.log(`[fetchOpportunities] ${publicOpportunities.length} public opportunities found.`);
            return publicOpportunities;
        }

    } catch (error) {
        console.error("[fetchOpportunities] Error: ", error);
        throw new Error(`Could not fetch opportunities: ${(error as Error).message}`);
    }
}


// === Opportunity Deletion (Example - Add Update later if needed) ===
export async function deleteOpportunity(opportunityId: string): Promise<void> {
    console.log(`[deleteOpportunity] Deleting opportunity ${opportunityId}`);
    const opportunityRef = doc(db, OPPORTUNITIES_COLLECTION, opportunityId);
    try {
        await deleteDoc(opportunityRef);
        console.log(`[deleteOpportunity] Opportunity ${opportunityId} deleted successfully.`);
        // Note: If opportunities have associated images/files, add cleanup logic here
    } catch (error: any) {
        console.error(`[deleteOpportunity] Error deleting opportunity ${opportunityId}:`, error);
        if (error.code === 'permission-denied') {
            throw new Error("Delete failed: Permissions check Firestore rules.");
        }
        throw new Error(`Failed to delete opportunity: ${error.message || 'Unknown error'}`);
    }
}

// === Update Opportunity (Example - Add fields as needed) ===
export async function updateOpportunity(
    opportunityId: string,
    updateData: Partial<Pick<Opportunity, 'title' | 'description' | 'applyLink' | 'deadline' | 'eligibility'>>
): Promise<void> {
     console.log(`[updateOpportunity] Updating opportunity ${opportunityId}`);
     const opportunityRef = doc(db, OPPORTUNITIES_COLLECTION, opportunityId);

     // Re-validate deadline if it's being updated
     if (updateData.deadline && updateData.deadline.toDate() <= new Date()) {
         throw new Error("Deadline must be in the future.");
     }

     try {
         await updateDoc(opportunityRef, updateData);
         console.log(`[updateOpportunity] Opportunity ${opportunityId} updated successfully.`);
     } catch (error: any) {
         console.error(`[updateOpportunity] Error updating opportunity ${opportunityId}:`, error);
         if (error.code === 'permission-denied') {
            throw new Error("Update failed: Permissions check Firestore rules.");
         }
         throw new Error(`Failed to update opportunity: ${error.message || 'Unknown error'}`);
     }
 }
