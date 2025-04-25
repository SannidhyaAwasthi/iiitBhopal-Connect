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
import type { Student, Post as PostType } from '@/types';
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

// Now use the imported Student type directly
type StudentProfile = Student;

const PostsFeed: FC<PostsFeedProps> = ({ setActiveSection, isGuest }) => {
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
                                 // Ensure gender is handled correctly
                                 const fetchedData = studentDocSnap.data() as Omit<StudentProfile, 'gender'> & { gender?: StudentProfile['gender'] };
                                setStudentData({
                                     ...fetchedData,
                                     gender: fetchedData.gender || 'Unknown', // Default if missing
                                 } as StudentProfile);
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
                                gender: 'Prefer not to say',
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
         if (!user || (!studentData && user.email !== 'guest@iiitbhopal.ac.in') || (!loadMore && isLoading) || (loadMore && isLoadingMore) || (loadMore && !hasMore)) {
             if (!studentData && !error && isLoading) return;
             if (error) return;
             if ((!loadMore && isLoading) || (loadMore && isLoadingMore)) return;
             if (loadMore && !hasMore) return;
              if (!user || (!studentData && user.email !== 'guest@iiitbhopal.ac.in')) {
                  console.log("FetchPosts skipped: User/StudentData not available or error occurred.");
                  return;
              }
         }

         console.log(`Fetching posts (loadMore: ${loadMore}, sort: ${sortOption})`);

        if (!loadMore) {
            setIsLoading(true);
        } else {
            setIsLoadingMore(true);
        }

        try {
            let q: Query<DocumentData> = collection(db, 'posts');
            const currentIsGuest = user?.email === 'guest@iiitbhopal.ac.in';

            if (sortOption === 'recent') {
                 q = query(q, orderBy('timestamp', 'desc'));
             } else if (sortOption === 'popular') {
                 q = query(q, orderBy('upvotesCount', 'desc'), orderBy('timestamp', 'desc'));
             } else if (sortOption === 'hot') {
                 q = query(q, orderBy('hotScore', 'desc'), orderBy('timestamp', 'desc'));
             }

             const limitWithCheck = POSTS_PER_PAGE + 1;
             q = query(q, limit(limitWithCheck));

            if (loadMore && lastVisible) {
                q = query(q, startAfter(lastVisible));
            }

            const querySnapshot = await getDocs(q);
            const fetchedPosts = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...(doc.data() as PostType),
            }));

             const hasMoreResults = fetchedPosts.length === limitWithCheck;
             const postsToProcess = hasMoreResults ? fetchedPosts.slice(0, POSTS_PER_PAGE) : fetchedPosts;

            let visiblePosts: PostType[];
            if (!currentIsGuest && studentData) {
                visiblePosts = postsToProcess.filter(post => {
                    // Handle cases where visibility fields might be missing/null
                    const branches = post.visibility?.branches ?? [];
                    const years = post.visibility?.yearsOfPassing ?? [];
                    const genders = post.visibility?.genders ?? [];

                    const isBranchVisible = branches.length === 0 || branches.includes(studentData.branch);
                    const isYearVisible = years.length === 0 || years.includes(studentData.yearOfPassing);
                    const isGenderVisible = genders.length === 0 || (studentData.gender && genders.includes(studentData.gender));

                    return isBranchVisible && isYearVisible && isGenderVisible;
                });
            } else {
                 visiblePosts = postsToProcess;
            }

             const visiblePostIds = visiblePosts.map(post => post.id);
             let voteStatuses: Record<string, 'up' | 'down' | null> = {};
             let favoritePostIds: string[] = [];

             if (user && visiblePostIds.length > 0) {
                 voteStatuses = await getPostsVoteStatus(user.uid, visiblePostIds);
                 favoritePostIds = await getFavoritePostIds(user.uid);
             }

             const postsWithStatus: Post[] = visiblePosts.map(post => ({
                 ...post,
                 userVote: voteStatuses[post.id] || null,
                 isFavorite: favoritePostIds.includes(post.id),
             }));

             setPosts(prevPosts => loadMore ? [...prevPosts, ...postsWithStatus] : postsWithStatus);
              const newLastVisible = hasMoreResults ? querySnapshot.docs[POSTS_PER_PAGE - 1] : (querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null);

             setLastVisible(newLastVisible);
             setHasMore(hasMoreResults);

        } catch (err: any) {
            console.error("Error fetching posts:", err);
            setError(err.message || 'Failed to load posts.');
            setHasMore(false);
             if (!loadMore) {
                  setPosts([]);
             }
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    }, [user, studentData, sortOption, lastVisible, hasMore, isLoading, isLoadingMore, error]);


    // Initial fetch trigger
    useEffect(() => {
        if (user && (studentData || user.email === 'guest@iiitbhopal.ac.in') && !isLoading) {
             setPosts([]);
             setLastVisible(null);
             setHasMore(true);
             setError(null);
             fetchPosts(false);
        }
    }, [user, studentData, sortOption, fetchPosts]);


    // --- Infinite Scroll Logic ---
    const lastPostElementRef = useCallback(node => {
        if (isLoading || isLoadingMore || !hasMore || !node) return;
        if (observer.current) observer.current.disconnect();

        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isLoading) {
                console.log("Intersection observer triggered load more");
                fetchPosts(true);
            }
        }, {
            rootMargin: '0px 0px 200px 0px',
            threshold: 0.1
        });

        if (node) observer.current.observe(node);

        return () => {
            if (observer.current) observer.current.disconnect();
        };
    }, [isLoading, isLoadingMore, hasMore, fetchPosts]);


    // Cleanup observer on component unmount
    useEffect(() => {
        return () => {
            if (observer.current) observer.current.disconnect();
        };
    }, []);


    if (!user) {
        return <div className="text-center py-10 text-gray-600 dark:text-gray-400">Please log in to see posts.</div>;
    }

    if (isLoading && posts.length === 0) {
         return <div className="text-center py-10"><LoadingSpinner /> Loading profile and posts...</div>;
    }

    if (error && !studentData && user.email !== 'guest@iiitbhopal.ac.in') {
        return <p className="text-center py-10 text-red-500 dark:text-red-400">Error loading profile: {error}</p>;
    }


    return (
        <div className="posts-feed-container max-w-2xl mx-auto p-4">
            {/* Container for Sort and Create Button */}
            <div className="flex justify-between items-center mb-4">
                 {/* Create Post Button (moved here) */}
                {!isGuest && (
                    <Button size="sm" onClick={() => setActiveSection('create-post')}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Create Post
                    </Button>
                 )}
                 {/* Spacer for guest users to keep sort on the right */}
                 {isGuest && <div className="w-auto"></div>}

                {/* Sort Dropdown/Buttons */}
                <div className="sort-options flex items-center">
                    <label htmlFor="sort-select" className="mr-2 text-gray-700 dark:text-gray-300 text-sm font-medium">Sort By:</label>
                    <select
                        id="sort-select"
                        value={sortOption}
                        onChange={(e) => {
                            setSortOption(e.target.value as SortOption);
                            setPosts([]);
                            setLastVisible(null);
                            setHasMore(true);
                        }}
                        className="border border-gray-300 rounded-md shadow-sm p-1 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                    >
                        <option value="recent">Most Recent</option>
                        <option value="popular">Most Popular</option>
                        <option value="hot">Hot</option>
                    </select>
                </div>
            </div>


             {error && <p className="text-center py-4 text-red-500 dark:text-red-400">Error fetching posts: {error}</p>}

            <div className="posts-list space-y-4">
                {posts.map((post, index) => {
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
