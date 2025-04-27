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
import { PostCard } from './PostCard'; // Import PostCard directly
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
    timestamp: Timestamp; // Firestore Timestamp for creation
    lastEdited?: Timestamp; // Firestore Timestamp for last edit
    upvotesCount: number;
    downvotesCount: number;
    hotScore: number; // Calculated score for sorting
    tags: string[]; // Search tags (e.g., author details, keywords)
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
    studentData: StudentProfile | null; // Pass studentData down
}

// Remove 'hot' from SortOption type
type SortOption = 'recent' | 'popular';

const POSTS_PER_PAGE = 10;

const PostsFeed: FC<PostsFeedProps> = ({ setActiveSection, studentData: initialStudentData }) => {
    const { user } = useAuth();
    const [isLoadingUser, setIsLoadingUser] = useState(!user); // Initialize based on initial user state

    // Use the studentData passed from Dashboard, no need to fetch it again here
    const studentData = initialStudentData;
    // Profile is loading if we have a user but no data yet
    const isLoadingProfile = !initialStudentData && !!user;

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

    // Fetch Posts Logic
    const fetchPosts = useCallback(async (loadMore = false) => {
        if (isFetchingRef.current || (loadMore && !hasMore)) {
            console.log("[PostsFeed] Fetch skipped: Already fetching or no more posts.");
            return;
         }
       isFetchingRef.current = true;

       // Check if profile data is required and available for a logged-in user
       if (user && !studentData) {
           console.log("[PostsFeed] Fetch skipped: Profile data needed but not available.");
           setIsLoadingPosts(false);
           setIsLoadingMore(false);
           isFetchingRef.current = false;
           setHasMore(false); // No data to fetch if profile is missing
           return;
       }
        // If user is not logged in, proceed, as reads might be allowed by rules
        console.log(`[PostsFeed] fetchPosts called. User: ${user?.uid ? user.uid : 'None'}, studentData: ${!!studentData}`);

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
                 q = query(q, orderBy('upvotesCount', 'desc'), orderBy('timestamp', 'desc'));
             }

             // Apply server-side rules (simple read allowed for authenticated users)

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

            // --- Client-Side Visibility Filtering (if needed, based on complex rules or preference) ---
            const profile = studentData;
            const visiblePosts = profile ? postsToProcess.filter(post => {
                 // Apply visibility filters only if profile exists
                 const isBranchVisible = post.visibility?.branches?.length === 0 || post.visibility?.branches?.includes(profile.branch);
                 const isYearVisible = post.visibility?.yearsOfPassing?.length === 0 || post.visibility?.yearsOfPassing?.includes(profile.yearOfPassing);
                 const isGenderVisible = post.visibility?.genders?.length === 0 || post.visibility?.genders?.includes(profile.gender);

                 // console.log(`[PostsFeed Filter] Post ID: ${post.id}, Visible: ${isBranchVisible && isYearVisible && isGenderVisible}`);
                 return isBranchVisible && isYearVisible && isGenderVisible;
             }) : postsToProcess; // If no profile (e.g., logged out, but read allowed), show all fetched
            // console.log(`[PostsFeed] ${visiblePosts.length} posts remaining after client-side filtering.`);


             // Fetch Vote/Favorite Status for visible posts for logged-in user
             const visiblePostIds = visiblePosts.map(post => post.id);
             let voteStatuses: Record<string, 'up' | 'down' | null> = {};
             let favoritePostIds: string[] = [];

             // console.log(`[PostsFeed] User ${user?.uid ? 'logged in' : 'not logged in'}. Attempting to fetch vote/favorite status for ${visiblePostIds.length} posts.`);
             if (user && visiblePostIds.length > 0) {
                 try {
                     // console.log("[PostsFeed] Calling getPostsVoteStatus and getFavoritePostIds for user:", user.uid, "and post IDs:", visiblePostIds);
                     [voteStatuses, favoritePostIds] = await Promise.all([
                         getPostsVoteStatus(user.uid, visiblePostIds),
                         getFavoritePostIds(user.uid)
                     ]);
                     // console.log("[PostsFeed] Received voteStatuses:", voteStatuses);
                     // console.log("[PostsFeed] Received favoritePostIds:", favoritePostIds);

                 } catch (statusError) {
                     console.error("Error fetching vote/favorite status:", statusError);
                 }
             }

            const postsWithStatus: Post[] = visiblePosts.map(post => ({
                ...post,
                userVote: user ? (voteStatuses[post.id] || null) : null, // Only set if user logged in
                isFavorite: user ? favoritePostIds.includes(post.id) : false, // Only set if user logged in
            }));

            // console.log("[PostsFeed] Posts with user status:", postsWithStatus);


            setPosts(prevPosts => loadMore ? [...prevPosts, ...postsWithStatus] : postsWithStatus);
            setLastVisible(newLastVisible);
            setHasMore(hasMoreResults && visiblePosts.length > 0); // Check if filtering left any posts


        } catch (err: any) {
            console.error("[PostsFeed] Error fetching posts:", err);
             // Handle specific Firebase permission errors
             if (err.code === 'permission-denied' || err.message?.includes('permissions')) {
                 setError("You don't have permission to view these posts.");
             } else {
                 setError(err.message || 'Failed to load posts.');
             }
             if (!loadMore) setPosts([]);
            setHasMore(false);
        } finally {
            if (shouldSetInitialLoading) setIsLoadingPosts(false);
            setIsLoadingMore(false);
            isFetchingRef.current = false;
            // console.log("[PostsFeed] Fetch finished.");
        }
    }, [user, studentData, sortOption, hasMore, lastVisible]); // Dependencies updated


    // Effect to trigger first fetch or refetch on sort/user/profile change
    useEffect(() => {
        // Fetch only when user/profile status is settled and initial load hasn't run
        const profileIsReady = !user || (user && studentData); // Profile is ready if user is logged out, or if logged in and data exists
        const authIsReady = !isLoadingUser;

        if (authIsReady && profileIsReady && !initialLoadDoneRef.current) {
            // console.log("[PostsFeed Effect] Conditions met, triggering initial fetch.");
            setPosts([]);
            setLastVisible(null);
            setHasMore(true);
            setError(null);
            fetchPosts(false); // Initial fetch
            initialLoadDoneRef.current = true; // Mark initial load as done
        } else {
             // console.log(`[PostsFeed Effect] Skipping fetch. AuthReady: ${authIsReady}, ProfileReady: ${profileIsReady}, InitialLoadDone: ${initialLoadDoneRef.current}`);
        }

    // Depend on user, studentData, sortOption, isLoadingUser
    }, [user, studentData, sortOption, isLoadingUser, fetchPosts]);

     // Reset initialLoadDoneRef when dependencies that trigger a full refetch change
     useEffect(() => {
       initialLoadDoneRef.current = false;
     }, [user, studentData, sortOption]);


    // Infinite Scroll Logic
    const lastPostElementRef = useCallback((node: HTMLElement | null) => {
        if (isLoadingPosts || isLoadingMore || !hasMore || isFetchingRef.current) return;
        if (observer.current) observer.current.disconnect();

        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting) {
                // console.log("[PostsFeed] Intersection observer triggered load more.");
                fetchPosts(true); // Load more posts
            }
        }, { rootMargin: '200px', threshold: 0 });

        if (node) observer.current.observe(node);
    }, [isLoadingPosts, isLoadingMore, hasMore, fetchPosts]);

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

    // If profile is still loading for a logged-in user
     if (user && isLoadingProfile) {
        return <div className="text-center py-10"><LoadingSpinner /> Loading profile...</div>;
    }
    // If profile loading failed for a logged-in user (and profile is required for any posts)
     if (user && !studentData && !isLoadingProfile && error?.includes("permission")) {
        // Handle case where profile fetch fails due to permissions or other issues,
        // and profile data *is* required to view posts.
         return <p className="text-center py-10 text-red-500 dark:text-red-400">Error loading profile data. Cannot display notices.</p>;
     }


    return (
        <div className="posts-feed-container max-w-3xl mx-auto p-4 space-y-6">
             {/* Action Buttons - Show only if user is logged in */}
             {user && (
                 <div className="flex justify-between items-center mb-4 gap-4">
                     <div className="flex gap-2 flex-wrap">
                          <Button
                              onClick={() => setActiveSection('create-post')}
                              disabled={isLoadingProfile || !studentData} // Disable if profile is loading or unavailable
                              variant="default"
                              size="sm"
                          >
                              <PlusCircle className="mr-2 h-4 w-4" />
                              Create Notice
                          </Button>
                          <Button
                              onClick={() => setActiveSection('my-posts')}
                              disabled={isLoadingProfile || !studentData}
                              variant="outline"
                              size="sm"
                          >
                               <UserIcon className="mr-2 h-4 w-4" />
                               My Notices
                           </Button>
                           <Button
                              onClick={() => setActiveSection('my-favorites')}
                              disabled={isLoadingProfile || !studentData}
                              variant="outline"
                              size="sm"
                          >
                               <Star className="mr-2 h-4 w-4" />
                               Pinned
                           </Button>
                      </div>

                     {/* Sort Options */}
                     <div className="flex items-center ml-auto">
                        <label htmlFor="sort-select" className="mr-2 text-gray-700 dark:text-gray-300 text-sm font-medium hidden sm:inline">Sort By:</label>
                        <select
                            id="sort-select"
                            value={sortOption}
                            onChange={(e) => {
                                setSortOption(e.target.value as SortOption);
                                initialLoadDoneRef.current = false; // Trigger refetch
                            }}
                            className="border border-input bg-background rounded-md shadow-sm p-1.5 text-sm focus:ring-ring focus:ring-offset-2 focus:outline-none focus:ring-2 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                            disabled={isLoadingPosts || isLoadingMore}
                        >
                            <option value="recent">Most Recent</option>
                            <option value="popular">Most Popular</option>
                        </select>
                     </div>
                 </div>
             )}

            {/* Show loading spinner only when actively loading initial posts */}
            {isLoadingPosts && posts.length === 0 && <div className="text-center py-10"><LoadingSpinner /> Loading notices...</div>}

             {/* Display error message if posts fetch failed */}
             {error && posts.length === 0 && <p className="text-center py-10 text-red-500 dark:text-red-400">Error loading notices: {error}</p>}

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
            {/* Adjust empty state message based on whether user is logged in */}
            {!isLoadingPosts && !isLoadingMore && posts.length === 0 && !error && (
                <p className="text-center py-10 text-muted-foreground">
                    {user ? "No notices found matching your criteria. Be the first to create one!" : "No notices found. Log in to see more."}
                </p>
            )}
        </div>
    );
};

export default PostsFeed;
