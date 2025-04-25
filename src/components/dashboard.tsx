'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarTrigger, SidebarInset, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Home, FileText, Search, Calendar, LogOut, User as UserIcon } from 'lucide-react'; // Keep Search icon for L&F
import { signOut } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import PostsFeed from './posts-feed';
import LostAndFoundFeed from './LostAndFoundFeed'; // Ensure correct casing
import EventsFeed from './events-feed';
import UserPosts from './user-posts';
import UserEvents from './user-events';
import UserFavorites from './user-favorites';
import LoadingSpinner from '@/components/loading-spinner';
import type { StudentProfile } from '@/types';
import { CreatePostForm } from './CreatePostForm';

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
};

const getInitials = (name: string = '') => {
  if (!name) return 'G';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();
};


export default function Dashboard() {
  const { user } = useAuth();
  const [studentData, setStudentData] = useState<StudentProfile | null>(null);
  const [activeSection, setActiveSection] = useState('home'); // Start with home
  const [loadingData, setLoadingData] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  // --- Fetch Student Data ---
  useEffect(() => {
    const fetchStudentData = async () => {
      if (user) {
        setLoadingData(true);
        try {
          // Handle guest user explicitly
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
             });
             return; // Exit early for guest
          }

          // Proceed for logged-in, non-guest users
          const uidMapRef = doc(db, 'students-by-uid', user.uid);
          const uidMapSnap = await getDoc(uidMapRef);

          if (!uidMapSnap.exists()) throw new Error("Student UID mapping not found.");

          const scholarNumber = uidMapSnap.data()?.scholarNumber;
          if (!scholarNumber) throw new Error("Scholar number not found in mapping.");

          const studentDocRef = doc(db, 'students', scholarNumber);
          const studentDocSnap = await getDoc(studentDocRef);

          if (!studentDocSnap.exists()) throw new Error(`Student profile not found for scholar number: ${scholarNumber}`);

          // Ensure gender exists, providing a default if necessary
           const fetchedData = studentDocSnap.data() as Omit<StudentProfile, 'gender'> & { gender?: StudentProfile['gender'] };
           setStudentData({
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
               gender: fetchedData.gender || 'Unknown', // Default gender if missing
           });

        } catch (error: any) {
          console.error("Error fetching student data:", error);
           // Set fallback data on error for logged-in users
            setStudentData({
                name: user.displayName || "Student",
                scholarNumber: "N/A", email: user.email || "N/A",
                branch: 'Unknown', yearOfPassing: 0, programType: 'Undergraduate',
                specialRoles: [], phoneNumber: '', uid: user.uid, gender: 'Unknown',
            });
             toast({ variant: "destructive", title: "Profile Error", description: `Could not load your profile data. ${error.message}` });
        } finally {
          setLoadingData(false);
        }
      } else {
         // Clear data if user logs out
         setStudentData(null);
         setLoadingData(false);
      }
    };

    fetchStudentData();
  }, [user, toast]);


  // --- Handle Logout ---
  const handleLogout = async () => {
    try {
      await signOut(auth);
       toast({ title: "Logged Out", description: "You have been successfully logged out." });
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
        toast({ variant: "destructive", title: "Logout Failed", description: "Could not log out." });
    }
  };

  const isGuest = user?.email === 'guest@iiitbhopal.ac.in';


  // --- Render Content based on Active Section ---
  const renderContent = () => {
     // Show loading spinner while fetching user or student data
     if (loadingData) {
        return <LoadingSpinner />;
     }

     // Redirect to login if not loading and no user (this should ideally be caught by page.tsx, but good safeguard)
     if (!user) {
        router.push('/login'); // Redirect if somehow user is null after loading
        return <LoadingSpinner />; // Show spinner during redirect
     }

      // Handle case where profile data failed to load for a non-guest user
      if (!isGuest && !studentData) {
         return (
             <div className="p-4 text-center text-red-500">
                 Failed to load profile data. Please try refreshing the page or contact support.
             </div>
         );
     }

    switch (activeSection) {
       case 'home':
         return <div className="text-center py-10 text-xl font-semibold">Homepage Placeholder - Content Coming Soon!</div>;
       case 'posts':
         // Pass necessary props to PostsFeed
         return <PostsFeed setActiveSection={setActiveSection} isGuest={isGuest} studentData={studentData} />;
       case 'create-post':
         return isGuest ? (
             <p className="p-4 text-center">Guests cannot create posts.</p>
         ) : (
             // Redirect back to posts feed if trying to access create-post directly?
             // Or just render the form directly if that's intended.
             <CreatePostForm /> // Render the form component
         );
       case 'lost-found':
         // Replace placeholder with the actual LostAndFoundFeed component
         return <LostAndFoundFeed user={user} studentData={studentData} />;
       case 'events':
          return <EventsFeed user={user} studentData={studentData} />;
       case 'your-posts':
         return isGuest ? (
             <p className="p-4 text-center">Guests do not have posts.</p>
         ) : (
             <UserPosts user={user} studentData={studentData} />
         );
       case 'your-events':
          return isGuest ? (
             <p className="p-4 text-center">Guests do not have events.</p>
          ) : (
             <UserEvents user={user} studentData={studentData} />
          );
       case 'your-favorites':
          return isGuest ? (
             <p className="p-4 text-center">Guests do not have favorites.</p>
          ) : (
             <UserFavorites user={user} studentData={studentData} />
          );
       default:
          // Default back to home if section is unknown
          return <div className="text-center py-10 text-xl font-semibold">Homepage Placeholder - Content Coming Soon!</div>;
    }
  };

   const greeting = studentData ? `${getGreeting()}, ${studentData.name}` : getGreeting();
   const initials = studentData ? getInitials(studentData.name) : 'G';

  // --- Main Component Return ---
  // The structure seems correct, focusing on ensuring all imports and components are standard
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="p-4 items-center">
           <div className="flex items-center gap-3">
             <Avatar className="h-10 w-10">
               {/* Optionally add AvatarImage if you store profile picture URLs */}
               <AvatarFallback>{initials}</AvatarFallback>
             </Avatar>
              <div>
                  <p className="text-sm font-semibold text-sidebar-foreground">{studentData?.name || (loadingData ? 'Loading...' : 'User')}</p>
                  <p className="text-xs text-sidebar-foreground/80">{studentData?.scholarNumber || '...'}</p>
               </div>
           </div>
        </SidebarHeader>
        <SidebarContent className="p-2">
            <SidebarMenu>
                 {/* Home Button */}
                 <SidebarMenuItem>
                      <SidebarMenuButton onClick={() => setActiveSection('home')} isActive={activeSection === 'home'} tooltip="Home">
                         <Home />
                         <span>Home</span>
                      </SidebarMenuButton>
                 </SidebarMenuItem>
                 {/* Posts Feed Button */}
                 <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => setActiveSection('posts')}
                        // Keep active if viewing posts, creating post, your posts, or favorites
                        isActive={['posts', 'create-post', 'your-posts', 'your-favorites'].includes(activeSection)}
                        tooltip="Posts Feed"
                      >
                         <FileText />
                         <span>Posts</span>
                      </SidebarMenuButton>
                 </SidebarMenuItem>
                 {/* Lost & Found Button */}
                  <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => setActiveSection('lost-found')}
                        isActive={activeSection === 'lost-found'}
                        tooltip="Lost & Found"
                      >
                         <Search />
                         <span>Lost & Found</span>
                      </SidebarMenuButton>
                   </SidebarMenuItem>
                   {/* Events Button */}
                   <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => setActiveSection('events')}
                        // Keep active if viewing events or user's events
                        isActive={['events', 'your-events'].includes(activeSection)}
                        tooltip="Events"
                      >
                          <Calendar />
                          <span>Events</span>
                      </SidebarMenuButton>
                   </SidebarMenuItem>
                  {/* Add other primary navigation items here if needed */}
             </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-2">
            {/* Logout Button */}
            <Button variant="ghost" className="w-full justify-start gap-2 text-sidebar-foreground/80 hover:text-sidebar-foreground" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </Button>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
         {/* Header inside the main content area */}
         <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background px-4 sm:justify-end">
           {/* Mobile: Trigger + Greeting */}
           <div className="flex items-center gap-2 sm:hidden">
             <SidebarTrigger />
             <h1 className="text-lg font-semibold">{greeting}</h1>
           </div>
           {/* Desktop: Greeting only */}
            <div className="hidden sm:flex items-center gap-4">
                <h1 className="text-lg font-semibold">{greeting}</h1>
                {/* Optionally add other header elements for desktop here */}
            </div>
         </header>
        {/* Main Content Area */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
           {renderContent()}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
