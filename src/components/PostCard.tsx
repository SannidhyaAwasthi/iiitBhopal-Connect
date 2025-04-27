import React, { useState, useEffect } from 'react';
import type { Post } from './posts-feed'; // Adjust import path if necessary
import { handleVote, handleFavorite } from '@/lib/postActions'; // Import actions
import { useAuth } from '@/hooks/use-auth';
import { formatDistanceToNow } from 'date-fns';
import { ThumbsUp, ThumbsDown, Star, Loader2, Trash2, Edit } from 'lucide-react'; // Use lucide icons, add Loader2, Trash2, Edit
import { useToast } from '@/hooks/use-toast'; // Import useToast
import { Button } from '@/components/ui/button'; // Use Button component for consistency
import { cn } from '@/lib/utils'; // Import cn for conditional classes
import Image from 'next/image'; // Import next/image for handling images
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
         setCurrentUpvotes(post.upvotesCount);
         setCurrentDownvotes(post.downvotesCount);
         setCurrentUserVote(post.userVote || null);
         setIsFavorited(post.isFavorite || false);
     }, [post.id, post.upvotesCount, post.downvotesCount, post.userVote, post.isFavorite]);


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
            if (currentUserVote === 'up') { // Unvoting up
                optimisticUpvotes = Math.max(0, currentUpvotes - 1);
                optimisticUserVote = null;
            } else { // Voting up (either from null or down)
                optimisticUpvotes = currentUpvotes + 1;
                if (currentUserVote === 'down') {
                    optimisticDownvotes = Math.max(0, currentDownvotes - 1);
                }
                optimisticUserVote = 'up';
            }
        } else { // voteType === 'down'
            if (currentUserVote === 'down') { // Unvoting down
                optimisticDownvotes = Math.max(0, currentDownvotes - 1);
                optimisticUserVote = null;
            } else { // Voting down (either from null or up)
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
        setIsFavorited(optimisticFavoriteStatus); // Apply optimistic update

        toast({
            title: optimisticFavoriteStatus ? "Notice Pinned" : "Notice Unpinned",
            description: optimisticFavoriteStatus ? "Pin" : "Removed from pinned",
        });

        try {
            const actualNewStatus = await handleFavorite(user.uid, post.id);
             // If the actual status from the backend is different from the optimistic one, correct it
             if (actualNewStatus !== optimisticFavoriteStatus) {
                 console.warn("[PostCard] Optimistic favorite status diverged. Correcting state.");
                 setIsFavorited(actualNewStatus);
                 // Optionally update the toast or show a correction message
                 toast({
                     title: actualNewStatus ? "Pinned (Synced)" : "Unpined (Synced)",
                     description: "Status updated from server.",
                 });
             }
            console.log("[PostCard] Favorite action successful.");
        } catch (err: any) {
            console.error("Favorite action failed:", err);
            setIsFavorited(previousFavoriteStatus); // Rollback optimistic update
            toast({
                variant: "destructive",
                title: "Pin Failed",
                description: err.message || "Could not update pinned status.",
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
    };


    const formattedTimestamp = post.timestamp ? formatDistanceToNow(post.timestamp.toDate(), { addSuffix: true }) : 'Date unknown';

    const baseButtonClass = "flex items-center space-x-1.5 p-1 rounded-md transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"; // Reduced padding

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
        // Use isFavorited state for styling
        isFavorited ? 'text-accent dark:text-blue-400 font-semibold' : 'text-gray-600 dark:text-gray-400 hover:text-accent dark:hover:text-blue-300'
    );

    const isLoading = isVoting || isFavoriting || isDeleting; // Combined loading state

    return (
        // Reduced vertical padding (py-3) and margin-bottom (mb-3)
        <div ref={ref} className="border p-3 rounded-lg shadow mb-3 bg-card text-card-foreground transition-shadow duration-200 hover:shadow-md flex flex-col h-full">
             <div className="flex justify-between items-start mb-1">
                 <div>
                    {/* Smaller title */}
                    <h3 className="text-lg font-bold">{post.title}</h3>
                    <p className="text-xs text-muted-foreground">
                         By {post.authorName || 'Unknown Author'} • {formattedTimestamp}
                    </p>
                 </div>
                 {/* --- Edit/Delete Buttons --- */}
                 {showActions && user && user.uid === post.authorId && (
                     <div className="flex space-x-1"> {/* Smaller space */}
                         <Button
                             variant="ghost"
                             size="icon"
                             className="h-7 w-7 text-muted-foreground hover:text-foreground" // Smaller button
                             onClick={handleEdit}
                             disabled={isLoading}
                             title="Edit Post"
                         >
                             <Edit className="h-3.5 w-3.5" /> {/* Smaller icon */}
                             <span className="sr-only">Edit</span>
                         </Button>
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                 <Button
                                     variant="ghost"
                                     size="icon"
                                     className="h-7 w-7 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50" // Smaller button
                                     disabled={isLoading}
                                     title="Delete Post"
                                 >
                                    {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Trash2 className="h-3.5 w-3.5" />} {/* Smaller icon */}
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

             {/* Smaller margins, clamp text */}
             <p className="mt-1 mb-2 text-sm leading-relaxed line-clamp-3 flex-grow">{post.body}</p>

             {post.imageUrls && post.imageUrls.length > 0 && (
                 // Smaller margins, grid setup for images
                 <div className="mt-2 mb-2 grid grid-cols-3 gap-1">
                     {post.imageUrls.slice(0, 3).map((url, index) => ( // Limit to 3 previews
                         <a
                             key={index}
                             href={url}
                             target="_blank"
                             rel="noopener noreferrer"
                             className="block aspect-square relative overflow-hidden rounded border border-border cursor-pointer" // Added relative, overflow-hidden
                         >
                             <Image // Use next/image with fill
                                src={url}
                                alt={`Post image ${index + 1}`}
                                fill // Use fill instead of width/height
                                sizes="(max-width: 640px) 30vw, (max-width: 1024px) 20vw, 15vw" // Provide sizes for optimization
                                className="object-cover" // Keep object-cover, remove w-full h-full
                                loading="lazy"
                             />
                         </a>
                     ))}
                 </div>
             )}
            {/* Reduced top padding */}
            <div className="mt-auto pt-2 border-t border-border flex items-center justify-between">
                 <div className="flex items-center space-x-2"> {/* Smaller space */}
                    <button
                        onClick={() => onVote('up')}
                        className={upvoteButtonClass}
                        disabled={!user || isLoading}
                        aria-pressed={currentUserVote === 'up'}
                        aria-label="Upvote"
                        title="Upvote"
                    >                        {/* Use isVoting state */}
                        {isVoting && currentUserVote !== 'down' ? <Loader2 className="h-4 w-4 animate-spin"/> : <ThumbsUp className={cn("h-4 w-4", currentUserVote === 'up' ? 'fill-current' : '')} />} {/* Smaller icon */}
                        <span className="text-xs tabular-nums">{currentUpvotes}</span> {/* Smaller text */}
                    </button>

                    <button
                        onClick={() => onVote('down')}
                        className={downvoteButtonClass}
                        disabled={!user || isLoading}
                        aria-pressed={currentUserVote === 'down'}
                        aria-label="Downvote"
                        title="Downvote"
                    >
                        {isVoting && currentUserVote !== 'up' ? <Loader2 className="h-4 w-4 animate-spin"/> : <ThumbsDown className={cn("h-4 w-4", currentUserVote === 'down' ? 'fill-current' : '')} />} {/* Smaller icon */}
                        <span className="text-xs tabular-nums">{currentDownvotes}</span> {/* Smaller text */}
                    </button>
                 </div>

                <button
                    onClick={onFavorite}
                    className={favoriteButtonClass}
                    disabled={!user || isLoading}
                    aria-pressed={isFavorited} // Use isFavorited state
                    aria-label={isFavorited ? "Unpin" : "Pin"}
                    title={isFavorited ? "Remove from Pinned Notices" : "Pin"}
                >                    {/* Use isFavoriting state */}
                     {isFavoriting ? <Loader2 className="h-4 w-4 animate-spin"/> : <Star className={cn("h-4 w-4", isFavorited ? 'fill-current' : '')} />} {/* Smaller icon */}
                    <span className="text-xs hidden sm:inline">Pinned Notices</span> {/* Smaller text */}
                </button>
            </div>
        </div>
    );
});

PostCard.displayName = 'PostCard';
