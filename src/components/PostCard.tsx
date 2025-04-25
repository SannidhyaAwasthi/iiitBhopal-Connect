import React, { useState, useEffect } from 'react';
import type { Post } from './posts-feed'; // Adjust import path if necessary
import { handleVote, handleFavorite } from '@/lib/postActions'; // Import actions
import { useAuth } from '@/hooks/use-auth';
import { formatDistanceToNow } from 'date-fns';
import { ThumbsUp, ThumbsDown, Star, Loader2, Trash2, Edit } from 'lucide-react'; // Use lucide icons, add Loader2, Trash2, Edit
import { useToast } from '@/hooks/use-toast'; // Import useToast
import { Button } from '@/components/ui/button'; // Use Button component for consistency
import { cn } from '@/lib/utils'; // Import cn for conditional classes
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"; // Import Alert Dialog

interface PostCardProps {
    post: Post;
    // Optional flags/callbacks for user-specific actions
    showActions?: boolean; // Flag to show Edit/Delete buttons
    onDelete?: (postId: string) => Promise<void>;
    onEdit?: (post: Post) => void; // Pass the full post object for editing
}

export const PostCard = React.forwardRef<HTMLDivElement, PostCardProps>(({ post, showActions = false, onDelete, onEdit }, ref) => {
    const { user } = useAuth();
    const { toast } = useToast();

    // --- Local State for Optimistic Updates ---
    const [currentUpvotes, setCurrentUpvotes] = useState(post.upvotesCount);
    const [currentDownvotes, setCurrentDownvotes] = useState(post.downvotesCount);
    const [currentUserVote, setCurrentUserVote] = useState<'up' | 'down' | null>(null); // Initialize to null
    const [isFavorited, setIsFavorited] = useState(false); // Initialize to false
    const [isVoting, setIsVoting] = useState(false);
    const [isFavoriting, setIsFavoriting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false); // State for delete operation


    // Effect to fetch initial vote/favorite status for the current user
     useEffect(() => {
        // Set initial local state based on props
         setCurrentUpvotes(post.upvotesCount);
         setCurrentDownvotes(post.downvotesCount);
         setCurrentUserVote(post.userVote || null); // Use the prop value if available
         setIsFavorited(post.isFavorite || false); // Use the prop value if available
         // console.log(`[PostCard Effect Init - ${post.id}] Initial state set: Vote=${post.userVote}, Fav=${post.isFavorite}`);
     }, [post.id, post.upvotesCount, post.downvotesCount, post.userVote, post.isFavorite]); // Depend on all relevant props


    const onVote = async (voteType: 'up' | 'down') => {
        if (!user || isVoting || isFavoriting || isDeleting) return;
        setIsVoting(true);

        const previousVote = currentUserVote;
        const previousUpvotes = currentUpvotes;
        const previousDownvotes = currentDownvotes;

        let optimisticUpvotes = currentUpvotes;
        let optimisticDownvotes = currentDownvotes;
        let optimisticUserVote: 'up' | 'down' | null = currentUserVote;

        if (voteType === 'up') {
            if (currentUserVote === 'up') {
                optimisticUpvotes = Math.max(0, currentUpvotes - 1);
                optimisticUserVote = null;
            } else {
                optimisticUpvotes = currentUpvotes + 1;
                if (currentUserVote === 'down') {
                    optimisticDownvotes = Math.max(0, currentDownvotes - 1);
                }
                optimisticUserVote = 'up';
            }
        } else {
            if (currentUserVote === 'down') {
                optimisticDownvotes = Math.max(0, currentDownvotes - 1);
                optimisticUserVote = null;
            } else {
                optimisticDownvotes = currentDownvotes + 1;
                if (currentUserVote === 'up') {
                     optimisticUpvotes = Math.max(0, currentUpvotes - 1);
                 }
                optimisticUserVote = 'down';
            }
        }

        setCurrentUpvotes(optimisticUpvotes);
        setCurrentDownvotes(optimisticDownvotes);
        setCurrentUserVote(optimisticUserVote);

        try {
            await handleVote(user.uid, post.id, voteType);
             console.log("[PostCard] Vote successful, optimistic state applied.");
        } catch (err: any) {
            console.error("Vote failed:", err);
            setCurrentUpvotes(previousUpvotes);
            setCurrentDownvotes(previousDownvotes);
            setCurrentUserVote(previousVote);
            toast({
                variant: "destructive",
                title: "Vote Failed",
                description: err.message || "Could not update vote.",
            });
        } finally {
            setIsVoting(false);
        }
    };

    const onFavorite = async () => {
        if (!user || isFavoriting || isVoting || isDeleting) return;
        setIsFavoriting(true);

        const previousFavoriteStatus = isFavorited;
        const optimisticFavoriteStatus = !isFavorited;
        setIsFavorited(optimisticFavoriteStatus);

        toast({
            title: optimisticFavoriteStatus ? "Post Favorited" : "Post Unfavorited",
            description: optimisticFavoriteStatus ? "Added to your favorites." : "Removed from your favorites.",
        });

        try {
            const actualNewStatus = await handleFavorite(user.uid, post.id);
             if (actualNewStatus !== optimisticFavoriteStatus) {
                 console.warn("Optimistic favorite status diverged. Correcting state.");
                 setIsFavorited(actualNewStatus);
                 if (actualNewStatus === previousFavoriteStatus) {
                     toast({
                         title: actualNewStatus ? "Favorited (Corrected)" : "Unfavorited (Corrected)",
                         description: "Status updated from server.",
                     });
                 }
             }
            console.log("[PostCard] Favorite action successful.");
        } catch (err: any) {
            console.error("Favorite action failed:", err);
            setIsFavorited(previousFavoriteStatus); // Rollback
            toast({
                variant: "destructive",
                title: "Favorite Failed",
                description: err.message || "Could not update favorite status.",
            });
        } finally {
             setIsFavoriting(false);
        }
    };

    const handleDelete = async () => {
        if (!user || !onDelete || isDeleting || isVoting || isFavoriting) return;
        setIsDeleting(true);
        try {
            await onDelete(post.id);
            toast({
                title: "Post Deleted",
                description: "The post has been successfully deleted.",
            });
            // The parent component (UserPosts) will handle removing the card from the list
        } catch (err: any) {
            console.error("Delete failed:", err);
            toast({
                variant: "destructive",
                title: "Delete Failed",
                description: err.message || "Could not delete the post.",
            });
            setIsDeleting(false); // Only reset if delete failed
        }
        // Don't setIsDeleting(false) on success, as the component might unmount
    };

    const handleEdit = () => {
        if (!user || !onEdit || isDeleting || isVoting || isFavoriting) return;
        onEdit(post); // Pass the post data to the parent for editing
        // Parent component (UserPosts) will handle opening the edit modal/form
    };


    const formattedTimestamp = post.timestamp ? formatDistanceToNow(post.timestamp.toDate(), { addSuffix: true }) : 'Date unknown';

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

    const isLoading = isVoting || isFavoriting || isDeleting; // Combined loading state

    return (
        <div ref={ref} className="border p-4 rounded-lg shadow mb-4 bg-card text-card-foreground transition-shadow duration-200 hover:shadow-md">
             <div className="flex justify-between items-start mb-2">
                 <div>
                    <h3 className="text-xl font-bold">{post.title}</h3>
                    <p className="text-xs text-muted-foreground">
                         By {post.authorName || 'Unknown Author'} • {formattedTimestamp}
                    </p>
                 </div>
                 {/* --- Edit/Delete Buttons --- */}
                 {showActions && user && user.uid === post.authorId && (
                     <div className="flex space-x-2">
                         <Button
                             variant="ghost"
                             size="icon"
                             className="h-8 w-8 text-muted-foreground hover:text-foreground"
                             onClick={handleEdit}
                             disabled={isLoading}
                             title="Edit Post"
                         >
                             <Edit className="h-4 w-4" />
                             <span className="sr-only">Edit</span>
                         </Button>
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                 <Button
                                     variant="ghost"
                                     size="icon"
                                     className="h-8 w-8 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50"
                                     disabled={isLoading}
                                     title="Delete Post"
                                 >
                                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}
                                     <span className="sr-only">Delete</span>
                                 </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete your post
                                    and remove its data from our servers.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                    className="bg-destructive hover:bg-destructive/90"
                                >
                                    {isDeleting ? (
                                        <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...
                                        </>
                                    ) : "Delete"}
                                </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                     </div>
                 )}
             </div>

             <p className="mt-2 mb-4 text-sm leading-relaxed">{post.body}</p>

             {post.imageUrls && post.imageUrls.length > 0 && (
                 <div className="mt-4 mb-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                     {post.imageUrls.map((url, index) => (
                         <a key={index} href={url} target="_blank" rel="noopener noreferrer" className="block">
                             <img
                                src={url}
                                alt={`Post image ${index + 1}`}
                                className="w-full h-32 sm:h-40 object-cover rounded-md border border-border cursor-pointer"
                                loading="lazy"
                             />
                         </a>
                     ))}
                 </div>
             )}

            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                 <div className="flex items-center space-x-4">
                    <button
                        onClick={() => onVote('up')}
                        className={upvoteButtonClass}
                        disabled={!user || isLoading}
                        aria-pressed={currentUserVote === 'up'}
                        aria-label="Upvote"
                        title="Upvote"
                    >
                        {isVoting && currentUserVote !== 'down' ? <Loader2 className="h-4 w-4 animate-spin"/> : <ThumbsUp className={`h-5 w-5 ${currentUserVote === 'up' ? 'fill-current' : ''}`} />}
                        <span className="text-sm tabular-nums">{currentUpvotes}</span>
                    </button>

                    <button
                        onClick={() => onVote('down')}
                        className={downvoteButtonClass}
                        disabled={!user || isLoading}
                        aria-pressed={currentUserVote === 'down'}
                        aria-label="Downvote"
                        title="Downvote"
                    >
                         {isVoting && currentUserVote !== 'up' ? <Loader2 className="h-4 w-4 animate-spin"/> : <ThumbsDown className={`h-5 w-5 ${currentUserVote === 'down' ? 'fill-current' : ''}`} />}
                        <span className="text-sm tabular-nums">{currentDownvotes}</span>
                    </button>
                 </div>

                <button
                    onClick={onFavorite}
                    className={favoriteButtonClass}
                    disabled={!user || isLoading}
                    aria-pressed={isFavorited}
                    aria-label={isFavorited ? "Unfavorite" : "Favorite"}
                    title={isFavorited ? "Remove from Favorites" : "Add to Favorites"}
                >
                     {isFavoriting ? <Loader2 className="h-4 w-4 animate-spin"/> : <Star className={`h-5 w-5 ${isFavorited ? 'fill-current' : ''}`} />}
                    <span className="text-sm hidden sm:inline">Favorite</span>
                </button>
            </div>
        </div>
    );
});

PostCard.displayName = 'PostCard';
