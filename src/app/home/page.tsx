
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { EventCard } from '@/components/EventCard';
import { PostCard } from '@/components/PostCard';
import { Search, Calendar, FileText, Star } from 'lucide-react';
import { generateWelcomeMessage } from '@/ai/flows/generate-welcome-message';
import { getFavoritePostIds } from '@/lib/postActions';
import { fetchEvents } from '@/lib/eventActions';

export default function HomePageContent() { // Renamed component for clarity
  const { user } = useAuth();
  const [studentData, setStudentData] = useState<StudentProfile | null>(null);
  const [welcomeMessage, setWelcomeMessage] = useState<string | null>(null);
  const [featuredEvents, setFeaturedEvents] = useState<Event[]>([]);
  const [registeredEvents, setRegisteredEvents] = useState<Event[]>([]);
  const [recentPosts, setRecentPosts] = useState<Post[]>([]);
  const [favoritePostIds, setFavoritePostIds] = useState<string[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingWelcome, setLoadingWelcome] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<{ posts: Post[], events: Event[] } | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // --- Fetch Student Profile (Copied from previous version) ---
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
                    setStudentData(null); // Set to null on error
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

  // --- Fetch Events and Recent Posts (Copied from previous version) ---
  useEffect(() => {
      const fetchData = async () => {
          // Check if profile is needed and available
           if (user && !studentData && !loadingProfile) {
              console.log("Homepage waiting for profile data...");
              return; // Wait if user is logged in but profile isn't loaded yet
           }
          if (user && loadingProfile) return; // Still loading profile

          setLoadingEvents(true);
          setLoadingPosts(true);

          try {
               // Pass profile (even if null for logged-out) for filtering
              const allVisibleEvents = await fetchEvents(studentData);

              // Determine featured events (upcoming)
              const upcomingEvents = allVisibleEvents
                  .filter(e => e.startTime && e.startTime.toDate() > new Date())
                  .sort((a, b) => (a.startTime?.toMillis() ?? 0) - (b.startTime?.toMillis() ?? 0));
              setFeaturedEvents(upcomingEvents.slice(0, 5)); // Show top 5 upcoming

              setRegisteredEvents([]); // Placeholder

               // Fetch recent posts with client-side visibility filter
               const postsQuery = query(
                   collection(db, 'posts'),
                   orderBy('timestamp', 'desc'),
                   limit(3)
               );
               const postsSnapshot = await getDocs(postsQuery);
               const recent = postsSnapshot.docs
                   .map(doc => ({ id: doc.id, ...doc.data() } as Post))
                   .filter(post => {
                       if (!studentData) { // If no profile (logged out or failed load)
                          // Only show posts with no visibility restrictions
                           return !post.visibility || (
                               (post.visibility.branches?.length ?? 0) === 0 &&
                               (post.visibility.yearsOfPassing?.length ?? 0) === 0 &&
                               (post.visibility.genders?.length ?? 0) === 0
                           );
                       }
                       // If profile exists, filter based on it
                       const visibility = post.visibility;
                       if (!visibility) return true;
                       const isBranchVisible = (visibility.branches?.length ?? 0) === 0 || visibility.branches?.includes(studentData.branch);
                       const isYearVisible = (visibility.yearsOfPassing?.length ?? 0) === 0 || visibility.yearsOfPassing?.includes(studentData.yearOfPassing);
                       const isGenderVisible = (visibility.genders?.length ?? 0) === 0 || visibility.genders?.includes(studentData.gender);
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

       // Fetch data only when profile loading is complete OR if the user is logged out
       if (!loadingProfile) {
           fetchData();
       }
  }, [studentData, loadingProfile, user]); // Added user dependency

  // --- Fetch Favorites and Generate Welcome Message (Copied from previous version) ---
   useEffect(() => {
        const fetchFavoritesAndGenerateMessage = async () => {
             // Wait for profile if user is logged in
             if (user && !studentData && loadingProfile) {
                return;
             }

             setLoadingWelcome(true);
             try {
                 if (user && studentData) { // Generate personalized message
                     const favIds = await getFavoritePostIds(user.uid);
                     setFavoritePostIds(favIds);

                     const favoritePostTitles: string[] = [];
                      if (favIds.length > 0) {
                          // Limit query to avoid large 'in' arrays if needed
                          const favQuery = query(collection(db, 'posts'), where('__name__', 'in', favIds.slice(0, 10)));
                          const favSnapshot = await getDocs(favQuery);
                          favSnapshot.forEach(doc => favoritePostTitles.push(doc.data().title));
                      }

                     const eventTitlesForPrompt = featuredEvents.slice(0, 3).map(e => e.title);

                     const message = await generateWelcomeMessage({
                         studentName: studentData.name || 'Student', // Fallback name
                         registeredEventTitles: eventTitlesForPrompt,
                         favoritedPostTitles: favoritePostTitles,
                     });
                     setWelcomeMessage(message.welcomeMessage);

                 } else { // Generic message for logged-out users or profile error
                     setWelcomeMessage("Welcome to IIIT Bhopal Connect!");
                     setFavoritePostIds([]); // Clear favorites if not logged in
                 }

             } catch (error) {
                 console.error("Error generating welcome message or fetching favorites:", error);
                 // Provide a fallback based on user/profile state
                 setWelcomeMessage(`Welcome back, ${studentData?.name || 'Student'}!`);
             } finally {
                 setLoadingWelcome(false);
             }
        };

         // Trigger when profile and events loading are finished
         if (!loadingProfile && !loadingEvents) {
             fetchFavoritesAndGenerateMessage();
         }
   }, [user, studentData, featuredEvents, loadingProfile, loadingEvents]);


  // --- Handle Search (Copied from previous version) ---
  const handleSearch = async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!searchTerm.trim()) {
          setSearchResults(null);
          return;
      }
      setIsSearching(true);
      setSearchResults(null);

      try {
           const postsQuery = query(
              collection(db, 'posts'),
              where('title', '>=', searchTerm),
              where('title', '<=', searchTerm + '\uf8ff'),
              orderBy('title'),
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

           // Apply visibility filtering based on logged-in user's profile
            if (studentData) {
               postsResults = postsResults.filter(post => {
                   const visibility = post.visibility;
                   if (!visibility) return true;
                   const isBranchVisible = (visibility.branches?.length ?? 0) === 0 || visibility.branches?.includes(studentData.branch);
                   const isYearVisible = (visibility.yearsOfPassing?.length ?? 0) === 0 || visibility.yearsOfPassing?.includes(studentData.yearOfPassing);
                   const isGenderVisible = (visibility.genders?.length ?? 0) === 0 || visibility.genders?.includes(studentData.gender);
                   return isBranchVisible && isYearVisible && isGenderVisible;
               });
               eventsResults = eventsResults.filter(event => {
                   const visibility = event.visibility;
                   if (!visibility) return true;
                   const isBranchVisible = (visibility.branches?.length ?? 0) === 0 || visibility.branches?.includes(studentData.branch);
                   const isYearVisible = (visibility.yearsOfPassing?.length ?? 0) === 0 || visibility.yearsOfPassing?.includes(studentData.yearOfPassing);
                   const isGenderVisible = (visibility.genders?.length ?? 0) === 0 || visibility.genders?.includes(studentData.gender);
                   return isBranchVisible && isYearVisible && isGenderVisible;
               });
           } else {
               // Filter for public items if not logged in / no profile
               postsResults = postsResults.filter(post => !post.visibility || (
                    (post.visibility.branches?.length ?? 0) === 0 &&
                    (post.visibility.yearsOfPassing?.length ?? 0) === 0 &&
                    (post.visibility.genders?.length ?? 0) === 0
               ));
               eventsResults = eventsResults.filter(event => !event.visibility || (
                    (event.visibility.branches?.length ?? 0) === 0 &&
                    (event.visibility.yearsOfPassing?.length ?? 0) === 0 &&
                    (event.visibility.genders?.length ?? 0) === 0
               ));
           }

          setSearchResults({ posts: postsResults, events: eventsResults });

      } catch (error) {
          console.error("Search error:", error);
      } finally {
          setIsSearching(false);
      }
  };

  const isLoading = loadingProfile || loadingEvents || loadingPosts || loadingWelcome;

  // --- Render Homepage Content ---
  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-8">
      {/* Welcome Banner */}
      <Card className="bg-gradient-to-r from-primary/80 via-primary to-primary/70 text-primary-foreground shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl md:text-3xl font-bold">
             {loadingWelcome ? "Loading welcome..." : welcomeMessage}
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
          className="w-full pl-10 pr-20 py-2 text-base border-2"
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
                                       // Adjust PostCard usage if needed
                                        <PostCard key={post.id} post={post} />
                                   ))}
                              </div>
                           </div>
                      )}
                       {searchResults.events.length > 0 && searchResults.posts.length === 0 && (
                           <p className="text-muted-foreground">No matching posts. Event results are shown on the right.</p>
                       )}
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
                     // Horizontal scroll for recent posts
                    <ScrollArea className="w-full whitespace-nowrap pb-4">
                         <div className="flex w-max space-x-4">
                           {recentPosts.map(post => (
                             <div key={post.id} className="w-72 flex-shrink-0">
                                <PostCard post={post} />
                             </div>
                           ))}
                         </div>
                    </ScrollArea>
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
                   {loadingEvents && !searchResults ? ( // Show loading only for initial featured load
                       <div className="text-center py-4"><LoadingSpinner /></div>
                   ) : (
                       <ScrollArea className="h-96 pr-4"> {/* Adjust height as needed */}
                          <div className="space-y-4">
                             {(searchResults?.events ?? featuredEvents).length > 0 ? (
                                 (searchResults?.events ?? featuredEvents).map(event => (
                                     <EventCard key={event.id} event={event} currentUser={user} currentStudentProfile={studentData} onUpdate={() => {
                                         // Refetch or re-run search if needed
                                         if (searchResults) handleSearch();
                                         // Else, refetch featured events if necessary (e.g., after registration)
                                         else { /* TODO: Refetch featured events if needed */ }
                                     }} />
                                 ))
                             ) : (
                                 <p className="text-muted-foreground text-sm text-center py-4">
                                     {searchResults ? 'No matching events found.' : 'No featured events right now.'}
                                 </p>
                             )}
                          </div>
                      </ScrollArea>
                   )}
                </CardContent>
              </Card>

              {/* Placeholder for Registered Events if needed */}
              {/* {!searchResults && user && ... } */}
         </div>
      </div>
    </div>
  );
}

    