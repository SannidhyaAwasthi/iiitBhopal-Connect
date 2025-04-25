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
    where
} from 'firebase/firestore';
import { PostCard } from './PostCard';
import LoadingSpinner from './loading-spinner';
import { useAuth } from '@/hooks/use-auth';
import { getPostsVoteStatus, getFavoritePostIds } from '@/lib/postActions';
import type { StudentProfile } from '@/types'; // Import StudentProfile
import { Button } from '@/components/ui/button'; // Import Button
import { PlusCircle, User } from 'lucide-react'; // Import Icons

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

// Moved StudentProfile type definition to types/index.ts
// interface StudentProfile {
//     branch: string;
//     yearOfPassing: number;
//     gender: string;
//     scholarNumber: string;
// }

// Update props interface for PostsFeed
interface PostsFeedProps {
    setActiveSection: (section: string) => void; // To navigate to create/your posts
    isGuest: boolean; // To disable buttons for guests
    studentData: StudentProfile | null; // Student profile data
}

type SortOption = 'recent' | 'popular' | 'hot';

const POSTS_PER_PAGE = 10;

const PostsFeed: FC<PostsFeedProps> = ({ setActiveSection, isGuest, studentData }) => {
    const { user } = useAuth();
    // Removed isLoadingUser and isLoadingProfile as they are handled in dashboard.tsx
    // const [isLoadingUser, setIsLoadingUser] = useState(true);
    // const [studentData, setStudentData] = useState<StudentProfile | null>(null);
    // const [isLoadingProfile, setIsLoadingProfile] = useState(true);
    const [posts, setPosts] = useState<Post[]>([]);
    const [isLoadingPosts, setIsLoadingPosts] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [sortOption, setSortOption] = useState<SortOption>('recent');
    const observer = useRef<IntersectionObserver | null>(null);
    const isFetchingRef = useRef(false); // Ref to track if a fetch is already in progress
    const initialLoadDoneRef = useRef(false); // Ref to track if the initial load effect has run

    // Removed useEffect for user loading and profile fetching - now handled by dashboard

    // Define fetchPosts using useCallback
    const fetchPosts = useCallback(async (loadMore = false) => {
        // Prevent fetch if already fetching or no more posts
         if (isFetchingRef.current || (loadMore && !hasMore)) {
             console.log("[PostsFeed] Fetch skipped: Already fetching or no more posts.");
             return;
          }
        isFetchingRef.current = true;

         // Check if profile is needed and loaded (relevant only if not guest)
          if (!user) {
               console.log("[PostsFeed] Fetch skipped: User not logged in.");
               setError("User not logged in."); // Set appropriate error
               setIsLoadingPosts(false);
               setIsLoadingMore(false);
               isFetchingRef.current = false;
               return;
          }
          // Use studentData passed as prop
          if (!studentData && !isGuest) {
              console.log("[PostsFeed] Fetch skipped: Logged in, but profile data unavailable.");
              setError("Profile data needed to fetch posts."); // Set appropriate error
              setIsLoadingPosts(false);
              setIsLoadingMore(false);
              isFetchingRef.current = false;
              return;
          }


        const currentLastVisible = loadMore ? lastVisible : null;
        const shouldSetInitialLoading = !loadMore;

        if (shouldSetInitialLoading) setIsLoadingPosts(true);
        else setIsLoadingMore(true);
        if (!loadMore) setError(null); // Clear previous fetch errors on new initial load/sort

        console.log(`[PostsFeed] Fetching posts (loadMore: ${loadMore}, sort: ${sortOption})`);


        try {
            let q: Query<DocumentData> = collection(db, 'posts');

             // Basic Query (will be refined by security rules on the backend)
             if (sortOption === 'recent') {
                 q = query(q, orderBy('timestamp', 'desc'));
             } else if (sortOption === 'popular') {
                 // Simple popular sort by upvotes, then recent
                 q = query(q, orderBy('upvotesCount', 'desc'), orderBy('timestamp', 'desc'));
             } else if (sortOption === 'hot') {
                  // Simple hot sort by score, then recent
                 q = query(q, orderBy('hotScore', 'desc'), orderBy('timestamp', 'desc'));
             }


            const limitWithCheck = POSTS_PER_PAGE + 1; // Fetch one extra to check for 'hasMore'
            q = query(q, limit(limitWithCheck));

            if (loadMore && currentLastVisible) {
                q = query(q, startAfter(currentLastVisible));
            }

            const querySnapshot = await getDocs(q);

            // Correct mapping without duplicate 'id'
            const fetchedPosts = querySnapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...(docSnap.data() as Omit<Post, 'id' | 'userVote' | 'isFavorite'>),
            }));

            console.log(`[PostsFeed] Fetched ${querySnapshot.docs.length} raw documents.`);

            const hasMoreResults = fetchedPosts.length === limitWithCheck;
            const postsToProcess = hasMoreResults ? fetchedPosts.slice(0, POSTS_PER_PAGE) : fetchedPosts;
            const newLastVisible = hasMoreResults ? querySnapshot.docs[querySnapshot.docs.length - 1] : null; // Get the actual last doc of the current page

            // Client-Side Visibility Filtering (can be removed if rules are perfect, but good fallback)
             const profile = studentData; // Use profile data passed as prop
             // const isGuest = !user || user.email === 'guest@iiitbhopal.ac.in'; // Already passed as prop

             const visiblePosts = postsToProcess.filter(post => {
                 if (isGuest) return true; // Guests see all (if rules allow)
                 if (!profile) return false; // Non-guest needs profile

                 const isBranchVisible = !post.visibility?.branches?.length || post.visibility.branches.includes(profile.branch);
                 const isYearVisible = !post.visibility?.yearsOfPassing?.length || post.visibility.yearsOfPassing.includes(profile.yearOfPassing);
                 const isGenderVisible = !post.visibility?.genders?.length || post.visibility.genders.includes(profile.gender);

                 // Debugging visibility
                 // console.log(`Post ${post.id} Visibility: Branches=${post.visibility?.branches?.join(',') || 'All'}, Years=${post.visibility?.yearsOfPassing?.join(',') || 'All'}, Genders=${post.visibility?.genders?.join(',') || 'All'}`);
                 // console.log(`Profile: Branch=${profile.branch}, Year=${profile.yearOfPassing}, Gender=${profile.gender}`);
                 // console.log(`Visible Checks: Branch=${isBranchVisible}, Year=${isYearVisible}, Gender=${isGenderVisible}`);

                 return isBranchVisible && isYearVisible && isGenderVisible;
             });

              console.log(`[PostsFeed] ${visiblePosts.length} posts visible after client-side filtering.`);


             // Fetch Vote/Favorite Status
             const visiblePostIds = visiblePosts.map(post => post.id);
             let voteStatuses: Record<string, 'up' | 'down' | null> = {};
             let favoritePostIds: string[] = [];
             if (user && visiblePostIds.length > 0) {
                 [voteStatuses, favoritePostIds] = await Promise.all([
                     getPostsVoteStatus(user.uid, visiblePostIds),
                     getFavoritePostIds(user.uid) // Assuming this returns only IDs relevant to the user
                 ]);
             }

            const postsWithStatus: Post[] = visiblePosts.map(post => ({
                ...post,
                userVote: voteStatuses[post.id] || null,
                isFavorite: favoritePostIds.includes(post.id),
            }));

            // Update state
            setPosts(prevPosts => loadMore ? [...prevPosts, ...postsWithStatus] : postsWithStatus);
            setLastVisible(newLastVisible);
            setHasMore(hasMoreResults);
            console.log(`[PostsFeed] Updated state. Posts count: ${loadMore ? posts.length + postsWithStatus.length : postsWithStatus.length}, HasMore: ${hasMoreResults}`);


        } catch (err: any) {
            console.error("[PostsFeed] Error fetching posts:", err);
             // Check for permission errors specifically
             if (err.code === 'permission-denied') {
                setError("Permission denied. Check Firestore rules.");
             } else {
                 setError(err.message || 'Failed to load posts.');
             }
             if (!loadMore) setPosts([]); // Clear posts only on initial fetch error
             setHasMore(false);
        } finally {
            if (shouldSetInitialLoading) setIsLoadingPosts(false);
            setIsLoadingMore(false);
            isFetchingRef.current = false;
            console.log("[PostsFeed] Fetch finished.");
        }
    }, [user, studentData, isGuest, sortOption, hasMore, lastVisible]); // Dependencies: user, profile data, sort option, pagination state

    // Effect to trigger the first fetch or refetch on sort change
    useEffect(() => {
        // Fetch only when profile is loaded (passed via studentData) or user is guest
        // and the initial load hasn't been marked as done for the current user/sort state
        // Check if user exists AND (studentData is available OR isGuest is true)
        if (user && (studentData || isGuest)) {
             console.log("[PostsFeed Effect] Triggering fetch check. InitialLoadDone:", initialLoadDoneRef.current);
             // Reset and fetch when sortOption changes OR if initial load wasn't done
             if (!initialLoadDoneRef.current || sortOption !== posts[0]?.visibility.branches[0] ) { // Rough check if sort changed
                 setPosts([]);
                 setLastVisible(null);
                 setHasMore(true);
                 setError(null);
                 fetchPosts(false);
                 initialLoadDoneRef.current = true; // Mark initial load as done
             }
        } else if (!user) {
             // Handle logged-out state: clear posts, reset state
             setPosts([]);
             setLastVisible(null);
             setHasMore(true);
             setError(null);
             initialLoadDoneRef.current = false;
             console.log("[PostsFeed Effect] User logged out, resetting feed state.");
        }
         else {
            console.log("[PostsFeed Effect] Skipping fetch check (Profile/User missing or still loading in parent).");
        }

     // Trigger this effect ONLY when user, profile data, or sort option changes.
    }, [user, studentData, isGuest, sortOption, fetchPosts]); // Added fetchPosts back

    // Reset initialLoadDoneRef if user or sortOption changes, so fetch runs again
     useEffect(() => {
       initialLoadDoneRef.current = false;
     }, [user, sortOption]);

    // Infinite Scroll Logic
    const lastPostElementRef = useCallback((node: HTMLElement | null) => { // Added type for node
        if (isLoadingPosts || isLoadingMore || !hasMore || isFetchingRef.current) return;
        if (observer.current) observer.current.disconnect();

        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting) {
                console.log("[PostsFeed] Intersection observer triggered load more.");
                fetchPosts(true); // Pass true for loadMore
            }
        }, {
            rootMargin: '0px 0px 300px 0px', // Load earlier
            threshold: 0.1
        });

        if (node) observer.current.observe(node);

    }, [isLoadingPosts, isLoadingMore, hasMore, fetchPosts]); // fetchPosts is dependency here

    // Cleanup observer on unmount
    useEffect(() => {
        return () => {
            if (observer.current) observer.current.disconnect();
        };
    }, []);

    // --- Render Logic ---

    if (!user && !isGuest) { // User state loading or logged out
        return <div className="text-center py-10 text-gray-600 dark:text-gray-400">Loading user data...</div>;
    }

    // Moved profile loading check to dashboard

    // Error fetching profile (handled in dashboard, but keep a check)
    if (!studentData && !isGuest) {
        return <p className="text-center py-10 text-red-500 dark:text-red-400">Error loading profile data. Cannot display posts.</p>;
    }

    // Error fetching posts (and no posts were loaded previously)
    if (error && posts.length === 0) {
         return <p className="text-center py-10 text-red-500 dark:text-red-400">Error loading posts: {error}</p>;
    }


    return (
        <div className="posts-feed-container max-w-3xl mx-auto p-4">
            {/* Buttons Section */}
            <div className="mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                {/* Create/Your Posts Buttons */}
                 <div className="flex gap-2">
                    <Button
                        onClick={() => setActiveSection('create-post')}
                        disabled={isGuest}
                        variant="default"
                        size="sm"
                    >
                        <PlusCircle className="mr-2 h-4 w-4" /> Create Post
                    </Button>
                    <Button
                        onClick={() => setActiveSection('your-posts')}
                        disabled={isGuest}
                        variant="outline"
                        size="sm"
                    >
                       <User className="mr-2 h-4 w-4" /> Your Posts
                    </Button>
                </div>

                 {/* Sort Options */}
                <div className="flex items-center">
                    <label htmlFor="sort-select" className="mr-2 text-gray-700 dark:text-gray-300 text-sm font-medium">Sort By:</label>
                    <select
                        id="sort-select"
                        value={sortOption}
                        onChange={(e) => {
                             setSortOption(e.target.value as SortOption);
                             initialLoadDoneRef.current = false; // Reset flag to trigger refetch
                        }}
                        className="border border-gray-300 rounded-md shadow-sm p-1.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 focus:ring-primary focus:border-primary"
                        disabled={isLoadingPosts || isLoadingMore}
                    >
                        <option value="recent">Most Recent</option>
                        <option value="popular">Most Popular</option>
                        <option value="hot">Hot</option>
                    </select>
                 </div>
            </div>

            {isLoadingPosts && posts.length === 0 && <div className="text-center py-10"><LoadingSpinner /> Loading posts...</div>}

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
            {!hasMore && posts.length > 0 && <p className="text-center py-5 text-gray-500 dark:text-gray-400">You've reached the end.</p>}
            {!isLoadingPosts && !isLoadingMore && posts.length === 0 && !error && <p className="text-center py-10 text-gray-600 dark:text-gray-400">No posts found. Be the first to create one!</p>}
        </div>
    );
};

export default PostsFeed;
