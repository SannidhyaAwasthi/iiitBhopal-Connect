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
import type { Student, Post as PostType } from '@/types'; // Import types


// Define Post type based on prompt's schema (adjust if needed to match your types/index.ts)
// Ensure this matches the Post interface in PostCard.tsx if defined there
// Using imported PostType from types/index.ts
export type Post = PostType & {
    // Add userVote and isFavorite status for UI state (will be added after fetching)
    userVote?: 'up' | 'down' | null;
    isFavorite?: boolean;
};


// Props are no longer needed as user/student data is fetched internally
interface PostsFeedProps {
   // No props needed
}

type SortOption = 'recent' | 'popular' | 'hot';

const POSTS_PER_PAGE = 10;

// Now use the imported Student type directly
type StudentProfile = Student;

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
                 setIsLoading(true); // Set loading true when fetching profile starts
                try {
                    // 1. Get scholar number from UID mapping
                    const uidMapRef = doc(db, 'students-by-uid', user.uid);
                    const uidMapSnap = await getDoc(uidMapRef);

                    if (uidMapSnap.exists()) {
                        const scholarNumber = uidMapSnap.data()?.scholarNumber;
                        if (scholarNumber) {
                            // 2. Fetch full student data using scholar number
                            const studentDocRef = doc(db, 'students', scholarNumber);
                            const studentDocSnap = await getDoc(studentDocRef);

                            if (studentDocSnap.exists()) {
                                setStudentData(studentDocSnap.data() as StudentProfile);
                                // Reset posts when profile is loaded successfully
                                setPosts([]);
                                setLastVisible(null);
                                setHasMore(true);
                                setError(null);
                            } else {
                                throw new Error(`Student profile document not found for scholar number: ${scholarNumber}`);
                            }
                        } else {
                             throw new Error(`Scholar number missing in UID map for user: ${user.uid}`);
                        }
                    } else {
                        // Handle guest user specifically
                         if (user.email === 'guest@iiitbhopal.ac.in') {
                            setStudentData({
                                name: "Guest",
                                scholarNumber: "guest",
                                email: "guest@iiitbhopal.ac.in",
                                branch: 'Unknown',
                                yearOfPassing: 0,
                                programType: 'Undergraduate',
                                specialRoles: [],
                                phoneNumber: '',
                                uid: user.uid,
                                gender: 'Prefer not to say', // Provide default gender for guest
                            } as StudentProfile);
                            setPosts([]);
                            setLastVisible(null);
                            setHasMore(true);
                            setError(null);
                         } else {
                            throw new Error(`Student UID map document not found for user: ${user.uid}`);
                         }
                    }

                } catch (err: any) {
                    console.error("Error fetching student data:", err);
                    setError(err.message || "Failed to load student profile.");
                    setStudentData(null);
                    setPosts([]); // Clear posts on error
                    setHasMore(false); // No posts to load on error
                } finally {
                     // setIsLoading(false); // Loading stops when fetchPosts starts or in error case
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
        // Guest can see all posts (no filtering applied)
         if (!user || (!studentData && user.email !== 'guest@iiitbhopal.ac.in') || (!loadMore && isLoading) || (loadMore && isLoadingMore) || (loadMore && !hasMore)) {
             // If loading profile, don't fetch posts yet
             if (!studentData && !error && isLoading) return;
             // If profile fetch failed, don't fetch posts
             if (error) return;
             // If already loading posts, don't fetch again
             if ((!loadMore && isLoading) || (loadMore && isLoadingMore)) return;
             // If no more posts, don't fetch
             if (loadMore && !hasMore) return;
             // If not logged in or profile loading failed for non-guest
              if (!user || (!studentData && user.email !== 'guest@iiitbhopal.ac.in')) {
                  console.log("FetchPosts skipped: User/StudentData not available or error occurred.");
                  return;
              }
         }

         console.log(`Fetching posts (loadMore: ${loadMore}, sort: ${sortOption})`); // Log fetch action


        if (!loadMore) {
            setIsLoading(true); // This will cover the profile loading spinner as well
            // setPosts([]); // Reset posts is handled when studentData is set
            // setLastVisible(null);
            // setHasMore(true); // Assume there are more initially
            // setError(null); // Clear previous errors
        } else {
            setIsLoadingMore(true);
        }

        try {
            let q: Query<DocumentData> = collection(db, 'posts');

            // --- Visibility Filtering Strategy ---
            // Apply filtering only if the user is NOT a guest
            const isGuest = user?.email === 'guest@iiitbhopal.ac.in';

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
                ...(doc.data() as PostType), // Cast data to imported PostType type initially
            }));

             // Determine if there are more posts to load (check if we got limitWithCheck documents)
             const hasMoreResults = fetchedPosts.length === limitWithCheck;
             // Take only POSTS_PER_PAGE for processing and display
             const postsToProcess = hasMoreResults ? fetchedPosts.slice(0, POSTS_PER_PAGE) : fetchedPosts;

            // --- Client-Side Visibility Filtering (only for non-guests) ---
            let visiblePosts: PostType[];
            if (!isGuest && studentData) {
                visiblePosts = postsToProcess.filter(post => {
                    const isBranchVisible = post.visibility.branches.length === 0 || post.visibility.branches.includes(studentData.branch);
                    const isYearVisible = post.visibility.yearsOfPassing.length === 0 || post.visibility.yearsOfPassing.includes(studentData.yearOfPassing);
                    // Use optional chaining for gender as it might not be present
                    const isGenderVisible = post.visibility.genders.length === 0 || (studentData.gender && post.visibility.genders.includes(studentData.gender));

                    return isBranchVisible && isYearVisible && isGenderVisible;
                });
            } else {
                 // Guests see all fetched posts
                 visiblePosts = postsToProcess;
            }


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
             // Use querySnapshot.docs directly for reliable pagination marker
              const newLastVisible = hasMoreResults ? querySnapshot.docs[POSTS_PER_PAGE - 1] : (querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null);

             setLastVisible(newLastVisible);
             setHasMore(hasMoreResults); // Set hasMore based on whether we got the extra document

        } catch (err: any) {
            console.error("Error fetching posts:", err);
            setError(err.message || 'Failed to load posts.');
            setHasMore(false); // Stop loading more on error
             if (!loadMore) { // Clear posts only on initial load error
                  setPosts([]);
             }
        } finally {
            setIsLoading(false); // Ensure loading stops after fetch attempt
            setIsLoadingMore(false);
        }
    }, [user, studentData, sortOption, lastVisible, hasMore, isLoading, isLoadingMore, error]); // Added 'error' to dependencies


    // Initial fetch trigger: Call fetchPosts when studentData is loaded or sortOption changes
    useEffect(() => {
        // Trigger initial fetch only when user and studentData are present (or user is guest)
        // And only if not currently loading
        if (user && (studentData || user.email === 'guest@iiitbhopal.ac.in') && !isLoading) {
             // Reset and fetch on sort change or initial load
             setPosts([]);
             setLastVisible(null);
             setHasMore(true);
             setError(null);
             fetchPosts(false); // Trigger initial fetch
        }
         // This effect depends on studentData and sortOption to trigger refetch
    }, [user, studentData, sortOption, fetchPosts]); // Dependency on fetchPosts needed


    // --- Infinite Scroll Logic ---
    const lastPostElementRef = useCallback(node => {
        if (isLoading || isLoadingMore || !hasMore || !node) return;
        if (observer.current) observer.current.disconnect();

        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isLoading) {
                console.log("Intersection observer triggered load more"); // Debug log
                fetchPosts(true); // Load more posts
            }
        }, {
            rootMargin: '0px 0px 200px 0px',
            threshold: 0.1
        });

        if (node) observer.current.observe(node);

        return () => {
            if (observer.current) observer.current.disconnect();
        };
    }, [isLoading, isLoadingMore, hasMore, fetchPosts]); // Dependencies for the ref callback


    // Cleanup observer on component unmount
    useEffect(() => {
        return () => {
            if (observer.current) observer.current.disconnect();
        };
    }, []); // Empty dependency array means this effect runs only on mount and unmount


    if (!user) {
        return <div className="text-center py-10 text-gray-600 dark:text-gray-400">Please log in to see posts.</div>;
    }

    // Show loading spinner while fetching initial student data or first batch of posts
    if (isLoading && posts.length === 0) {
         return <div className="text-center py-10"><LoadingSpinner /> Loading profile and posts...</div>;
    }

    // Handle the case where student data wasn't found after user is logged in (and not guest)
    if (error && !studentData && user.email !== 'guest@iiitbhopal.ac.in') {
        return <p className="text-center py-10 text-red-500 dark:text-red-400">Error loading profile: {error}</p>;
    }


    return (
        <div className="posts-feed-container max-w-2xl mx-auto p-4">
            {/* Add Sort Dropdown/Buttons */}
            <div className="sort-options mb-4 flex justify-end items-center">
                <label htmlFor="sort-select" className="mr-2 text-gray-700 dark:text-gray-300 text-sm font-medium">Sort By:</label>
                <select
                    id="sort-select"
                    value={sortOption}
                    onChange={(e) => {
                        setSortOption(e.target.value as SortOption);
                        // Reset state for new sort fetch
                        setPosts([]);
                        setLastVisible(null);
                        setHasMore(true);
                        // Fetching will be triggered by the useEffect hook watching sortOption
                    }}
                    className="border border-gray-300 rounded-md shadow-sm p-1 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                >
                    <option value="recent">Most Recent</option>
                    <option value="popular">Most Popular</option>
                    <option value="hot">Hot</option>
                </select>
            </div>

            {/* {isLoading && !isLoadingMore && posts.length === 0 && <div className="text-center py-10"><LoadingSpinner /></div>} */}
             {error && <p className="text-center py-4 text-red-500 dark:text-red-400">Error fetching posts: {error}</p>}

            <div className="posts-list space-y-4">
                {posts.map((post, index) => {
                    // Attach ref to the last element for infinite scroll trigger
                    if (hasMore && index === posts.length - 1) {
                        return <PostCard ref={lastPostElementRef} key={post.id} post={post} />;
                    } else {
                        return <PostCard key={post.id} post={post} />;
                    }
                })}
            </div>

            {isLoadingMore && <div className="text-center py-5"><LoadingSpinner /> Loading more...</div>}
            {!isLoadingMore && !hasMore && posts.length > 0 && (
                <p className="text-center py-5 text-gray-500 dark:text-gray-400">-- End of Posts --</p>
            )}
             {!isLoading && !isLoadingMore && posts.length === 0 && !error && (
                 <p className="text-center py-10 text-gray-600 dark:text-gray-400">No posts found matching your criteria.</p>
             )}
        </div>
    );
};

export default PostsFeed;
