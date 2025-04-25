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
    Timestamp,
    doc,
    getDoc
} from 'firebase/firestore';
import { PostCard } from './PostCard';
import LoadingSpinner from './loading-spinner';
import { useAuth } from '@/hooks/use-auth';
import { getPostsVoteStatus, getFavoritePostIds } from '@/lib/postActions';
import type { Student, Post as PostType, StudentProfile } from '@/types'; // Import StudentProfile explicitly
import { Button } from '@/components/ui/button'; // Import Button
import { PlusCircle } from 'lucide-react'; // Import Icon


// Using imported PostType from types/index.ts
export type Post = PostType & {
    userVote?: 'up' | 'down' | null;
    isFavorite?: boolean;
};


interface PostsFeedProps {
    setActiveSection: (section: string) => void; // Function to change the view
    isGuest: boolean; // Flag to disable creation for guests
}

type SortOption = 'recent' | 'popular' | 'hot';

const POSTS_PER_PAGE = 10;


const PostsFeed: FC<PostsFeedProps> = ({ setActiveSection, isGuest }) => {
    const { user, loading: authLoading } = useAuth(); // Get user and auth loading state
    // Use the specific StudentProfile type which guarantees gender field exists
    const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [isLoadingProfile, setIsLoadingProfile] = useState(true);
    const [isLoadingPosts, setIsLoadingPosts] = useState(false); // Separate loading for posts
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [sortOption, setSortOption] = useState<SortOption>('recent');
    const observer = useRef<IntersectionObserver | null>(null); // For infinite scroll


     // Fetch student profile data when user or auth state changes
     useEffect(() => {
        const fetchStudentProfileData = async () => {
            if (authLoading) {
                setIsLoadingProfile(true); // Still loading auth
                return;
            }
            if (!user) {
                setStudentProfile(null);
                setIsLoadingProfile(false);
                setError(null); // Clear profile error if logged out
                return; // No user, stop here
            }

             console.log("[PostsFeed] Auth loaded, fetching profile for user:", user.uid);
             setIsLoadingProfile(true);
             setError(null); // Clear previous errors

            try {
                // Handle guest user explicitly
                if (user.email === 'guest@iiitbhopal.ac.in') {
                     setStudentProfile({
                         name: "Guest",
                         scholarNumber: "guest",
                         email: "guest@iiitbhopal.ac.in",
                         branch: 'Unknown',
                         yearOfPassing: 0,
                         programType: 'Undergraduate',
                         specialRoles: [],
                         phoneNumber: '',
                         uid: user.uid,
                         gender: 'Prefer not to say', // Explicitly set gender
                     } as StudentProfile); // Cast to ensure it fits StudentProfile
                     console.log("[PostsFeed] Guest profile set.");
                     return; // Exit early for guest
                }

                // Proceed for non-guest users
                const uidMapRef = doc(db, 'students-by-uid', user.uid);
                const uidMapSnap = await getDoc(uidMapRef);

                if (!uidMapSnap.exists()) throw new Error("Student UID mapping not found.");

                const scholarNumber = uidMapSnap.data()?.scholarNumber;
                if (!scholarNumber) throw new Error("Scholar number not found in mapping.");

                const studentDocRef = doc(db, 'students', scholarNumber);
                const studentSnap = await getDoc(studentDocRef);
                if (!studentSnap.exists()) throw new Error("Student profile not found.");

                // Ensure gender exists, providing a default if necessary
                const fetchedData = studentSnap.data() as Student; // Assume it matches Student initially
                const profileData: StudentProfile = {
                  ...fetchedData,
                  gender: fetchedData.gender || 'Unknown', // Provide default if missing
                };
                setStudentProfile(profileData);
                console.log("[PostsFeed] Student profile fetched:", profileData.scholarNumber);

            } catch (err: any) {
                console.error("[PostsFeed] Error fetching student profile:", err);
                setError("Failed to load your profile. Cannot filter posts. Reason: " + err.message);
                setStudentProfile(null);
            } finally {
                 setIsLoadingProfile(false);
                 console.log("[PostsFeed] Profile fetch finished.");
            }
        };
        fetchStudentProfileData();
    }, [user, authLoading]); // Depend on user and authLoading state


    const fetchPosts = useCallback(async (loadMore = false) => {
         // Prevent fetching if profile is still loading OR if there's an error fetching profile (for non-guests)
         // Guests can fetch posts even without a full profile.
         if (isLoadingProfile || (error && !isGuest)) {
             console.log("[PostsFeed] FetchPosts skipped: Profile loading or error exists.", { isLoadingProfile, error, isGuest });
             return;
         }
         // Prevent fetching if already loading posts or no more posts exist
         if ((!loadMore && isLoadingPosts) || (loadMore && isLoadingMore) || (loadMore && !hasMore)) {
             console.log("[PostsFeed] FetchPosts skipped: Already loading or no more posts.", { isLoadingPosts, isLoadingMore, hasMore });
             return;
          }
          // If we have a user but no profile data yet (and not a guest), wait for profile.
          if (user && !studentProfile && !isGuest) {
             console.log("[PostsFeed] FetchPosts skipped: Waiting for student profile data.");
             return;
          }


         console.log(`[PostsFeed] Fetching posts (loadMore: ${loadMore}, sort: ${sortOption})`);

        if (!loadMore) {
            setIsLoadingPosts(true);
            setError(null); // Clear previous post errors on fresh fetch
        } else {
            setIsLoadingMore(true);
        }

        try {
            let q: Query<DocumentData> = collection(db, 'posts');

            // Apply sorting
            if (sortOption === 'recent') {
                 q = query(q, orderBy('timestamp', 'desc'));
             } else if (sortOption === 'popular') {
                 q = query(q, orderBy('upvotesCount', 'desc'), orderBy('timestamp', 'desc'));
             } else if (sortOption === 'hot') {
                 q = query(q, orderBy('hotScore', 'desc'), orderBy('timestamp', 'desc')); // Assuming hotScore exists
             }

             // Add pagination limit (fetch one extra to check if more exist)
             const limitWithCheck = POSTS_PER_PAGE + 1;
             q = query(q, limit(limitWithCheck));

            // Apply pagination start point if loading more
            if (loadMore && lastVisible) {
                q = query(q, startAfter(lastVisible));
            }

            const querySnapshot = await getDocs(q);
            console.log(`[PostsFeed] Firestore query executed, fetched ${querySnapshot.docs.length} docs.`);
            const fetchedPosts = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...(doc.data() as PostType), // Cast to the base PostType first
            }));

            // Determine if there are more results
             const hasMoreResults = fetchedPosts.length === limitWithCheck;
             // Slice the extra post if it was fetched
             const postsToProcess = hasMoreResults ? fetchedPosts.slice(0, POSTS_PER_PAGE) : fetchedPosts;

             console.log(`[PostsFeed] Processing ${postsToProcess.length} posts after slicing.`);

            // Apply visibility filters ONLY if not a guest and profile is available
            let visiblePosts: PostType[];
            if (!isGuest && studentProfile) {
                console.log("[PostsFeed] Applying visibility filters for student:", studentProfile.scholarNumber);
                visiblePosts = postsToProcess.filter(post => {
                    // Handle cases where visibility fields might be missing/null/undefined
                    const branches = post.visibility?.branches ?? [];
                    const years = post.visibility?.yearsOfPassing ?? [];
                    const genders = post.visibility?.genders ?? [];

                    // Check if studentProfile fields exist before accessing them
                    const studentBranch = studentProfile.branch;
                    const studentYear = studentProfile.yearOfPassing;
                    const studentGender = studentProfile.gender; // Already guaranteed by StudentProfile type

                    const isBranchVisible = branches.length === 0 || (studentBranch && branches.includes(studentBranch));
                    const isYearVisible = years.length === 0 || (typeof studentYear === 'number' && years.includes(studentYear));
                    // Use the guaranteed gender field
                    const isGenderVisible = genders.length === 0 || genders.includes(studentGender);

                    // console.log(`Post ${post.id}: B:${isBranchVisible}, Y:${isYearVisible}, G:${isGenderVisible}`);
                    return isBranchVisible && isYearVisible && isGenderVisible;
                });
                console.log(`[PostsFeed] ${visiblePosts.length} posts visible after filtering.`);
            } else {
                 // Guests see all posts (or if profile errored for logged-in user)
                 visiblePosts = postsToProcess;
                 console.log("[PostsFeed] No visibility filters applied (Guest or Profile Error).");
            }

            // Fetch vote and favorite status for the visible posts
             const visiblePostIds = visiblePosts.map(post => post.id);
             let voteStatuses: Record<string, 'up' | 'down' | null> = {};
             let favoritePostIds: string[] = [];

             if (user && visiblePostIds.length > 0) {
                 console.log("[PostsFeed] Fetching vote/favorite status for visible posts...");
                 voteStatuses = await getPostsVoteStatus(user.uid, visiblePostIds);
                 favoritePostIds = await getFavoritePostIds(user.uid);
                 console.log("[PostsFeed] Vote/Favorite status fetched.");
             }

             // Combine post data with status
             const postsWithStatus: Post[] = visiblePosts.map(post => ({
                 ...post,
                 userVote: voteStatuses[post.id] || null,
                 isFavorite: favoritePostIds.includes(post.id),
             }));

            // Update state
             setPosts(prevPosts => loadMore ? [...prevPosts, ...postsWithStatus] : postsWithStatus);
             // Determine the new last visible document for pagination
             const newLastVisible = hasMoreResults
                ? querySnapshot.docs[POSTS_PER_PAGE - 1]
                : (querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null);

             setLastVisible(newLastVisible);
             setHasMore(hasMoreResults);
             console.log(`[PostsFeed] State updated. Has More: ${hasMoreResults}, Last Visible: ${newLastVisible?.id}`);

        } catch (err: any) {
            console.error("[PostsFeed] Error fetching posts:", err);
            setError(err.message || 'Failed to load posts.');
            setHasMore(false); // Stop pagination on error
             if (!loadMore) {
                  setPosts([]); // Clear posts if initial fetch failed
             }
        } finally {
            if (!loadMore) setIsLoadingPosts(false);
            setIsLoadingMore(false);
            console.log("[PostsFeed] Fetch finished.");
        }
    // Include isLoadingProfile and studentProfile in dependencies to re-trigger fetch when profile loads
    }, [user, studentProfile, isLoadingProfile, isGuest, sortOption, lastVisible, hasMore, isLoadingPosts, isLoadingMore, error]);


    // Trigger initial fetch or refetch when profile loads or sort changes
    useEffect(() => {
         // Only fetch if profile is loaded OR if it's a guest user
         // And not currently loading posts
         if ((!isLoadingProfile || isGuest) && !isLoadingPosts) {
             console.log("[PostsFeed Effect] Profile loaded or guest, triggering initial fetch/refetch.");
             setPosts([]); // Clear existing posts before new fetch/sort
             setLastVisible(null);
             setHasMore(true);
             setError(null); // Clear previous errors
             fetchPosts(false); // Fetch first page
         } else {
             console.log("[PostsFeed Effect] Skipping initial fetch (profile loading or posts loading).");
         }
         // Dependencies: user (to trigger profile fetch), isGuest, studentProfile (to trigger fetch *after* profile load), sortOption, isLoadingProfile
         // fetchPosts is memoized and included
    }, [user, isGuest, studentProfile, sortOption, fetchPosts, isLoadingProfile, isLoadingPosts]);


    // --- Infinite Scroll Logic ---
    const lastPostElementRef = useCallback(node => {
         if (isLoadingPosts || isLoadingMore || !hasMore || !node) return;
         if (observer.current) observer.current.disconnect();

         observer.current = new IntersectionObserver(entries => {
             if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isLoadingPosts) {
                 console.log("[PostsFeed Intersection] Observer triggered load more");
                 fetchPosts(true); // Load next page
             }
         }, {
             rootMargin: '0px 0px 200px 0px', // Load when 200px away from bottom
             threshold: 0.1
         });

         observer.current.observe(node);

         // Cleanup function
         return () => {
             if (observer.current) observer.current.disconnect();
         };
     }, [isLoadingPosts, isLoadingMore, hasMore, fetchPosts]);


    // Cleanup observer on component unmount
    useEffect(() => {
        return () => {
            if (observer.current) {
                observer.current.disconnect();
                console.log("[PostsFeed Cleanup] Observer disconnected.");
            }
        };
    }, []);


    // ---- Render Logic ----

    if (authLoading || isLoadingProfile) {
        // Show loading spinner if either auth or profile is loading
        return <div className="text-center py-10"><LoadingSpinner /> Loading profile...</div>;
    }

    if (!user) {
        // Should not happen if routing is correct, but good fallback
        return <div className="text-center py-10 text-gray-600 dark:text-gray-400">Please log in to see posts.</div>;
    }

    // Show profile loading error prominently if it occurred for a non-guest user
    if (error && !isGuest && !studentProfile) {
        return <p className="text-center py-10 text-red-500 dark:text-red-400">Error loading profile: {error}</p>;
    }


    return (
        <div className="posts-feed-container max-w-2xl mx-auto p-4">
            {/* Container for Sort and Create Button */}
            <div className="flex justify-between items-center mb-6">
                 {/* Create Post Button - moved here, inside the feed component */}
                {!isGuest ? (
                    <Button size="sm" onClick={() => setActiveSection('create-post')}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Create Post
                    </Button>
                 ) : (
                    <div /> /* Empty div to maintain spacing when guest */
                 )}

                {/* Sort Options */}
                <div className="sort-options flex items-center space-x-2">
                    <label htmlFor="sort-select" className="text-sm font-medium text-gray-700 dark:text-gray-300">Sort By:</label>
                    <select
                        id="sort-select"
                        value={sortOption}
                        onChange={(e) => {
                            const newSort = e.target.value as SortOption;
                            console.log(`[PostsFeed] Sort changed to: ${newSort}`);
                            setSortOption(newSort);
                            // Resetting state is handled by the useEffect hook watching sortOption
                        }}
                        className="border border-gray-300 rounded-md shadow-sm p-1.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 focus:ring-primary focus:border-primary"
                        disabled={isLoadingPosts || isLoadingMore} // Disable while loading
                    >
                        <option value="recent">Most Recent</option>
                        <option value="popular">Most Popular</option>
                        <option value="hot">Hot</option>
                    </select>
                </div>
            </div>

            {/* Display post loading errors specifically */}
            {error && <p className="text-center py-4 text-red-500 dark:text-red-400">Error fetching posts: {error}</p>}

            {/* Initial Posts Loading Spinner */}
            {isLoadingPosts && posts.length === 0 && <div className="text-center py-10"><LoadingSpinner /> Loading posts...</div>}

            {/* Posts List */}
            {!isLoadingPosts && posts.length === 0 && !error && (
                 <p className="text-center py-10 text-gray-600 dark:text-gray-400">
                   {isGuest ? "No posts found." : "No posts found matching your profile criteria."}
                 </p>
             )}

            <div className="posts-list space-y-4">
                {posts.map((post, index) => {
                    // Attach ref to the last element for infinite scroll detection
                    if (posts.length === index + 1) {
                        return <PostCard ref={lastPostElementRef} key={post.id} post={post} />;
                    } else {
                        return <PostCard key={post.id} post={post} />;
                    }
                })}
            </div>

            {/* Loading More Spinner */}
            {isLoadingMore && <div className="text-center py-5"><LoadingSpinner /> Loading more...</div>}

            {/* End of Posts Message */}
            {!isLoadingMore && !hasMore && posts.length > 0 && (
                <p className="text-center py-5 text-gray-500 dark:text-gray-400">-- End of Posts --</p>
            )}
        </div>
    );
};

export default PostsFeed;
