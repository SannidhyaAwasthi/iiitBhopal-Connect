import type { User } from 'firebase/auth';
import type { StudentProfile } from '@/types'; // Use StudentProfile for consistency
import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { db } from '@/config/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { PostCard } from './PostCard'; // Import PostCard directly
import type { Post } from './posts-feed'; // Import Post type
import LoadingSpinner from './loading-spinner';
import { getPostsVoteStatus, getFavoritePostIds } from '@/lib/postActions'; // Import actions

interface UserFavoritesProps {
    user: User | null; // Allow null for consistency
    studentData: StudentProfile | null; // Can be null initially
}

const UserFavorites: FC<UserFavoritesProps> = ({ user, studentData }) => {
    const [favoritePosts, setFavoritePosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchFavoritePosts = async () => {
            if (!user) {
                setLoading(false);
                setError("Please log in to see your favorites.");
                setFavoritePosts([]); // Clear favorites if user logs out
                return;
            }

            setLoading(true);
            setError(null);

            try {
                // 1. Get the IDs of the user's favorite posts
                const favoriteIds = await getFavoritePostIds(user.uid);

                if (favoriteIds.length === 0) {
                    setFavoritePosts([]);
                    setLoading(false);
                    return;
                }

                // 2. Fetch the actual post documents using the IDs
                const fetchedPosts: Post[] = [];
                const chunkSize = 30; // Use the current limit

                for (let i = 0; i < favoriteIds.length; i += chunkSize) {
                    const chunkIds = favoriteIds.slice(i, i + chunkSize);
                    if (chunkIds.length === 0) continue;

                    const postsRef = collection(db, 'posts');
                    const q = query(postsRef, where('__name__', 'in', chunkIds));
                    const querySnapshot = await getDocs(q);

                    const chunkPostsData = querySnapshot.docs.map(docSnap => ({
                        id: docSnap.id,
                        ...(docSnap.data() as Omit<Post, 'id' | 'userVote' | 'isFavorite'>),
                    }));
                    fetchedPosts.push(...chunkPostsData);
                }


                 // 3. Fetch Vote Status for these posts
                 let voteStatuses: Record<string, 'up' | 'down' | null> = {};
                 const visiblePostIds = fetchedPosts.map(p => p.id);

                 if (user && visiblePostIds.length > 0) {
                    try {
                       voteStatuses = await getPostsVoteStatus(user.uid, visiblePostIds);
                    } catch (statusError) {
                       console.error("Error fetching vote status for notices:", statusError);
                    }
                 }

                // 4. Combine data and set state
                const postsWithStatus: Post[] = fetchedPosts.map(post => ({
                    ...post,
                    userVote: voteStatuses[post.id] || null,
                    isFavorite: true, // All posts in this list are favorites
                }));

                // Optionally sort favorites
                 postsWithStatus.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));

                setFavoritePosts(postsWithStatus);

            } catch (err: any) {
                console.error("Error fetching favorite posts:", err);
                // Handle specific Firebase permission errors
                 if (err.code === 'permission-denied') {
                     setError("You don't have permission to view favorites (check Firestore rules).");
                 } else {
                     setError("Failed to load your favorite posts.");
                 }
                 setFavoritePosts([]); // Clear posts on error
            } finally {
                setLoading(false);
            }
        };

        fetchFavoritePosts();
    }, [user]); // Re-fetch if the user changes

    if (loading) {
        return <div className="text-center py-10"><LoadingSpinner /> Loading pinned notices...</div>;
    }

    if (error) {
        return <p className="text-center py-10 text-red-500 dark:text-red-400">{error}</p>;
    }

    // This check should ideally be handled by the parent (Dashboard), but added for safety
    if (!user) {
         return <p className="text-center py-10 text-muted-foreground">Please log in to view your pinned notices.</p>;
    }


    if (favoritePosts.length === 0) {
        return <p className="text-center py-10 text-muted-foreground">You haven't pinned any notices yet.</p>;
    }

    return (
        <div className="user-favorites-container max-w-3xl mx-auto p-4 space-y-6">
            <h2 className="text-2xl font-semibold mb-4 border-b pb-2">Your Pinned Notices</h2>
            <div className="posts-list space-y-4">
                {favoritePosts.map(post => (
                    <PostCard key={post.id} post={post} />
                ))}
            </div>
        </div>
    );
};

export default UserFavorites;
