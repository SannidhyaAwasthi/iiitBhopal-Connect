
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
          // Handle error: maybe show a default state or error message
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
      if (!studentData) return; // Need profile for filtering

      setLoadingEvents(true);
      setLoadingPosts(true);

      try {
        // Fetch all potentially visible events first
        const allVisibleEvents = await fetchEvents(studentData); // Pass profile for visibility filtering

        // Logic to determine "featured" events (e.g., most registrations or upcoming soon)
        // For now, just take the first few upcoming ones as featured
        const upcomingEvents = allVisibleEvents
          .filter(e => e.startTime && e.startTime.toDate() > new Date())
          .sort((a, b) => (a.startTime?.toMillis() ?? 0) - (b.startTime?.toMillis() ?? 0));
        setFeaturedEvents(upcomingEvents.slice(0, 3)); // Show top 3 upcoming

        // Fetch registered event IDs (simple check for now, refine later)
        const registeredEventIds: string[] = [];
        const registrationsRef = collection(db, `students/${studentData.scholarNumber}/registeredEvents`); // Example path, adjust if needed
        // const regSnap = await getDocs(registrationsRef);
        // regSnap.forEach(doc => registeredEventIds.push(doc.id));
        // This needs a proper implementation based on how registrations are stored

        // Filter all visible events to find the ones the user is registered for
        // This is inefficient if many events; better to query registrations directly
        // const registered = allVisibleEvents.filter(event => registeredEventIds.includes(event.id));
        // Placeholder: Fetching actual registered events needs a dedicated function
        setRegisteredEvents([]); // Replace with actual fetched registered events

        // Fetch recent posts (respecting visibility)
        const postsQuery = query(
            collection(db, 'posts'),
            // where('visibility.branches', 'array-contains-any', ['', studentData.branch]), // More complex visibility needed
            orderBy('timestamp', 'desc'),
            limit(3)
        );
        const postsSnapshot = await getDocs(postsQuery);
        const recent = postsSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Post))
          .filter(post => { // Client-side visibility filter (as done in posts-feed)
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
  }, [studentData, loadingProfile]);


  // 3. Fetch Favorite Post IDs and Generate Welcome Message
   useEffect(() => {
        const fetchFavoritesAndGenerateMessage = async () => {
             if (user && studentData) {
                 setLoadingWelcome(true);
                 try {
                     const favIds = await getFavoritePostIds(user.uid);
                     setFavoritePostIds(favIds);

                     // Prepare data for AI
                     // Fetch titles for favorited posts (limit maybe?)
                     const favoritePostTitles: string[] = [];
                     if (favIds.length > 0) {
                         const favQuery = query(collection(db, 'posts'), where('__name__', 'in', favIds.slice(0, 5))); // Limit to 5 for prompt
                         const favSnapshot = await getDocs(favQuery);
                         favSnapshot.forEach(doc => favoritePostTitles.push(doc.data().title));
                     }

                     // Fetch titles for registered events (limit maybe?)
                     // Needs actual registeredEvents data from previous step
                     const registeredEventTitles = registeredEvents.slice(0, 3).map(e => e.title);

                     const message = await generateWelcomeMessage({
                         studentName: studentData.name,
                         registeredEventTitles: registeredEventTitles, // Pass fetched titles
                         favoritedPostTitles: favoritePostTitles, // Pass fetched titles
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

        if (!loadingProfile && !loadingEvents) { // Wait for profile and registered events data
             fetchFavoritesAndGenerateMessage();
        }
   }, [user, studentData, registeredEvents, loadingProfile, loadingEvents]); // Rerun if dependencies change


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
      // This is a very basic implementation. Real search needs more robust logic (lowercase, indexing, etc.)
      const postsQuery = query(
          collection(db, 'posts'),
          // Firestore doesn't support case-insensitive directly or searching parts of strings easily
          // This will only find exact title matches (or use >= and < for prefix search)
          where('title', '>=', searchTerm),
          where('title', '<=', searchTerm + '\uf8ff'),
          limit(10)
      );
       const eventsQuery = query(
          collection(db, 'events'),
           where('title', '>=', searchTerm),
           where('title', '<=', searchTerm + '\uf8ff'),
          limit(10)
      );

      const [postsSnap, eventsSnap] = await Promise.all([
          getDocs(postsQuery),
          getDocs(eventsQuery)
      ]);

      const postsResults = postsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      const eventsResults = eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));

       // TODO: Apply visibility filtering based on studentData to search results

      setSearchResults({ posts: postsResults, events: eventsResults });

    } catch (error) {
        console.error("Search error:", error);
        // Handle search error
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
        {/* Add important announcements here if needed */}
      </Card>

      {/* Universal Search Bar */}
      <form onSubmit={handleSearch} className="relative">
        <Input
          type="search"
          placeholder="Search posts and events..."
          className="w-full pl-10 pr-4 py-2 text-base border-2"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
         <Button type="submit" className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 px-3" size="sm" disabled={isSearching}>
             {isSearching ? 'Searching...' : 'Search'}
         </Button>
      </form>

      {/* Search Results */}
      {isSearching && <div className="text-center p-4"><LoadingSpinner /> Searching...</div>}
      {searchResults && (
          <Card>
              <CardHeader>
                  <CardTitle>Search Results for "{searchTerm}"</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                  {searchResults.events.length > 0 && (
                      <div>
                          <h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><Calendar className="h-5 w-5" /> Events</h3>
                          <div className="grid gap-4 md:grid-cols-2">
                               {searchResults.events.map(event => (
                                    <EventCard key={event.id} event={event} currentUser={user} currentStudentProfile={studentData} onUpdate={() => handleSearch()} />
                               ))}
                          </div>
                      </div>
                  )}
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
                  {searchResults.events.length === 0 && searchResults.posts.length === 0 && (
                      <p className="text-muted-foreground text-center">No results found.</p>
                  )}
              </CardContent>
          </Card>
      )}

      {/* Events Section */}
      {!searchResults && ( // Hide sections if showing search results
      <Card>
        <CardHeader>
          <CardTitle>Events</CardTitle>
           <CardDescription>Featured and your registered events.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loadingEvents ? (
            <LoadingSpinner />
          ) : (
            <>
              {/* Featured Events */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><Star className="h-5 w-5 text-yellow-500"/> Featured Events</h3>
                {featuredEvents.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {featuredEvents.map(event => (
                      <EventCard key={event.id} event={event} currentUser={user} currentStudentProfile={studentData} onUpdate={() => { /* refetch needed */}} />
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No featured events right now.</p>
                )}
              </div>

              {/* Registered Events - Placeholder until registration logic is fully implemented */}
               {/*
               <div>
                 <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><CalendarCheck className="h-5 w-5 text-green-600"/> Your Registered Events</h3>
                 {registeredEvents.length > 0 ? (
                   <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                     {registeredEvents.map(event => (
                       <EventCard key={event.id} event={event} currentUser={user} currentStudentProfile={studentData} onUpdate={() => {}} />
                     ))}
                   </div>
                 ) : (
                   <p className="text-muted-foreground text-sm">You haven't registered for any upcoming events yet.</p>
                 )}
               </div>
               */}
            </>
          )}
        </CardContent>
      </Card>
      )}

      {/* Recent Posts Section */}
       {!searchResults && ( // Hide sections if showing search results
      <Card>
        <CardHeader>
          <CardTitle>Recent Posts</CardTitle>
          <CardDescription>Latest updates from the community.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPosts ? (
            <LoadingSpinner />
          ) : recentPosts.length > 0 ? (
            <div className="space-y-4">
              {recentPosts.map(post => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-4">No recent posts.</p>
          )}
        </CardContent>
      </Card>
       )}
    </div>
  );
}
