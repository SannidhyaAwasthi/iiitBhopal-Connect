import type { User } from 'firebase/auth';
import { FC, useState, useEffect, useCallback, useRef } from 'react';
import { db } from '@/config/firebase';
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    getDocs,
    Query,
    DocumentData,
    QueryDocumentSnapshot,
    Timestamp, // Import Timestamp
    doc, // Import doc
    getDoc // Import getDoc
} from 'firebase/firestore';
import { PostCard } from './PostCard'; // Assume you have a PostCard component
import LoadingSpinner from './loading-spinner'; // Corrected import for default export
import { useAuth } from '@/hooks/use-auth'; // Assuming useAuth hook
import { getPostsVoteStatus, getFavoritePostIds } from '@/lib/postActions'; // Import helper functions


// Define Post type based on prompt's schema (adjust if needed to match your types/index.ts)
// Ensure this matches the Post interface in PostCard.tsx if defined there
export interface Post {
    id: string; // Document ID
    authorId: string;
    authorName: string;
    title: string;
    body: string;
    imageUrls?: string[];
    timestamp: Timestamp; // Use Firestore Timestamp type
    upvotesCount: number;
    downvotesCount: number;
    hotScore?: number; // Optional based on usage
    tags: string[];
    visibility: {
        branches: string[];
        yearsOfPassing: number[];
        genders: string[];
    };
    // Add userVote and isFavorite status for UI state (will be added after fetching)
    userVote?: 'up' | 'down' | null;
    isFavorite?: boolean;
}

// Assume Student type from your prompt's description (adjust if needed to match your types/index.ts)
interface StudentProfile {
    branch: string;
    yearOfPassing: number;
    gender: string; // Assuming gender exists in the profile
    // Add other fields if needed
}


interface PostsFeedProps {
   // No props needed if fetching user/student data within the component
}

type SortOption = 'recent' | 'popular' | 'hot';

const POSTS_PER_PAGE = 10;

const PostsFeed: FC<PostsFeedProps> = () => {
    const { user } = useAuth(); // Get user from auth context/hook
    const [studentData, setStudentData] = useState<StudentProfile | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [sortOption, setSortOption] = useState<SortOption>('recent');
    const observer = useRef<IntersectionObserver | null>(null); // For infinite scroll


     // Fetch student data when user is available
     useEffect(() => {
        const fetchStudentData = async () => {
            if (user) {
                try {
                    const studentDocRef = doc(db, 'students-by-uid', user.uid);
                    const studentSnap = await getDoc(studentDocRef);
                    if (studentSnap.exists()) {
                        setStudentData(studentSnap.data() as StudentProfile);
                    } else {
                        // This case should ideally not happen for logged-in users with complete profiles,
                        // but handle defensively.
                        setError("Student profile not found. Cannot filter posts based on your profile.");
                        setStudentData(null);
                         setPosts([]); // Clear posts if profile is missing
                         setHasMore(false); // No posts to load without profile filtering
                    }
                } catch (err: any) {
                    console.error("Error fetching student data:", err);
                    setError(err.message || "Failed to load student profile.");
                    setStudentData(null);
                    setPosts([]); // Clear posts on error
                     setHasMore(false); // No posts to load on error
                }
            } else {
                // Clear state if user logs out
                setStudentData(null);
                 setPosts([]);
                 setLastVisible(null);
                 setHasMore(true); // Reset hasMore state
                 setError(null); // Clear any previous errors
                 setIsLoading(false);
                 setIsLoadingMore(false);
            }
        };
        fetchStudentData();
    }, [user]); // Re-run when user changes


    const fetchPosts = useCallback(async (loadMore = false) => {
        // Only fetch if user and studentData are available and we potentially have more posts
        // Also prevent duplicate fetches
        if (!user || !studentData || (!loadMore && isLoading) || (loadMore && isLoadingMore) || (loadMore && !hasMore && lastVisible !== null)) {
             return;
         }

        if (!loadMore) {
            setIsLoading(true);
            setPosts([]); // Reset posts on initial load or sort change
            setLastVisible(null);
            setHasMore(true); // Assume there are more initially
            setError(null); // Clear previous errors
        } else {
            setIsLoadingMore(true);
        }

        try {
            let q: Query<DocumentData> = collection(db, 'posts');

            // --- Visibility Filtering Strategy ---
            // Firestore limitations make complex OR logic across different fields difficult in a single query.
            // For the "empty array means all" combined with specific values, fetching and client-side filtering
            // is a common approach, though less efficient for very large datasets.

            // We will construct queries based on the user's branch, year, and gender, and the 'all' case
            // (empty arrays) and combine results. This is still complex with pagination.

            // A more practical approach for this schema and typical usage might be to:
            // 1. Query posts explicitly targeting the user's branch.
            // 2. Query posts explicitly targeting the user's year of passing.
            // 3. Query posts explicitly targeting the user's gender.
            // 4. Query posts with empty visibility arrays (visible to all).
            // Combine results, remove duplicates, and then apply sorting and pagination client-side.
            // This quickly becomes inefficient with large numbers of posts.

            // Alternative Strategy (Leveraging Indexes + Client Filter):
            // Fetch posts ordered by the chosen sort key, applying a *single* primary filter
            // that can use an index (e.g., filter by posts that *might* be visible based on branch or year),
            // and then perform the full visibility check client-side.

            // Let's try a strategy that queries for posts where the visibility array *contains* the user's branch
            // OR where the visibility array is empty. This still likely requires separate queries or a different index strategy.

            // A simplified approach for demonstration, focusing on the "empty array means all" case:
            // Query for posts where visibility.branches is empty OR visibility.yearsOfPassing is empty OR visibility.genders is empty
            // OR visibility.branches contains user's branch OR visibility.yearsOfPassing contains user's year OR visibility.genders contains user's gender.
            // This complex OR logic is not directly possible in Firestore.

            // Let's revert to fetching based on sort order and apply *all* visibility filters client-side.
            // This means we fetch the 'latest' or 'most popular' N posts and then filter those N posts
            // based on visibility. This is easier to implement but less scalable than server-side filtering.
            // **Consider a Cloud Function or different schema for production if performance is critical.**

             // Build base query with sorting
            if (sortOption === 'recent') {
                 q = query(q, orderBy('timestamp', 'desc'));
             } else if (sortOption === 'popular') {
                 // Assuming 'popular' means most upvotes - Requires index on upvotesCount
                 q = query(q, orderBy('upvotesCount', 'desc'), orderBy('timestamp', 'desc')); // Add timestamp as tie-breaker
             } else if (sortOption === 'hot') {
                 // Assuming you have a 'hotScore' field updated by a function/backend - Requires index on hotScore
                 q = query(q, orderBy('hotScore', 'desc'), orderBy('timestamp', 'desc')); // Add timestamp as tie-breaker
             }


             // Add pagination *before* fetching
             // Fetch one extra document to determine if there are more posts available
             const limitWithCheck = POSTS_PER_PAGE + 1;
             q = query(q, limit(limitWithCheck));

            if (loadMore && lastVisible) {
                q = query(q, startAfter(lastVisible));
            }


            const querySnapshot = await getDocs(q);
            const fetchedPosts = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...(doc.data() as Post), // Cast data to Post type
            }));

             // Determine if there are more posts to load (check if we got limitWithCheck documents)
             const hasMoreResults = fetchedPosts.length === limitWithCheck;
             // Take only POSTS_PER_PAGE for processing and display
             const postsToProcess = hasMoreResults ? fetchedPosts.slice(0, POSTS_PER_PAGE) : fetchedPosts;

            // --- Client-Side Visibility Filtering ---
            // Filter the fetched posts based on the user's profile and post visibility settings.
            const visiblePosts = postsToProcess.filter(post => {
                const isBranchVisible = post.visibility.branches.length === 0 || post.visibility.branches.includes(studentData.branch);
                const isYearVisible = post.visibility.yearsOfPassing.length === 0 || post.visibility.yearsOfPassing.includes(studentData.yearOfPassing);
                const isGenderVisible = post.visibility.genders.length === 0 || post.visibility.genders.includes(studentData.gender);

                return isBranchVisible && isYearVisible && isGenderVisible;
            });


             // --- Fetch User's Vote and Favorite Status ---
             // Get the IDs of the visible posts to fetch their status for the current user.
             const visiblePostIds = visiblePosts.map(post => post.id);
             let voteStatuses: Record<string, 'up' | 'down' | null> = {};
             let favoritePostIds: string[] = [];

             if (user && visiblePostIds.length > 0) {
                 // Fetch vote statuses for the visible posts
                 voteStatuses = await getPostsVoteStatus(user.uid, visiblePostIds);
                 // Fetch favorite post IDs for the user
                 favoritePostIds = await getFavoritePostIds(user.uid);
             }

             // Add user's vote and favorite status to the visible post objects for UI state
             const postsWithStatus: Post[] = visiblePosts.map(post => ({
                 ...post,
                 userVote: voteStatuses[post.id] || null, // Null if no vote found
                 isFavorite: favoritePostIds.includes(post.id),
             }));


             // Update state with the processed posts and pagination info
             setPosts(prevPosts => loadMore ? [...prevPosts, ...postsWithStatus] : postsWithStatus);
             // The last visible document for the next fetch is the last document from the *original* fetched batch (before client-side filtering)
             // if we fetched an extra one. If we didn't fetch an extra or no documents were returned, set to null.
             setLastVisible(querySnapshot.docs.length > 0 && hasMoreResults ? querySnapshot.docs[POSTS_PER_PAGE] : null);
             setHasMore(hasMoreResults); // Set hasMore based on whether we got the extra document

        } catch (err: any) {
            console.error("Error fetching posts:", err);
            setError(err.message || 'Failed to load posts.');
             setHasMore(false); // Stop loading more on error
             if (!loadMore) { // Clear posts only on initial load error
                  setPosts([]);
             }
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    }, [user, studentData, sortOption, lastVisible, hasMore, isLoading, isLoadingMore]); // Added dependencies


    // Initial fetch when user and studentData are available
    useEffect(() => {
        // Trigger initial fetch only when user and studentData are present
        if (user && studentData) {
            fetchPosts(false);
        }
        // The effect also handles clearing state when user logs out, as handled in the user effect above.
         // Include fetchPosts in the dependency array now that it's memoized with useCallback
    }, [user, studentData, sortOption, fetchPosts]); // Re-run when user, student data, sort changes, or fetchPosts changes (due to useCallback dependencies)


    // --- Infinite Scroll Logic ---
    // Set up the IntersectionObserver to trigger fetching more posts
    const lastPostElementRef = useCallback(node => {
        // Don't set up observer if we are loading, don't have more data, or no node is provided
        if (isLoading || isLoadingMore || !hasMore || !node) return;

        // Disconnect previous observer if it exists
        if (observer.current) observer.current.disconnect();

        // Create a new observer
        observer.current = new IntersectionObserver(entries => {
            // If the last post element is intersecting and we have more posts to load
            if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isLoading) {
                fetchPosts(true); // Load more posts
            }
        }, {
            // Options for the observer
            rootMargin: '0px 0px 200px 0px', // Trigger when 200px from the bottom of the viewport
            threshold: 0.1 // Trigger when 10% of the element is visible
        });

        // Start observing the last post element
        if (node) observer.current.observe(node);

        // Cleanup function for the observer: disconnect when the component unmounts or the ref changes
        return () => {
            if (observer.current) {
                observer.current.disconnect();
            }
        };
    }, [isLoading, isLoadingMore, hasMore, fetchPosts]); // Dependencies for the ref callback


    // Cleanup observer on component unmount
    useEffect(() => {
        return () => {
            if (observer.current) {
                observer.current.disconnect();
            }
        };
    }, []); // Empty dependency array means this effect runs only on mount and unmount


    if (!user) {
        return <div className="text-center py-10 text-gray-600 dark:text-gray-400">Please log in to see posts.</div>;
    }

    // Show loading spinner while fetching initial student data or posts
    if ((!studentData && !error && !isLoading) || (user && !studentData && isLoading)) {
         return <div className="text-center py-10"><LoadingSpinner /> Loading profile and posts...</div>;
    }

    // Handle the case where student data wasn't found after user is logged in
    if (error && !studentData && user) {
        return <p className="text-center py-10 text-red-500 dark:text-red-400">Error: {error}</p>;
    }


    return (
        <div className="posts-feed-container max-w-2xl mx-auto p-4">
            {/* Add Sort Dropdown/Buttons */}
            <div className="sort-options mb-4 flex justify-end items-center">
                <label htmlFor="sort-select" className="mr-2 text-gray-700 dark:text-gray-300 text-sm font-medium">Sort By:</label>
                <select
                    id="sort-select"
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value as SortOption)}
                    className="border border-gray-300 rounded-md shadow-sm p-1 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                >
                    <option value="recent">Most Recent</option>
                    <option value="popular">Most Popular</option>
                    <option value="hot">Hot</option>
                </select>
            </div>

            {isLoading && !isLoadingMore && <div className="text-center py-10"><LoadingSpinner /></div>}
            {error && <p className="text-center py-10 text-red-500 dark:text-red-400">Error: {error}</p>}

            <div className="posts-list space-y-4">
                {posts.map((post, index) => {
                    // Attach ref to the last element for infinite scroll trigger
                    if (posts.length === index + 1) {
                        return <PostCard ref={lastPostElementRef} key={post.id} post={post} />;
                    } else {
                        return <PostCard key={post.id} post={post} />;
                    }
                })}
            </div>

            {isLoadingMore && <div className="text-center py-5"><LoadingSpinner /> Loading more...</div>}
            {!isLoadingMore && !hasMore && posts.length > 0 && (
                <p className="text-center py-5 text-gray-500 dark:text-gray-400">No more posts.</p>
            )}
             {!isLoading && !isLoadingMore && posts.length === 0 && !error && ( // Show message if no posts loaded and no error
                 <p className="text-center py-10 text-gray-600 dark:text-gray-400">No posts found matching your criteria.</p>
             )}
        </div>
    );
};

export default PostsFeed;
