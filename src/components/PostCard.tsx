import React from 'react';
// Assuming Post type is imported here from PostsFeed or types/index
// Ensure the Post interface here matches the one in posts-feed.tsx and your types/index.ts
import { Post } from './posts-feed'; // Adjust import path if necessary
import { handleVote, handleFavorite } from '@/lib/postActions'; // Import actions
import { useAuth } from '@/hooks/use-auth';
import { formatDistanceToNow } from 'date-fns'; // Using date-fns for friendly timestamps, install if needed: npm install date-fns or yarn add date-fns

interface PostCardProps {
    post: Post;
    // Optionally add a callback to update the feed's state after a vote/favorite action
    // onUpdatePost?: (postId: string, updates: Partial<Post>) => void;
}

// Use React.forwardRef because PostsFeed needs to attach a ref to the last PostCard for infinite scrolling
export const PostCard = React.forwardRef<HTMLDivElement, PostCardProps>(({ post /*, onUpdatePost*/ }, ref) => {
    const { user } = useAuth();

    // State to manage optimistic updates for votes and favorite status (optional but improves UX)
    // const [currentUpvotes, setCurrentUpvotes] = useState(post.upvotesCount);
    // const [currentDownvotes, setCurrentDownvotes] = useState(post.downvotesCount);
    // const [currentUserVote, setCurrentUserVote] = useState(post.userVote);
    // const [isFavorited, setIsFavorited] = useState(post.isFavorite);

    // Effect to update local state if the post prop changes (e.g., on a feed refresh)
    // useEffect(() => {
    //     setCurrentUpvotes(post.upvotesCount);
    //     setCurrentDownvotes(post.downvotesCount);
    //     setCurrentUserVote(post.userVote);
    //     setIsFavorited(post.isFavorite);
    // }, [post]);


    const onVote = async (voteType: 'up' | 'down') => {
        if (!user) return; // Should not happen if used within authenticated route, but good check

        try {
            // TODO: Implement optimistic UI update here before calling handleVote
            // For example, update local state (currentUserVote, currentUpvotes, currentDownvotes)
            // based on the new voteType and existing voteType.

            await handleVote(user.uid, post.id, voteType);

            // TODO: After successful vote, you might want to:
            // 1. Fetch the updated post from Firestore to get the final counts and vote status.
            // 2. Or, if using a real-time listener in the feed, the update will come automatically.
            // 3. Or, update the feed's state via a callback (e.g., onUpdatePost).

            console.log(`Voted ${voteType} on post ${post.id}`);

        } catch (err) {
            console.error("Vote failed:", err);
            // TODO: Revert optimistic UI updates on error
        }
    };

    const onFavorite = async () => {
        if (!user) return;

        try {
            // TODO: Implement optimistic UI update for favorite status
            // For example, toggle the local isFavorited state.

            const newFavoriteStatus = await handleFavorite(user.uid, post.id);

            // TODO: After successful action, you might want to:
            // 1. Update the feed's state via a callback (e.g., onUpdatePost).
            // 2. If using a real-time listener in the feed, the update will come automatically.

             console.log(`Post ${post.id} favorite status: ${newFavoriteStatus}`);
             // TODO: Update local state or trigger feed update based on newFavoriteStatus

        } catch (err) {
            console.error("Favorite action failed:", err);
            // TODO: Revert optimistic UI updates on error
        }
    };

    // Format timestamp
    const formattedTimestamp = post.timestamp ? formatDistanceToNow(post.timestamp.toDate(), { addSuffix: true }) : 'Date unknown';

    // Determine button styles based on user's current vote (if using local state or prop)
    // const upvoteButtonClass = currentUserVote === 'up' ? 'text-green-600 font-bold' : 'text-gray-600 dark:text-gray-400';
    // const downvoteButtonClass = currentUserVote === 'down' ? 'text-red-600 font-bold' : 'text-gray-600 dark:text-gray-400';
    // const favoriteButtonClass = isFavorited ? 'text-blue-600 font-bold' : 'text-gray-600 dark:text-gray-400';
     const baseVoteButtonClass = "flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 dark:text-gray-400";
      const baseFavoriteButtonClass = "flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 dark:text-gray-400";

    return (
        <div ref={ref} className="border p-4 rounded shadow mb-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            <h3 className="text-xl font-bold mb-1">{post.title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">By {post.authorName} • {formattedTimestamp}</p>
            <p className="mt-2 text-gray-800 dark:text-gray-200">{post.body}</p>
            {post.imageUrls && post.imageUrls.length > 0 && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {post.imageUrls.map((url, index) => (
                        // Add proper alt text if possible based on image content
                        <img key={index} src={url} alt={`Post image ${index + 1}`} className="w-full h-40 object-cover rounded-md" />
                    ))}
                </div>
            )}
            <div className="mt-4 flex items-center space-x-6">
                 {/* Upvote Button */}
                <button
                    onClick={() => onVote('up')}
                    className={`${baseVoteButtonClass} ${post.userVote === 'up' ? 'text-green-600 font-bold' : ''}`}
                    disabled={!user} // Disable if not logged in
                >
                     {/* Replace with SVG icon for upvote */}
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M14.707 10.707a1 1 0 01-1.414 0L10 7.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                    <span>{post.upvotesCount}</span>
                </button>

                 {/* Downvote Button */}
                <button
                    onClick={() => onVote('down')}
                    className={`${baseVoteButtonClass} ${post.userVote === 'down' ? 'text-red-600 font-bold' : ''}`}
                    disabled={!user} // Disable if not logged in
                >
                     {/* Replace with SVG icon for downvote */}
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 9.293a1 1 0 011.414 0L10 12.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    <span>{post.downvotesCount}</span>
                </button>

                 {/* Favorite Button */}
                <button
                    onClick={onFavorite}
                    className={`${baseFavoriteButtonClass} ${post.isFavorite ? 'text-blue-600 font-bold' : ''}`}
                    disabled={!user} // Disable if not logged in
                >
                     {/* Replace with SVG icon for favorite (filled/unfilled based on isFavorite) */}
                     {post.isFavorite ? (
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.693h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.785.57-1.84-.197-1.54-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.462a1 1 0 00.95-.693l1.07-3.292z" />
                        </svg>
                     ) : (
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.693h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.539 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.539-1.118l1.518-4.674a1 1 0 00-.364-1.118L2.92 8.72c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.693l1.519-4.674z" />
                         </svg>
                     )}
                    <span>Favorite</span>
                </button>

                {/* TODO: Implement Share, Comment count, etc. */}
            </div>
        </div>
    );
});

PostCard.displayName = 'PostCard'; // Add display name for forwardRef
