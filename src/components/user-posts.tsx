import type { User } from 'firebase/auth';
import type { StudentProfile } from '@/types'; // Use StudentProfile
import type { Post } from './posts-feed'; // Import Post type
import type { FC } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { db } from '@/config/firebase';
import { collection, query, where, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { PostCard } from './PostCard'; // Import PostCard
import LoadingSpinner from './loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { EditPostForm } from './EditPostForm'; // Import EditPostForm
import { getPostsVoteStatus, getFavoritePostIds } from '@/lib/postActions'; // For status fetching

interface UserPostsProps {
    user: User | null;
    studentData: StudentProfile | null;
}

const UserPosts: FC<UserPostsProps> = ({ user, studentData }) => {
    const [userPosts, setUserPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingPost, setEditingPost] = useState<Post | null>(null); // State to hold post being edited
    const { toast } = useToast();

    const fetchUserPosts = useCallback(async () => {
        if (!user) {
            setLoading(false);
            setError("You must be logged in to see your posts.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const postsRef = collection(db, 'posts');
            const q = query(
                postsRef,
                where('authorId', '==', user.uid),
                orderBy('timestamp', 'desc')
            );
            const querySnapshot = await getDocs(q);

            const fetchedPostsData = querySnapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...(docSnap.data() as Omit<Post, 'id' | 'userVote' | 'isFavorite'>),
            }));

            // Fetch Vote/Favorite Status for these posts
            const postIds = fetchedPostsData.map(p => p.id);
            let voteStatuses: Record<string, 'up' | 'down' | null> = {};
            let favoritePostIds: string[] = [];

            if (user && postIds.length > 0) {
                try {
                    [voteStatuses, favoritePostIds] = await Promise.all([
                        getPostsVoteStatus(user.uid, postIds),
                        getFavoritePostIds(user.uid) // Assume this returns an array of favorited post IDs
                    ]);
                } catch (statusError) {
                    console.error("Error fetching status for user posts:", statusError);
                    // Continue without status
                }
            }

            const postsWithStatus: Post[] = fetchedPostsData.map(post => ({
                ...post,
                userVote: voteStatuses[post.id] || null,
                isFavorite: favoritePostIds.includes(post.id),
            }));

            setUserPosts(postsWithStatus);

        } catch (err: any) {
            console.error("Error fetching user posts:", err);
            setError("Failed to load your posts.");
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchUserPosts();
    }, [fetchUserPosts]); // Re-fetch if user changes or fetch function updates

    const handleDeletePost = async (postId: string) => {
        const postRef = doc(db, 'posts', postId);
        try {
            await deleteDoc(postRef);
            // Optimistically remove the post from the local state
            setUserPosts(prevPosts => prevPosts.filter(p => p.id !== postId));
            // Toast is handled in PostCard's handleDelete
        } catch (err: any) {
            console.error("Error deleting post:", err);
            throw new Error(err.message || "Could not delete post."); // Re-throw for PostCard to catch
        }
    };

    const handleEditPost = (post: Post) => {
        setEditingPost(post); // Set the post to be edited, which opens the EditPostForm
    };

    const handleCloseEdit = (refresh: boolean = false) => {
        setEditingPost(null); // Close the edit form
        if (refresh) {
            fetchUserPosts(); // Refresh posts if changes were made
        }
    };


    if (loading) {
        return <div className="text-center py-10"><LoadingSpinner /> Loading your posts...</div>;
    }

    if (error) {
        return <p className="text-center py-10 text-red-500 dark:text-red-400">{error}</p>;
    }

    if (userPosts.length === 0) {
        return <p className="text-center py-10 text-muted-foreground">You haven't created any posts yet.</p>;
    }

    return (
        <div className="user-posts-container max-w-3xl mx-auto p-4 space-y-6">
            <h2 className="text-2xl font-semibold mb-4 border-b pb-2">Your Posts</h2>

             {/* --- Edit Post Form Modal --- */}
             {editingPost && (
                 <EditPostForm
                     post={editingPost}
                     isOpen={!!editingPost}
                     onClose={handleCloseEdit}
                 />
             )}

            <div className="posts-list space-y-4">
                {userPosts.map(post => (
                    <PostCard
                        key={post.id}
                        post={post}
                        showActions={true} // Enable Edit/Delete buttons
                        onDelete={handleDeletePost}
                        onEdit={handleEditPost}
                    />
                ))}
            </div>
        </div>
    );
};

export default UserPosts;
