'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/config/firebase';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import type { StudentProfile, Event, Post } from '@/types';
import LoadingSpinner from '@/components/loading-spinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from "@/components/ui/scroll-area";
import { EventCard } from '@/components/EventCard';
import { PostCard } from '@/components/PostCard';
import { Calendar, FileText } from 'lucide-react';
import { generateWelcomeMessage } from '@/ai/flows/generate-welcome-message';
import { getFavoritePostIds, getPostsVoteStatus } from '@/lib/postActions';
import { fetchEvents, getEventsRegistrationStatus } from '@/lib/eventActions'; // Import modified fetchEvents


export default function HomePageContent() {
  const { user } = useAuth();
  const [studentData, setStudentData] = useState<StudentProfile | null>(null);
  const [welcomeMessage, setWelcomeMessage] = useState<string | null>(null);
  const [featuredEvents, setFeaturedEvents] = useState<Event[]>([]);
  const [recentPosts, setRecentPosts] = useState<Post[]>([]);
  const [favoritePostIds, setFavoritePostIds] = useState<string[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingWelcome, setLoadingWelcome] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);

  // --- Fetch Student Profile ---
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
                    setStudentData(null);
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

    // --- Fetch Favorites ---
    useEffect(() => {
        const fetchFavorites = async () => {
            if (user) {
                try {
                    const favIds = await getFavoritePostIds(user.uid);
                    setFavoritePostIds(favIds);
                    console.log("[HomePage] Fetched favorite post IDs:", favIds);
                } catch (error) {
                    console.error("Error fetching favorite post IDs:", error);
                    setFavoritePostIds([]);
                }
            } else {
                setFavoritePostIds([]);
            }
        };
        if (!loadingProfile) {
             fetchFavorites();
        }
    }, [user, loadingProfile]);

  // --- Fetch Events and Recent Posts ---
  useEffect(() => {
      const fetchData = async () => {
           if (user && loadingProfile) {
               console.log("[HomePage] Waiting for profile data...");
               return;
           }

          console.log("[HomePage] Fetching Events and Posts...");
          setLoadingEvents(true);
          setLoadingPosts(true);

          try {
              // --- Fetch Events (passing user profile for visibility and UID for enrichment) ---
              const allVisibleEvents = await fetchEvents(studentData, user?.uid);
              const upcomingEvents = allVisibleEvents
                  .filter(e => e.startTime && e.startTime.toDate() > new Date())
                  .sort((a, b) => (a.startTime?.toMillis() ?? 0) - (b.startTime?.toMillis() ?? 0));
              setFeaturedEvents(upcomingEvents.slice(0, 5));
              console.log("[HomePage] Featured events fetched and enriched:", featuredEvents.length);

               // --- Fetch Posts ---
               const postsQuery = query(
                   collection(db, 'posts'),
                   orderBy('timestamp', 'desc'),
                   limit(3)
               );
               const postsSnapshot = await getDocs(postsQuery);
               let recentBasePosts = postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
               console.log("[HomePage] Base recent posts fetched:", recentBasePosts.length);

               const visiblePosts = recentBasePosts.filter(post => {
                   if (!studentData) {
                       return !post.visibility || ((post.visibility.branches?.length ?? 0) === 0 && (post.visibility.yearsOfPassing?.length ?? 0) === 0 && (post.visibility.genders?.length ?? 0) === 0);
                   }
                   const visibility = post.visibility;
                   if (!visibility) return true;
                   const isBranchVisible = (visibility.branches?.length ?? 0) === 0 || visibility.branches?.includes(studentData.branch);
                   const isYearVisible = (visibility.yearsOfPassing?.length ?? 0) === 0 || visibility.yearsOfPassing?.includes(studentData.yearOfPassing);
                   const isGenderVisible = (visibility.genders?.length ?? 0) === 0 || visibility.genders?.includes(studentData.gender);
                   return isBranchVisible && isYearVisible && isGenderVisible;
               });
               console.log("[HomePage] Visible recent posts count:", visiblePosts.length);

                let enrichedRecentPosts: Post[];
                if (user && visiblePosts.length > 0) {
                    const postIds = visiblePosts.map(p => p.id);
                    console.log("[HomePage] Fetching vote statuses for recent posts:", postIds);
                    const voteStatuses = await getPostsVoteStatus(user.uid, postIds);
                    console.log("[HomePage] Vote statuses received for recent posts:", JSON.stringify(voteStatuses));

                    enrichedRecentPosts = visiblePosts.map(post => ({
                        ...post,
                        userVote: voteStatuses[post.id] ?? null,
                        isFavorite: favoritePostIds.includes(post.id)
                    }));
                } else {
                    enrichedRecentPosts = visiblePosts.map(post => ({
                         ...post,
                         userVote: null,
                         isFavorite: false
                    }));
                }
               console.log("[HomePage] Enriched recent posts ready.");
               setRecentPosts(enrichedRecentPosts);

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
  }, [studentData, loadingProfile, user, favoritePostIds]);

  // --- Generate Welcome Message ---
   useEffect(() => {
        const generateAndSetWelcomeMessage = async () => {
             if ((user && !studentData) || loadingEvents) {
                 console.log("[HomePage] Welcome message waiting...");
                 return;
             }

             console.log("[HomePage] Generating welcome message...");
             setLoadingWelcome(true);
             try {
                 if (user && studentData) {
                     const favoritePostTitles: string[] = [];
                      if (favoritePostIds.length > 0) {
                          const favQuery = query(collection(db, 'posts'), where('__name__', 'in', favoritePostIds.slice(0, 10)));
                          const favSnapshot = await getDocs(favQuery);
                          favSnapshot.forEach(doc => favoritePostTitles.push(doc.data().title));
                      }
                     const eventTitlesForPrompt = featuredEvents.slice(0, 3).map(e => e.title);

                     const message = await generateWelcomeMessage({
                         studentName: studentData.name || 'Student',
                         registeredEventTitles: eventTitlesForPrompt,
                         favoritedPostTitles: favoritePostTitles,
                     });
                     setWelcomeMessage(message.welcomeMessage);
                     console.log("[HomePage] Personalized welcome message generated.");
                 } else {
                     setWelcomeMessage("Welcome to IIIT Bhopal Connect!");
                     console.log("[HomePage] Generic welcome message set.");
                 }
             } catch (error) {
                 console.error("Error generating welcome message:", error);
                 setWelcomeMessage(`Welcome back, ${studentData?.name || 'Student'}!`); // Fallback
             } finally {
                 setLoadingWelcome(false);
             }
        };

         if (!loadingProfile && !loadingEvents) {
            generateAndSetWelcomeMessage();
         }
   }, [user, studentData, featuredEvents, favoritePostIds, loadingProfile, loadingEvents]);


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

      {/* Universal Search Bar REMOVED */}

      {/* Main Content Area */}
      <div className="flex flex-col md:flex-row gap-8">

        {/* Left Side - Recent Posts */}
        <div className="w-full md:w-2/3 space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Notices</CardTitle>
                  <CardDescription>Latest updates from the community.</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingPosts ? (
                    <div className="text-center py-4"><LoadingSpinner /></div>
                  ) : recentPosts.length > 0 ? (
                    <ScrollArea className="w-full whitespace-nowrap pb-4">
                         <div className="flex w-max space-x-4">
                           {recentPosts.map(post => (
                             <div key={post.id} className="w-72 flex-shrink-0 h-full">
                                <PostCard post={post} />
                             </div>
                           ))}
                         </div>
                    </ScrollArea>
                  ) : (
                    <p className="text-muted-foreground text-sm text-center py-4">No recent posts to display.</p>
                  )}
                </CardContent>
              </Card>
        </div>

         {/* Right Side - Featured Events */}
         <div className="w-full md:w-1/3 space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle>Featured Events</CardTitle>
                   <CardDescription>Upcoming campus activities.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                   {loadingEvents ? (
                       <div className="text-center py-4"><LoadingSpinner /></div>
                   ) : (
                       <ScrollArea className="h-96 pr-4">
                          <div className="space-y-4">
                             {featuredEvents.length > 0 ? (
                                 featuredEvents.map(event => (
                                     <EventCard
                                         key={event.id}
                                         event={event} // Pass enriched event
                                         currentUser={user}
                                         currentStudentProfile={studentData}
                                         onUpdate={() => {
                                             // Reload events or update state if necessary after interactions
                                            // For now, just a placeholder
                                         }}
                                    />
                                 ))
                             ) : (
                                 <p className="text-muted-foreground text-sm text-center py-4">
                                     No featured events right now.
                                 </p>
                             )}
                          </div>
                      </ScrollArea>
                   )}
                </CardContent>
              </Card>
         </div>
      </div>
    </div>
  );
}
