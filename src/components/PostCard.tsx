import React, { useState, useEffect } from 'react';
import { Post } from './posts-feed'; // Adjust import path if necessary
import { handleVote, handleFavorite } from '@/lib/postActions'; // Import actions
import { useAuth } from '@/hooks/use-auth';
import { formatDistanceToNow } from 'date-fns';
import { ThumbsUp, ThumbsDown, Star, Loader2 } from 'lucide-react'; // Use lucide icons, add Loader2
import { useToast } from '@/hooks/use-toast'; // Import useToast
import { Button } from '@/components/ui/button'; // Use Button component for consistency
import { cn } from '@/lib/utils'; // Import cn for conditional classes

interface PostCardProps {
    post: Post;
    // Optional callback if PostsFeed needs immediate notification of changes
    // onUpdatePost?: (postId: string, updates: Partial<Post>) => void;
}

export const PostCard = React.forwardRef<HTMLDivElement, PostCardProps>(({ post /*, onUpdatePost*/ }, ref) => {
    const { user } = useAuth();
    const { toast } = useToast();

    // --- Local State for Optimistic Updates ---
    // Initialize state directly from the post prop
    const [currentUpvotes, setCurrentUpvotes] = useState(post.upvotesCount);
    const [currentDownvotes, setCurrentDownvotes] = useState(post.downvotesCount);
    const [currentUserVote, setCurrentUserVote] = useState<'up' | 'down' | null>(post.userVote || null);
    const [isFavorited, setIsFavorited] = useState(post.isFavorite || false);
    const [isVoting, setIsVoting] = useState(false); // Prevent rapid clicks on vote
    const [isFavoriting, setIsFavoriting] = useState(false); // Prevent rapid clicks on favorite

    // Effect to update local state if the post prop changes externally (e.g., on a feed refresh)
     useEffect(() => {
         setCurrentUpvotes(post.upvotesCount);
         setCurrentDownvotes(post.downvotesCount);
         setCurrentUserVote(post.userVote || null);
         setIsFavorited(post.isFavorite || false);
     }, [post.upvotesCount, post.downvotesCount, post.userVote, post.isFavorite]); // More specific dependencies


    const onVote = async (voteType: 'up' | 'down') => {
        if (!user || isVoting || isFavoriting) return; // Prevent action if not logged in or already processing
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
            } else { // Adding or switching to upvote
                optimisticUpvotes = currentUpvotes + 1;
                // Decrement downvotes only if switching from downvote
                if (currentUserVote === 'down') {
                    optimisticDownvotes = Math.max(0, currentDownvotes - 1);
                }
                optimisticUserVote = 'up';
            }
        } else { // voteType === 'down'
            if (currentUserVote === 'down') { // Removing downvote
                optimisticDownvotes = Math.max(0, currentDownvotes - 1);
                optimisticUserVote = null;
            } else { // Adding or switching to downvote
                optimisticDownvotes = currentDownvotes + 1;
                // Decrement upvotes only if switching from upvote
                if (currentUserVote === 'up') {
                     optimisticUpvotes = Math.max(0, currentUpvotes - 1);
                 }
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
             console.log("Vote successful, optimistic state applied:", { up: optimisticUpvotes, down: optimisticDownvotes, vote: optimisticUserVote });
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
        if (!user || isFavoriting || isVoting) return; // Prevent action if not logged in or already processing
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
            // This can happen if the Firestore operation fails after the optimistic update
             if (actualNewStatus !== optimisticFavoriteStatus) {
                 console.warn("Optimistic favorite status diverged from actual status. Correcting state.");
                 setIsFavorited(actualNewStatus);
                 // Update toast if status was corrected back
                 if (actualNewStatus === previousFavoriteStatus) {
                     toast({
                         title: actualNewStatus ? "Post Favorited (Corrected)" : "Post Unfavorited (Corrected)",
                         description: "Status updated based on server response.",
                     });
                 }
             }
            console.log("Favorite successful, optimistic state applied:", { favorited: optimisticFavoriteStatus });
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
    const baseButtonClass = "flex items-center space-x-1.5 p-1.5 rounded-md transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed";

    const upvoteButtonClass = cn(
        baseButtonClass,
        "hover:bg-green-100 dark:hover:bg-green-900/50",
        currentUserVote === 'up' ? 'text-green-600 dark:text-green-500 font-semibold' : 'text-gray-600 dark:text-gray-400 hover:text-green-700 dark:hover:text-green-400'
    );
    const downvoteButtonClass = cn(
         baseButtonClass,
         "hover:bg-red-100 dark:hover:bg-red-900/50",
         currentUserVote === 'down' ? 'text-red-600 dark:text-red-500 font-semibold' : 'text-gray-600 dark:text-gray-400 hover:text-red-700 dark:hover:text-red-400'
    );
    const favoriteButtonClass = cn(
        baseButtonClass,
        "hover:bg-blue-100 dark:hover:bg-blue-900/50",
        isFavorited ? 'text-accent dark:text-blue-400 font-semibold' : 'text-gray-600 dark:text-gray-400 hover:text-accent dark:hover:text-blue-300'
    );

    const isLoading = isVoting || isFavoriting;

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

            <div className="mt-4 pt-3 border-t border-border flex items-center space-x-4"> {/* Adjusted spacing */}
                 {/* Upvote Button */}
                <button
                    onClick={() => onVote('up')}
                    className={upvoteButtonClass}
                    disabled={!user || isLoading}
                    aria-pressed={currentUserVote === 'up'} // Accessibility
                    aria-label="Upvote"
                    title="Upvote"
                >
                    {isVoting && currentUserVote !== 'down' ? <Loader2 className="h-4 w-4 animate-spin"/> : <ThumbsUp className={`h-5 w-5 ${currentUserVote === 'up' ? 'fill-current' : ''}`} />}
                    <span className="text-sm tabular-nums">{currentUpvotes}</span>
                </button>

                 {/* Downvote Button */}
                <button
                    onClick={() => onVote('down')}
                    className={downvoteButtonClass}
                    disabled={!user || isLoading}
                    aria-pressed={currentUserVote === 'down'} // Accessibility
                    aria-label="Downvote"
                    title="Downvote"
                >
                     {isVoting && currentUserVote !== 'up' ? <Loader2 className="h-4 w-4 animate-spin"/> : <ThumbsDown className={`h-5 w-5 ${currentUserVote === 'down' ? 'fill-current' : ''}`} />}
                    <span className="text-sm tabular-nums">{currentDownvotes}</span>
                </button>

                 {/* Favorite Button */}
                <button
                    onClick={onFavorite}
                    className={favoriteButtonClass}
                    disabled={!user || isLoading}
                    aria-pressed={isFavorited} // Accessibility
                    aria-label={isFavorited ? "Unfavorite" : "Favorite"}
                    title={isFavorited ? "Remove from Favorites" : "Add to Favorites"}
                >
                     {isFavoriting ? <Loader2 className="h-4 w-4 animate-spin"/> : <Star className={`h-5 w-5 ${isFavorited ? 'fill-current' : ''}`} />}
                    <span className="text-sm">Favorite</span>
                </button>

                {/* TODO: Implement Share, Comment count, etc. */}
            </div>
        </div>
    );
});

PostCard.displayName = 'PostCard';
