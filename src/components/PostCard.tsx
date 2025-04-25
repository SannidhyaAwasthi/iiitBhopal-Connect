import React, { useState, useEffect } from 'react';
import { Post } from './posts-feed'; // Adjust import path if necessary
import { handleVote, handleFavorite } from '@/lib/postActions'; // Import actions
import { useAuth } from '@/hooks/use-auth';
import { formatDistanceToNow } from 'date-fns';
import { ThumbsUp, ThumbsDown, Star } from 'lucide-react'; // Use lucide icons
import { useToast } from '@/hooks/use-toast'; // Import useToast

interface PostCardProps {
    post: Post;
    // Optional callback if PostsFeed needs immediate notification of changes
    // onUpdatePost?: (postId: string, updates: Partial<Post>) => void;
}

export const PostCard = React.forwardRef<HTMLDivElement, PostCardProps>(({ post /*, onUpdatePost*/ }, ref) => {
    const { user } = useAuth();
    const { toast } = useToast();

    // --- Local State for Optimistic Updates ---
    const [currentUpvotes, setCurrentUpvotes] = useState(post.upvotesCount);
    const [currentDownvotes, setCurrentDownvotes] = useState(post.downvotesCount);
    const [currentUserVote, setCurrentUserVote] = useState<'up' | 'down' | null>(post.userVote || null);
    const [isFavorited, setIsFavorited] = useState(post.isFavorite || false);
    const [isVoting, setIsVoting] = useState(false); // Prevent rapid clicks
    const [isFavoriting, setIsFavoriting] = useState(false); // Prevent rapid clicks


    // Effect to update local state if the post prop changes (e.g., on a feed refresh)
     useEffect(() => {
         setCurrentUpvotes(post.upvotesCount);
         setCurrentDownvotes(post.downvotesCount);
         setCurrentUserVote(post.userVote || null);
         setIsFavorited(post.isFavorite || false);
     }, [post]);


    const onVote = async (voteType: 'up' | 'down') => {
        if (!user || isVoting) return; // Prevent action if not logged in or already processing
        setIsVoting(true);

        // Store previous state for potential rollback
        const previousVote = currentUserVote;
        const previousUpvotes = currentUpvotes;
        const previousDownvotes = currentDownvotes;

        // --- Optimistic Update ---
        let optimisticUpvotes = currentUpvotes;
        let optimisticDownvotes = currentDownvotes;
        let optimisticUserVote: 'up' | 'down' | null = currentUserVote;

        if (voteType === 'up') {
            if (currentUserVote === 'up') { // Removing upvote
                optimisticUpvotes = Math.max(0, currentUpvotes - 1);
                optimisticUserVote = null;
            } else if (currentUserVote === 'down') { // Changing downvote to upvote
                optimisticUpvotes = currentUpvotes + 1;
                optimisticDownvotes = Math.max(0, currentDownvotes - 1);
                optimisticUserVote = 'up';
            } else { // Adding upvote
                optimisticUpvotes = currentUpvotes + 1;
                optimisticUserVote = 'up';
            }
        } else { // voteType === 'down'
            if (currentUserVote === 'down') { // Removing downvote
                optimisticDownvotes = Math.max(0, currentDownvotes - 1);
                optimisticUserVote = null;
            } else if (currentUserVote === 'up') { // Changing upvote to downvote
                optimisticDownvotes = currentDownvotes + 1;
                optimisticUpvotes = Math.max(0, currentUpvotes - 1);
                optimisticUserVote = 'down';
            } else { // Adding downvote
                optimisticDownvotes = currentDownvotes + 1;
                optimisticUserVote = 'down';
            }
        }

        // Apply optimistic updates to local state
        setCurrentUpvotes(optimisticUpvotes);
        setCurrentDownvotes(optimisticDownvotes);
        setCurrentUserVote(optimisticUserVote);

        // --- Call Firestore Action ---
        try {
            await handleVote(user.uid, post.id, voteType);
            // Success - state is already updated optimistically
            // Optional: Call onUpdatePost if needed
            // onUpdatePost?.(post.id, { upvotesCount: optimisticUpvotes, downvotesCount: optimisticDownvotes, userVote: optimisticUserVote });
        } catch (err: any) {
            console.error("Vote failed:", err);
            // --- Rollback on Error ---
            setCurrentUpvotes(previousUpvotes);
            setCurrentDownvotes(previousDownvotes);
            setCurrentUserVote(previousVote);
            toast({
                variant: "destructive",
                title: "Vote Failed",
                description: err.message || "Could not update vote.",
            });
        } finally {
            setIsVoting(false); // Re-enable button
        }
    };

    const onFavorite = async () => {
        if (!user || isFavoriting) return; // Prevent action if not logged in or already processing
        setIsFavoriting(true);

        // Store previous state for potential rollback
        const previousFavoriteStatus = isFavorited;

        // --- Optimistic Update ---
        const optimisticFavoriteStatus = !isFavorited;
        setIsFavorited(optimisticFavoriteStatus);

        // Show optimistic toast message
        toast({
            title: optimisticFavoriteStatus ? "Post Favorited" : "Post Unfavorited",
            description: optimisticFavoriteStatus ? "Added to your favorites." : "Removed from your favorites.",
        });

        // --- Call Firestore Action ---
        try {
            // handleFavorite returns the actual new status, but we primarily rely on optimistic update
            const actualNewStatus = await handleFavorite(user.uid, post.id);
            // Optional: Correct state if optimistic was wrong (rare)
            if (actualNewStatus !== optimisticFavoriteStatus) {
                 setIsFavorited(actualNewStatus);
            }
            // Optional: Call onUpdatePost if needed
            // onUpdatePost?.(post.id, { isFavorite: actualNewStatus });
        } catch (err: any) {
            console.error("Favorite action failed:", err);
            // --- Rollback on Error ---
            setIsFavorited(previousFavoriteStatus);
            toast({
                variant: "destructive",
                title: "Favorite Failed",
                description: err.message || "Could not update favorite status.",
            });
        } finally {
             setIsFavoriting(false); // Re-enable button
        }
    };

    // Format timestamp
    const formattedTimestamp = post.timestamp ? formatDistanceToNow(post.timestamp.toDate(), { addSuffix: true }) : 'Date unknown';

    // --- Determine button styles/icons based on local state ---
    const baseVoteButtonClass = "flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 dark:text-gray-400 hover:text-primary transition-colors duration-150";
    const baseFavoriteButtonClass = "flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 dark:text-gray-400 hover:text-accent transition-colors duration-150";

    const upvoteButtonClass = currentUserVote === 'up' ? 'text-green-600 dark:text-green-500 font-semibold' : '';
    const downvoteButtonClass = currentUserVote === 'down' ? 'text-red-600 dark:text-red-500 font-semibold' : '';
    const favoriteButtonClass = isFavorited ? 'text-accent dark:text-blue-400 font-semibold' : ''; // Use accent color for favorite

    return (
        <div ref={ref} className="border p-4 rounded-lg shadow mb-4 bg-card text-card-foreground transition-shadow duration-200 hover:shadow-md">
             <div className="flex justify-between items-start mb-2">
                 <div>
                    <h3 className="text-xl font-bold">{post.title}</h3>
                    <p className="text-xs text-muted-foreground">
                         By {post.authorName || 'Unknown Author'} • {formattedTimestamp}
                    </p>
                 </div>
                {/* Placeholder for potential actions like delete/edit for the author */}
             </div>

             <p className="mt-2 mb-4 text-sm leading-relaxed">{post.body}</p>

             {post.imageUrls && post.imageUrls.length > 0 && (
                 <div className="mt-4 mb-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                     {post.imageUrls.map((url, index) => (
                         <img
                            key={index}
                            src={url}
                            alt={`Post image ${index + 1}`}
                            className="w-full h-32 sm:h-40 object-cover rounded-md border border-border"
                            loading="lazy" // Add lazy loading
                         />
                     ))}
                 </div>
             )}

            <div className="mt-4 pt-3 border-t border-border flex items-center space-x-6">
                 {/* Upvote Button */}
                <button
                    onClick={() => onVote('up')}
                    className={`${baseVoteButtonClass} ${upvoteButtonClass}`}
                    disabled={!user || isVoting}
                    aria-label="Upvote"
                    title="Upvote"
                >
                    <ThumbsUp className={`h-5 w-5 ${currentUserVote === 'up' ? 'fill-current' : ''}`} />
                    <span className="tabular-nums">{currentUpvotes}</span>
                </button>

                 {/* Downvote Button */}
                <button
                    onClick={() => onVote('down')}
                    className={`${baseVoteButtonClass} ${downvoteButtonClass}`}
                    disabled={!user || isVoting}
                    aria-label="Downvote"
                    title="Downvote"
                >
                     <ThumbsDown className={`h-5 w-5 ${currentUserVote === 'down' ? 'fill-current' : ''}`} />
                    <span className="tabular-nums">{currentDownvotes}</span>
                </button>

                 {/* Favorite Button */}
                <button
                    onClick={onFavorite}
                    className={`${baseFavoriteButtonClass} ${favoriteButtonClass}`}
                    disabled={!user || isFavoriting}
                    aria-label={isFavorited ? "Unfavorite" : "Favorite"}
                    title={isFavorited ? "Remove from Favorites" : "Add to Favorites"}
                >
                     <Star className={`h-5 w-5 ${isFavorited ? 'fill-current' : ''}`} />
                    <span>Favorite</span>
                </button>

                {/* TODO: Implement Share, Comment count, etc. */}
            </div>
        </div>
    );
});

PostCard.displayName = 'PostCard';
