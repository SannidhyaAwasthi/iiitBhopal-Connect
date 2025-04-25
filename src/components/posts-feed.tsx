import React, { FC, useState, useEffect, useCallback, useRef } from 'react';
import type { User } from 'firebase/auth';
import { db } from '@/config/firebase';
import {
    collection,
    query,
    orderBy,
    limit,
    startAfter,
    getDocs,
    Query,
    DocumentData,
    QueryDocumentSnapshot,
    Timestamp,
    doc,
    getDoc,
    where // Ensure where is imported
} from 'firebase/firestore';
import { PostCard } from './PostCard';
import LoadingSpinner from './loading-spinner';
import { Button } from '@/components/ui/button'; // Import Button
import { PlusCircle, User as UserIcon, Star } from 'lucide-react'; // Icons for buttons, added Star
import { useAuth } from '@/hooks/use-auth';
import { getPostsVoteStatus, getFavoritePostIds } from '@/lib/postActions';
import type { StudentProfile } from '@/types'; // Import StudentProfile type

// Define Post type (ensure this matches elsewhere)
export interface Post {
    id: string;
    authorId: string;
    authorName: string;
    title: string;
    body: string;
    imageUrls?: string[];
    timestamp: Timestamp;
    upvotesCount: number;
    downvotesCount: number;
    hotScore?: number;
    tags: string[];
    visibility: {
        branches: string[];
        yearsOfPassing: number[];
        genders: string[];
    };
    userVote?: 'up' | 'down' | null;
    isFavorite?: boolean;
}

interface PostsFeedProps {
    setActiveSection: (section: string) => void;
    isGuest: boolean;
    studentData: StudentProfile | null; // Pass studentData down
}

// Remove 'hot' from SortOption type
type SortOption = 'recent' | 'popular';

const POSTS_PER_PAGE = 10;

const PostsFeed: FC<PostsFeedProps> = ({ setActiveSection, isGuest, studentData: initialStudentData }) => {
    const { user } = useAuth();
    const [isLoadingUser, setIsLoadingUser] = useState(!user); // Initialize based on initial user state

    // Use the studentData passed from Dashboard, no need to fetch it again here
    const studentData = initialStudentData;
    const isLoadingProfile = !initialStudentData && !!user && !isGuest; // Profile is loading if we have a user (not guest) but no data yet

    const [posts, setPosts] = useState<Post[]>([]);
    const [isLoadingPosts, setIsLoadingPosts] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [sortOption, setSortOption] = useState<SortOption>('recent'); // Default sort
    const observer = useRef<IntersectionObserver | null>(null);
    const isFetchingRef = useRef(false);
    const initialLoadDoneRef = useRef(false); // Ref to track if the initial load effect has run

    // Update isLoadingUser when user status changes
    useEffect(() => {
      setIsLoadingUser(!user);
    }, [user]);

    // Fetch Posts Logic (largely unchanged, but relies on passed studentData)
    const fetchPosts = useCallback(async (loadMore = false) => {
        if (isFetchingRef.current || (loadMore && !hasMore)) {
            console.log("[PostsFeed] Fetch skipped: Already fetching or no more posts.");
            return;
         }
       isFetchingRef.current = true;

       // Check if profile data is required and available
       if (!isGuest && !studentData && user) {
           console.log("[PostsFeed] Fetch skipped: Profile data needed but not available.");
           // Don't set error here, Dashboard handles profile loading state/errors
           // setError("Profile data needed to fetch posts.");
           setIsLoadingPosts(false);
           setIsLoadingMore(false);
           isFetchingRef.current = false;
           setHasMore(false); // No data to fetch if profile is missing
           return;
       }

       console.log(`[PostsFeed] fetchPosts called. User: ${user?.uid ? user.uid : 'None'}, isGuest: ${isGuest}, studentData: ${!!studentData}`);


        const currentLastVisible = loadMore ? lastVisible : null;
        const shouldSetInitialLoading = !loadMore;

        if (shouldSetInitialLoading) setIsLoadingPosts(true);
        else setIsLoadingMore(true);
        if (!loadMore) setError(null);

        try {
            let q: Query<DocumentData> = collection(db, 'posts');

             // Basic query setup
             if (sortOption === 'recent') {
                 q = query(q, orderBy('timestamp', 'desc'));
             } else if (sortOption === 'popular') {
                 // Assuming 'upvotesCount' exists. Add secondary sort for stable order.
                 q = query(q, orderBy('upvotesCount', 'desc'), orderBy('timestamp', 'desc'));
             }

             // Apply visibility filters server-side if possible and if profile exists
             // Using the simplified rule for now (read: if request.auth != null), so no server-side filtering needed here.
             // If rules become more complex, revisit this.

            const limitWithCheck = POSTS_PER_PAGE + 1;
            q = query(q, limit(limitWithCheck));

            if (loadMore && currentLastVisible) {
                q = query(q, startAfter(currentLastVisible));
            }

            console.log(`[PostsFeed] Executing Firestore query (loadMore: ${loadMore})`);
            const querySnapshot = await getDocs(q);
            console.log(`[PostsFeed] Fetched ${querySnapshot.docs.length} documents.`);

            const fetchedPosts = querySnapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...(docSnap.data() as Omit<Post, 'id' | 'userVote' | 'isFavorite'>),
            }));

            const hasMoreResults = fetchedPosts.length === limitWithCheck;
            const postsToProcess = hasMoreResults ? fetchedPosts.slice(0, POSTS_PER_PAGE) : fetchedPosts;
            const newLastVisible = hasMoreResults ? querySnapshot.docs[querySnapshot.docs.length - 2] : querySnapshot.docs[querySnapshot.docs.length - 1] ?? null;

            // --- Client-Side Visibility Filtering (Still useful even with simpler read rules if visibility logic is complex) ---
            const profile = studentData;
            const visiblePosts = postsToProcess.filter(post => {
                // Guests see all posts based on the simplified read rule
                if (isGuest) return true;
                // If profile data is missing for a logged-in user, they see nothing (handled above)
                if (!profile) return false;

                // Visibility check (can be complex, but let's assume it's needed)
                const isBranchVisible = post.visibility?.branches?.length === 0 || post.visibility?.branches?.includes(profile.branch);
                const isYearVisible = post.visibility?.yearsOfPassing?.length === 0 || post.visibility?.yearsOfPassing?.includes(profile.yearOfPassing);
                const isGenderVisible = post.visibility?.genders?.length === 0 || post.visibility?.genders?.includes(profile.gender);

                console.log(`[PostsFeed] Post ID: ${post.id}, Visible: ${isBranchVisible && isYearVisible && isGenderVisible}`);
                return isBranchVisible && isYearVisible && isGenderVisible;
            });
            console.log(`[PostsFeed] ${visiblePosts.length} posts remaining after client-side filtering.`);


             // Fetch Vote/Favorite Status for visible posts
             const visiblePostIds = visiblePosts.map(post => post.id);
             let voteStatuses: Record<string, 'up' | 'down' | null> = {};
             let favoritePostIds: string[] = [];

             console.log(`[PostsFeed] User ${user?.uid ? 'logged in' : 'not logged in'}. Attempting to fetch vote/favorite status for ${visiblePostIds.length} posts.`);
             if (user && visiblePostIds.length > 0) {
                 try {
                     console.log("[PostsFeed] Calling getPostsVoteStatus and getFavoritePostIds for user:", user.uid, "and post IDs:", visiblePostIds);
                     [voteStatuses, favoritePostIds] = await Promise.all([
                         getPostsVoteStatus(user.uid, visiblePostIds),
                         getFavoritePostIds(user.uid)
                     ]);
                     console.log("[PostsFeed] Received voteStatuses:", voteStatuses);
                     console.log("[PostsFeed] Received favoritePostIds:", favoritePostIds);

                 } catch (statusError) {
                     console.error("Error fetching vote/favorite status:", statusError);
                     // Continue without status
                 }
             }

            const postsWithStatus: Post[] = visiblePosts.map(post => ({
                ...post,
                userVote: voteStatuses[post.id] || null,
                isFavorite: favoritePostIds.includes(post.id),
            }));

            console.log("[PostsFeed] Posts with user status:", postsWithStatus);


            setPosts(prevPosts => loadMore ? [...prevPosts, ...postsWithStatus] : postsWithStatus);
            setLastVisible(newLastVisible);
            setHasMore(hasMoreResults && visiblePosts.length > 0); // Also check if filtering left any posts


        } catch (err: any) {
            console.error("[PostsFeed] Error fetching posts:", err);
            setError(err.message || 'Failed to load posts.');
             if (!loadMore) setPosts([]);
            setHasMore(false);
        } finally {
            if (shouldSetInitialLoading) setIsLoadingPosts(false);
            setIsLoadingMore(false);
            isFetchingRef.current = false;
            console.log("[PostsFeed] Fetch finished.");
        }
    }, [user, isGuest, studentData, sortOption, hasMore, lastVisible]); // Dependencies adjusted


    // Effect to trigger first fetch or refetch on sort/user/profile change
    useEffect(() => {
        // Fetch only when user/profile status is settled and initial load hasn't run for current state
        const profileIsReady = isGuest || (user && studentData);
        const authIsReady = !isLoadingUser;

        if (authIsReady && profileIsReady && !initialLoadDoneRef.current) {
            console.log("[PostsFeed Effect] Conditions met, triggering initial fetch.");
            setPosts([]);
            setLastVisible(null);
            setHasMore(true);
            setError(null);
            fetchPosts(false); // Initial fetch
            initialLoadDoneRef.current = true; // Mark initial load as done for this state
        } else {
             console.log(`[PostsFeed Effect] Skipping fetch. AuthReady: ${authIsReady}, ProfileReady: ${profileIsReady}, InitialLoadDone: ${initialLoadDoneRef.current}`);
        }

    // Depend on user, studentData, sortOption, isGuest, isLoadingUser
    }, [user, studentData, sortOption, isGuest, isLoadingUser, fetchPosts]); // Added fetchPosts back

     // Reset initialLoadDoneRef when dependencies that trigger a full refetch change
     useEffect(() => {
       initialLoadDoneRef.current = false;
     }, [user, studentData, sortOption, isGuest]);


    // Infinite Scroll Logic
    const lastPostElementRef = useCallback((node: HTMLElement | null) => {
        if (isLoadingPosts || isLoadingMore || !hasMore || isFetchingRef.current) return;
        if (observer.current) observer.current.disconnect();

        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting) {
                console.log("[PostsFeed] Intersection observer triggered load more.");
                fetchPosts(true); // Load more posts
            }
        }, { rootMargin: '200px', threshold: 0 });

        if (node) observer.current.observe(node);
    }, [isLoadingPosts, isLoadingMore, hasMore, fetchPosts]); // Added fetchPosts

    // Cleanup observer
    useEffect(() => {
        const currentObserver = observer.current;
        return () => {
            if (currentObserver) {
                currentObserver.disconnect();
            }
        };
    }, []);


    // --- Render Logic ---
    if (isLoadingUser) {
        return <div className="text-center py-10"><LoadingSpinner /> Loading user...</div>;
    }
    // Removed !user check here, Dashboard handles redirecting logged-out users

    // If profile is still loading for a non-guest user
     if (!isGuest && user && isLoadingProfile) {
        return <div className="text-center py-10"><LoadingSpinner /> Loading profile...</div>;
    }
    // If profile loading failed for a non-guest user
     if (!isGuest && user && !studentData && !isLoadingProfile) {
         return <p className="text-center py-10 text-red-500 dark:text-red-400">Error loading profile data. Cannot display posts.</p>;
     }


    return (
        <div className="posts-feed-container max-w-3xl mx-auto p-4 space-y-6">
             {/* Action Buttons */}
            <div className="flex justify-between items-center mb-4 gap-4">
                <div className="flex gap-2 flex-wrap"> {/* Added flex-wrap for smaller screens */}
                     <Button
                         onClick={() => setActiveSection('create-post')}
                         disabled={isGuest || isLoadingProfile} // Disable if guest or profile is loading
                         variant="default"
                         size="sm"
                     >
                         <PlusCircle className="mr-2 h-4 w-4" />
                         Create Post
                     </Button>
                     <Button
                         onClick={() => setActiveSection('your-posts')}
                         disabled={isGuest || isLoadingProfile} // Disable if guest or profile is loading
                         variant="outline"
                         size="sm"
                     >
                          <UserIcon className="mr-2 h-4 w-4" />
                          Your Posts
                      </Button>
                      <Button
                         onClick={() => setActiveSection('your-favorites')} // Navigate to favorites section
                         disabled={isGuest || isLoadingProfile} // Disable if guest or profile is loading
                         variant="outline"
                         size="sm"
                     >
                          <Star className="mr-2 h-4 w-4" /> {/* Favorite Icon */}
                          Favorites
                      </Button>
                 </div>

                 {/* Sort Options */}
                 <div className="flex items-center ml-auto"> {/* Ensure sort is pushed right */}
                    <label htmlFor="sort-select" className="mr-2 text-gray-700 dark:text-gray-300 text-sm font-medium hidden sm:inline">Sort By:</label> {/* Hide label on small screens */}
                    <select
                        id="sort-select"
                        value={sortOption}
                        onChange={(e) => {
                            setSortOption(e.target.value as SortOption);
                            initialLoadDoneRef.current = false; // Trigger refetch on sort change
                        }}
                        className="border border-input bg-background rounded-md shadow-sm p-1.5 text-sm focus:ring-ring focus:ring-offset-2 focus:outline-none focus:ring-2 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                        disabled={isLoadingPosts || isLoadingMore}
                    >
                        <option value="recent">Most Recent</option>
                        <option value="popular">Most Popular</option>
                    </select>
                 </div>
            </div>


            {isLoadingPosts && posts.length === 0 && <div className="text-center py-10"><LoadingSpinner /> Loading posts...</div>}

            {/* Display error message if posts fetch failed */}
             {error && posts.length === 0 && <p className="text-center py-10 text-red-500 dark:text-red-400">Error loading posts: {error}</p>}

            <div className="posts-list space-y-4">
                {posts.map((post, index) => {
                    const isLastElement = index === posts.length - 1;
                    return (
                        <PostCard
                            ref={isLastElement ? lastPostElementRef : null}
                            key={post.id}
                            post={post}
                        />
                    );
                })}
            </div>

            {isLoadingMore && <div className="text-center py-5"><LoadingSpinner /> Loading more...</div>}
            {!isLoadingPosts && !hasMore && posts.length > 0 && <p className="text-center py-5 text-muted-foreground">You've reached the end!</p>}
            {!isLoadingPosts && !isLoadingMore && posts.length === 0 && !error && <p className="text-center py-10 text-muted-foreground">No posts found. Be the first to create one!</p>}
        </div>
    );
};

export default PostsFeed;
