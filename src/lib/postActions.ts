import { db } from '@/config/firebase';
import {
    doc,
    runTransaction,
    serverTimestamp,
    collection,
    writeBatch,
    getDoc,
    setDoc,
    deleteDoc,
    FieldValue,
    increment,
    where,
    query,
    getDocs,
    orderBy,
    limit // Added limit to the import
} from 'firebase/firestore';
import type { PostVote } from '@/types'; // Assuming you have a PostVote type in src/types/index.ts. If not, define it there.

/**
 * Represents a user's vote on a post.
 * Define this interface in src/types/index.ts if it doesn't exist:
 *
 * export interface PostVote {
 *     userId: string;
 *     postId: string;
 *     voteType: 'up' | 'down';
 *     timestamp: any; // Use Timestamp from 'firebase/firestore' if you need specific type
 * }
 */


/**
 * Handles upvoting or downvoting a post.
 * Uses a transaction to ensure atomicity.
 */
export async function handleVote(userId: string, postId: string, newVoteType: 'up' | 'down') {
    if (!userId) throw new Error("User not authenticated.");

    const postRef = doc(db, 'posts', postId);
    const voteRef = doc(db, 'post_votes', `${userId}_${postId}`); // Composite key

    try {
        await runTransaction(db, async (transaction) => {
            const voteDoc = await transaction.get(voteRef);
            const postDoc = await transaction.get(postRef); // Get post doc for current counts

            if (!postDoc.exists()) {
                throw "Post does not exist.";
            }

             const currentUpvotes = postDoc.data()?.upvotesCount ?? 0;
             const currentDownvotes = postDoc.data()?.downvotesCount ?? 0;


            let upvoteIncrement = 0;
            let downvoteIncrement = 0;

            if (!voteDoc.exists()) {
                // Case 1: No previous vote - Add new vote
                transaction.set(voteRef, {
                    userId: userId,
                    postId: postId,
                    voteType: newVoteType,
                    timestamp: serverTimestamp()
                });
                if (newVoteType === 'up') {
                    upvoteIncrement = 1;
                } else {
                    downvoteIncrement = 1;
                }
            } else {
                // Case 2: Previous vote exists
                const existingVoteType = voteDoc.data()?.voteType;
                if (existingVoteType === newVoteType) {
                    // Case 2a: Clicking the same vote button - Remove vote
                    transaction.delete(voteRef);
                    if (newVoteType === 'up') {
                        upvoteIncrement = -1;
                    } else {
                        downvoteIncrement = -1;
                    }
                } else {
                    // Case 2b: Switching vote
                    transaction.update(voteRef, { voteType: newVoteType, timestamp: serverTimestamp() });
                    if (newVoteType === 'up') { // Switched from down to up
                        upvoteIncrement = 1;
                        downvoteIncrement = -1;
                    } else { // Switched from up to down
                        upvoteIncrement = -1;
                        downvoteIncrement = 1;
                    }
                }
            }

            // Update post counts - ensure counts don't go below zero
            const finalUpvotes = Math.max(0, currentUpvotes + upvoteIncrement);
            const finalDownvotes = Math.max(0, currentDownvotes + downvoteIncrement);


            transaction.update(postRef, {
                 upvotesCount: finalUpvotes,
                 downvotesCount: finalDownvotes,
                 // Optionally update hotScore here or via a Cloud Function trigger
                 // hotScore: calculateHotScore(finalUpvotes, finalDownvotes, postDoc.data()?.timestamp)
             });

        });
        console.log("Vote transaction successful.");
        // Here you would likely trigger a UI update (e.g., refetching posts or updating local state)
    } catch (e: any) {
        console.error("Vote transaction failed: ", e);
        throw e; // Re-throw to be caught by the caller
    }
}


/**
 * Toggles favoriting a post for a user.
 * Returns the new favorite status (true if favorited, false if unfavorited).
 */
export async function handleFavorite(userId: string, postId: string): Promise<boolean> {
    if (!userId) throw new Error("User not authenticated.");

    const favoriteRef = doc(db, 'favoritePosts', `${userId}_${postId}`); // Composite key

    try {
        const favoriteSnap = await getDoc(favoriteRef);

        if (favoriteSnap.exists()) {
            // Already favorited, so unfavorite (delete the doc)
            await deleteDoc(favoriteRef);
            console.log("Post unfavorited.");
            return false;
        } else {
            // Not favorited, so favorite it (create the doc)
            await setDoc(favoriteRef, {
                userId: userId,
                postId: postId,
                timestamp: serverTimestamp()
            });
            console.log("Post favorited.");
            return true;
        }
         // Here you would likely trigger a UI update based on the return value (e.g., updating local state)
    } catch (e: any) {
        console.error("Favorite action failed: ", e);
        throw e; // Re-throw
    }
}


// --- Function to get user's favorite posts (IDs) ---
export async function getFavoritePostIds(userId: string): Promise<string[]> {
     if (!userId) return [];
     const favsRef = collection(db, 'favoritePosts');
     const q = query(favsRef, where('userId', '==', userId));
     const snapshot = await getDocs(q);
     return snapshot.docs.map(doc => doc.data().postId as string);
 }


 // --- Function to get user's vote status for multiple posts ---
 export async function getPostsVoteStatus(userId: string, postIds: string[]): Promise<Record<string, 'up' | 'down' | null>> {
     if (!userId || postIds.length === 0) return {};

     const voteStatuses: Record<string, 'up' | 'down' | null> = {};
     // Initialize all postIds with null vote status
     postIds.forEach(id => voteStatuses[id] = null);

     // Firestore 'in' query is limited to 10 items
     const chunkSize = 10;
     for (let i = 0; i < postIds.length; i += chunkSize) {
         const chunk = postIds.slice(i, i + chunkSize);
         const votesRef = collection(db, 'post_votes');
         // Query for votes by the user on the posts in the current chunk
         const q = query(votesRef, where('userId', '==', userId), where('postId', 'in', chunk));
         const querySnapshot = await getDocs(q);
         querySnapshot.docs.forEach(doc => {
             const vote = doc.data() as PostVote; // Cast to your PostVote type
             voteStatuses[vote.postId] = vote.voteType;
         });
     }
     return voteStatuses;
 }

 // --- Function to fetch a single post ---
 export async function getSinglePost(postId: string) {
     const postRef = doc(db, 'posts', postId);
     const postSnap = await getDoc(postRef);

     if (!postSnap.exists()) {
         return null; // Post not found
     }

     return { id: postSnap.id, ...(postSnap.data() as any) }; // Cast as any, adjust to your Post type
 }

 // --- Function to fetch a user's posts ---
 export async function getUserPosts(userId: string, limitCount = 10) {
     if (!userId) return [];
     const postsRef = collection(db, 'posts');
     // Query for posts by the author, ordered by timestamp descending
     const q = query(postsRef, where('authorId', '==', userId), orderBy('timestamp', 'desc'), limit(limitCount));
     const querySnapshot = await getDocs(q);

     return querySnapshot.docs.map(doc => ({
          id: doc.id,
         ...(doc.data() as any), // Cast as any, adjust to your Post type
     }));
 }