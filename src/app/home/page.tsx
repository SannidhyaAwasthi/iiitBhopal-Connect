
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/config/firebase';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import type { StudentProfile, Event, Post } from '@/types';
import LoadingSpinner from '@/components/loading-spinner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from "@/components/ui/scroll-area"; // Import ScrollArea
import { EventCard } from '@/components/EventCard';
import { PostCard } from '@/components/PostCard';
import { Search, Calendar, FileText, Star } from 'lucide-react';
import { generateWelcomeMessage } from '@/ai/flows/generate-welcome-message';
import { getFavoritePostIds } from '@/lib/postActions';
import { fetchEvents } from '@/lib/eventActions'; // Assuming fetchEvents fetches all visible events

export default function HomePage() {
  const { user } = useAuth();
  const [studentData, setStudentData] = useState<StudentProfile | null>(null);
  const [welcomeMessage, setWelcomeMessage] = useState<string | null>(null);
  const [featuredEvents, setFeaturedEvents] = useState<Event[]>([]);
  const [registeredEvents, setRegisteredEvents] = useState<Event[]>([]); // Keep registered events logic if needed later
  const [recentPosts, setRecentPosts] = useState<Post[]>([]);
  const [favoritePostIds, setFavoritePostIds] = useState<string[]>([]); // Keep favorite post logic
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingWelcome, setLoadingWelcome] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<{ posts: Post[], events: Event[] } | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // 1. Fetch Student Profile
  useEffect(() => {
    const fetchStudentData = async () => {
      if (user) {
        setLoadingProfile(true);
        try {
          const uidMapRef = doc(db, 'students-by-uid', user.uid);
          const uidMapSnap = await getDoc(uidMapRef);
          if (!uidMapSnap.exists()) throw new Error("Student UID mapping not found.");
          const scholarNumber = uidMapSnap.data()?.scholarNumber;
          if (!scholarNumber) throw new Error("Scholar number not found in mapping.");
          const studentDocRef = doc(db, 'students', scholarNumber);
          const studentDocSnap = await getDoc(studentDocRef);
          if (!studentDocSnap.exists()) throw new Error(`Student profile not found: ${scholarNumber}`);

           const fetchedData = studentDocSnap.data() as Omit<StudentProfile, 'gender'> & { gender?: StudentProfile['gender'] };
           const profile: StudentProfile = {
               ...fetchedData,
               name: fetchedData.name || user.displayName || "Student",
               scholarNumber: fetchedData.scholarNumber || "N/A",
               email: fetchedData.email || user.email || "N/A",
               branch: fetchedData.branch || 'Unknown',
               yearOfPassing: fetchedData.yearOfPassing || 0,
               programType: fetchedData.programType || 'Undergraduate',
               specialRoles: fetchedData.specialRoles || [],
               phoneNumber: fetchedData.phoneNumber || '',
               uid: fetchedData.uid || user.uid,
               gender: fetchedData.gender || 'Unknown',
           };
           setStudentData(profile);
        } catch (error) {
          console.error("Error fetching student data for homepage:", error);
        } finally {
          setLoadingProfile(false);
        }
      } else {
         setStudentData(null);
         setLoadingProfile(false);
      }
    };
    fetchStudentData();
  }, [user]);

  // 2. Fetch Events (Featured & Registered) and Recent Posts
  useEffect(() => {
    const fetchData = async () => {
      if (!studentData && user) return; // Wait for profile if logged in

      setLoadingEvents(true);
      setLoadingPosts(true);

      try {
        // Fetch all potentially visible events first
        const allVisibleEvents = await fetchEvents(studentData); // Pass profile for visibility filtering

        // Logic to determine "featured" events (e.g., upcoming soon)
        const upcomingEvents = allVisibleEvents
          .filter(e => e.startTime && e.startTime.toDate() > new Date())
          .sort((a, b) => (a.startTime?.toMillis() ?? 0) - (b.startTime?.toMillis() ?? 0));
        setFeaturedEvents(upcomingEvents.slice(0, 5)); // Show top 5 upcoming

        // Fetch registered event IDs (placeholder)
        setRegisteredEvents([]); // Keep empty for now, fetch logic needed if used

        // Fetch recent posts (respecting visibility) - Limit to 3
        const postsQuery = query(
            collection(db, 'posts'),
            orderBy('timestamp', 'desc'),
            limit(3) // Limit to 3 posts
        );
        const postsSnapshot = await getDocs(postsQuery);
        const recent = postsSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Post))
          .filter(post => { // Client-side visibility filter
             if (!user || !studentData) return true; // Assume visible if not logged in or profile missing
             const visibility = post.visibility;
             if (!visibility) return true;
             const isBranchVisible = visibility.branches?.length === 0 || visibility.branches?.includes(studentData.branch);
             const isYearVisible = visibility.yearsOfPassing?.length === 0 || visibility.yearsOfPassing?.includes(studentData.yearOfPassing);
             const isGenderVisible = visibility.genders?.length === 0 || visibility.genders?.includes(studentData.gender);
             return isBranchVisible && isYearVisible && isGenderVisible;
          });
        setRecentPosts(recent);

      } catch (error) {
        console.error("Error fetching homepage data:", error);
      } finally {
        setLoadingEvents(false);
        setLoadingPosts(false);
      }
    };

    if (!loadingProfile) {
      fetchData();
    }
  }, [studentData, loadingProfile, user]);


  // 3. Fetch Favorite Post IDs and Generate Welcome Message
   useEffect(() => {
        const fetchFavoritesAndGenerateMessage = async () => {
             if (user && studentData) {
                 setLoadingWelcome(true);
                 try {
                     const favIds = await getFavoritePostIds(user.uid);
                     setFavoritePostIds(favIds);

                     // Fetch titles for favorited posts (limit 5)
                     const favoritePostTitles: string[] = [];
                     if (favIds.length > 0) {
                         const favQuery = query(collection(db, 'posts'), where('__name__', 'in', favIds.slice(0, 5)));
                         const favSnapshot = await getDocs(favQuery);
                         favSnapshot.forEach(doc => favoritePostTitles.push(doc.data().title));
                     }

                     // Fetch titles for registered events (limit 3) - Using featured for now
                     const eventTitlesForPrompt = featuredEvents.slice(0, 3).map(e => e.title);

                     const message = await generateWelcomeMessage({
                         studentName: studentData.name,
                         registeredEventTitles: eventTitlesForPrompt, // Use featured/upcoming titles
                         favoritedPostTitles: favoritePostTitles,
                     });
                     setWelcomeMessage(message.welcomeMessage);
                 } catch (error) {
                     console.error("Error generating welcome message:", error);
                     setWelcomeMessage(`Welcome back, ${studentData.name}!`); // Fallback message
                 } finally {
                      setLoadingWelcome(false);
                 }
             } else {
                  setWelcomeMessage("Welcome to IIIT Bhopal Connect!"); // Generic welcome
                  setLoadingWelcome(false);
             }
        };

        // Wait for profile and events data before generating message
        if (!loadingProfile && !loadingEvents) {
             fetchFavoritesAndGenerateMessage();
        }
   }, [user, studentData, featuredEvents, loadingProfile, loadingEvents]); // Rerun if dependencies change


  // 4. Handle Search
  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!searchTerm.trim()) {
      setSearchResults(null);
      return;
    }
    setIsSearching(true);
    setSearchResults(null); // Clear previous results

    try {
      // Basic search: Query posts and events separately by title (case-insensitive might need backend/functions)
      const postsQuery = query(
          collection(db, 'posts'),
          where('title', '>=', searchTerm),
          where('title', '<=', searchTerm + '\uf8ff'),
          orderBy('title'), // Need orderBy to use range comparison
          limit(10)
      );
       const eventsQuery = query(
          collection(db, 'events'),
           where('title', '>=', searchTerm),
           where('title', '<=', searchTerm + '\uf8ff'),
           orderBy('title'),
           limit(10)
      );

      const [postsSnap, eventsSnap] = await Promise.all([
          getDocs(postsQuery),
          getDocs(eventsQuery)
      ]);

      let postsResults = postsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      let eventsResults = eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));

       // Apply visibility filtering to search results
       if (user && studentData) {
          postsResults = postsResults.filter(post => {
               const visibility = post.visibility;
               if (!visibility) return true;
               const isBranchVisible = visibility.branches?.length === 0 || visibility.branches?.includes(studentData.branch);
               const isYearVisible = visibility.yearsOfPassing?.length === 0 || visibility.yearsOfPassing?.includes(studentData.yearOfPassing);
               const isGenderVisible = visibility.genders?.length === 0 || visibility.genders?.includes(studentData.gender);
               return isBranchVisible && isYearVisible && isGenderVisible;
          });
          eventsResults = eventsResults.filter(event => {
               const visibility = event.visibility;
               if (!visibility) return true;
               const isBranchVisible = visibility.branches?.length === 0 || visibility.branches?.includes(studentData.branch);
               const isYearVisible = visibility.yearsOfPassing?.length === 0 || visibility.yearsOfPassing?.includes(studentData.yearOfPassing);
               const isGenderVisible = visibility.genders?.length === 0 || visibility.genders?.includes(studentData.gender);
               return isBranchVisible && isYearVisible && isGenderVisible;
           });
       } else {
           // Filter for public items if not logged in
            postsResults = postsResults.filter(post => !post.visibility || (post.visibility.branches?.length === 0 && post.visibility.yearsOfPassing?.length === 0 && post.visibility.genders?.length === 0));
            eventsResults = eventsResults.filter(event => !event.visibility || (event.visibility.branches?.length === 0 && event.visibility.yearsOfPassing?.length === 0 && event.visibility.genders?.length === 0));
       }

      setSearchResults({ posts: postsResults, events: eventsResults });

    } catch (error) {
        console.error("Search error:", error);
    } finally {
        setIsSearching(false);
    }
  };

  const isLoading = loadingProfile || loadingEvents || loadingPosts || loadingWelcome;

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-8">
      {/* Welcome Banner */}
      <Card className="bg-gradient-to-r from-primary/80 via-primary to-primary/70 text-primary-foreground shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl md:text-3xl font-bold">
             {loadingWelcome ? "Loading welcome..." : welcomeMessage || `Welcome back, ${studentData?.name || 'Student'}!`}
           </CardTitle>
           <CardDescription className="text-primary-foreground/80">
             Here's what's happening on campus.
           </CardDescription>
        </CardHeader>
      </Card>

      {/* Universal Search Bar */}
      <form onSubmit={handleSearch} className="relative">
        <Input
          type="search"
          placeholder="Search posts and events..."
          className="w-full pl-10 pr-20 py-2 text-base border-2" // Adjust padding for button
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
         <Button type="submit" className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 px-3" size="sm" disabled={isSearching}>
             {isSearching ? 'Searching...' : 'Search'}
         </Button>
      </form>

      {/* Main Content Area (Search Results or Default Layout) */}
      <div className="flex flex-col md:flex-row gap-8">

        {/* --- Main Content (Left Side - 2/3 width approx) --- */}
        <div className="w-full md:w-2/3 space-y-8">
          {/* Search Results */}
          {isSearching && <div className="text-center p-4"><LoadingSpinner /> Searching...</div>}
          {searchResults && (
              <Card>
                  <CardHeader>
                      <CardTitle>Search Results for "{searchTerm}"</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                      {searchResults.posts.length > 0 && (
                           <div>
                              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><FileText className="h-5 w-5" /> Posts</h3>
                              <div className="space-y-4">
                                   {searchResults.posts.map(post => (
                                        <PostCard key={post.id} post={post} />
                                   ))}
                              </div>
                           </div>
                      )}
                      {/* Events in search results will be shown on the right side now */}
                      {searchResults.posts.length === 0 && searchResults.events.length === 0 && (
                          <p className="text-muted-foreground text-center">No results found.</p>
                      )}
                  </CardContent>
              </Card>
          )}

          {/* Recent Posts Section (shown if not searching) */}
           {!searchResults && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent Posts</CardTitle>
                  <CardDescription>Latest updates from the community.</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingPosts ? (
                    <div className="text-center py-4"><LoadingSpinner /></div>
                  ) : recentPosts.length > 0 ? (
                    <div className="flex flex-col sm:flex-row gap-4 overflow-x-auto pb-2">
                      {recentPosts.map(post => (
                         // Ensure PostCard has a defined width or use flex properties correctly
                        <div key={post.id} className="w-full sm:w-72 flex-shrink-0">
                           <PostCard post={post} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm text-center py-4">No recent posts.</p>
                  )}
                </CardContent>
              </Card>
           )}
        </div>

         {/* --- Sidebar Content (Right Side - 1/3 width approx) --- */}
         <div className="w-full md:w-1/3 space-y-8">
              {/* Events Section (Featured or Search Results) */}
              <Card>
                <CardHeader>
                  <CardTitle>
                      {searchResults ? 'Event Results' : 'Featured Events'}
                  </CardTitle>
                   <CardDescription>
                       {searchResults ? `Events matching "${searchTerm}"` : 'Upcoming campus activities.'}
                   </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                   {loadingEvents || isSearching ? (
                       <div className="text-center py-4"><LoadingSpinner /></div>
                   ) : (
                      <ScrollArea className="h-96 pr-4"> {/* Fixed height and scroll */}
                          <div className="space-y-4">
                            {(searchResults?.events ?? featuredEvents).length > 0 ? (
                                (searchResults?.events ?? featuredEvents).map(event => (
                                     <EventCard key={event.id} event={event} currentUser={user} currentStudentProfile={studentData} onUpdate={() => {
                                         // Refetch or re-run search if needed
                                         if (searchResults) handleSearch();
                                         // Else, refetch featured events if necessary
                                     }} />
                                ))
                             ) : (
                                <p className="text-muted-foreground text-sm text-center py-4">
                                   {searchResults ? 'No events found.' : 'No featured events right now.'}
                                </p>
                             )}
                          </div>
                      </ScrollArea>
                   )}
                </CardContent>
              </Card>

             {/* Registered Events (Optional, can be added back if needed) */}
              {/* {!searchResults && ... } */}
         </div>
      </div>
    </div>
  );
}
