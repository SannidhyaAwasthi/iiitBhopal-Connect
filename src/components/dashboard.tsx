'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth'; // Correctly imports the hook returning { user, loading }
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarTrigger, SidebarInset, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Home, FileText, Search, Calendar, LogOut, User as UserIconLucide, ListOrdered, ListPlus, Star, CalendarCheck } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/loading-spinner';
import type { StudentProfile } from '@/types';

// Import section components directly
import PostsFeed from './posts-feed';
import LostAndFoundFeed from './LostAndFoundFeed';
import { EventsFeed } from './EventsFeed';
import UserProfile from './UserProfile';
import UserPosts from './user-posts';
import UserFavorites from './user-favorites';
import UserEvents from './user-events';
import { CreatePostForm } from './CreatePostForm';
import HomePageContent from '../app/home/page';

// --- Utility Functions --- 
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
};

const getInitials = (name: string = '') => {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();
};

// --- Dashboard Component --- 
export default function Dashboard() {
  // Correctly destructure user and loading state from the auth context
  const { user, loading: isAuthLoading } = useAuth(); 
  
  const [studentData, setStudentData] = useState<StudentProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false); // Specifically for student profile loading
  const [activeSection, setActiveSection] = useState<string>('home');
  const [displayGreeting, setDisplayGreeting] = useState('');
  const router = useRouter();
  const { toast } = useToast();

  // --- Effect for Client-Side Greeting --- 
  useEffect(() => {
    setDisplayGreeting(getGreeting());
  }, []);

  // --- Effect for Redirecting if Logged Out (AFTER auth check) --- 
  useEffect(() => {
    // Only redirect if auth has finished loading (isAuthLoading is false) AND user is null.
    if (!isAuthLoading && user === null) {
      console.log("[Dashboard Effect] Auth loaded, user is null. Redirecting to /login...");
      router.push('/login');
    }
  }, [isAuthLoading, user, router]);

  // --- Effect for Fetching Student Data (only runs when logged in) ---
  useEffect(() => {
    const fetchStudentData = async () => {
      // Only fetch if auth is loaded AND user exists.
      if (!isAuthLoading && user) {
        console.log(`[Dashboard Effect] Auth loaded, user logged in (${user.uid}). Fetching profile...`);
        setLoadingProfile(true);
        setStudentData(null); 
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
            setStudentData({
                ...fetchedData,
                name: fetchedData.name || user.displayName || "Student",
                scholarNumber: fetchedData.scholarNumber || "N/A", email: fetchedData.email || user.email || "N/A",
                branch: fetchedData.branch || 'Unknown', yearOfPassing: fetchedData.yearOfPassing || 0, programType: fetchedData.programType || 'Undergraduate',
                specialRoles: fetchedData.specialRoles || [], phoneNumber: fetchedData.phoneNumber || '', uid: user.uid, gender: fetchedData.gender || 'Unknown',
            });
            console.log("[Dashboard Effect] Profile fetched successfully.");
        } catch (error: any) {
          console.error("[Dashboard Effect] Error fetching student data:", error);
            setStudentData({
                name: user.displayName || "Student",
                scholarNumber: "N/A", email: user.email || "N/A",
                branch: 'Error', yearOfPassing: 0, programType: 'Unknown',
                specialRoles: [], phoneNumber: '', uid: user.uid, gender: 'Unknown',
            });
             toast({ variant: "destructive", title: "Profile Error", description: `Could not load your profile data. ${error.message}` });
        } finally {
          setLoadingProfile(false);
        }
      } else if (!isAuthLoading && user === null) {
        // If auth is loaded but user is null, clear data (though redirect should be happening)
        console.log("[Dashboard Effect] Auth loaded, user is null. Ensuring profile data is cleared.");
        setStudentData(null);
        setLoadingProfile(false);
      }
    };

    fetchStudentData();
    // Rerun if auth loading state changes OR if the user object changes
  }, [isAuthLoading, user, toast]);

  // --- Handle Logout ---
  const handleLogout = async () => {
    console.log("handleLogout: Attempting sign out...");
    try {
      await signOut(auth);
      toast({ title: "Logged Out" });
      // Redirect is handled by the [isAuthLoading, user, router] effect when user becomes null
      console.log("handleLogout: Sign out successful.");
    } catch (error) {
      console.error('handleLogout: Logout error:', error);
      toast({ variant: "destructive", title: "Logout Failed" });
    }
  };

  // --- Navigation Handler ---
  const handleNavigate = (section: string) => {
      setActiveSection(section);
  };

  // --- Render Logic ---

  // 1. Show full-page spinner ONLY while the initial auth state is loading.
  if (isAuthLoading) {
    console.log("[Render] Auth is loading. Showing full-page spinner.");
    return <div className="flex items-center justify-center h-screen"><LoadingSpinner /></div>;
  }

  // 2. If auth is loaded but user is null, the redirect effect is handling it.
  // Render a spinner here too, as the redirect might take a moment.
  if (user === null) {
    console.log("[Render] Auth loaded: User is null. Showing spinner while redirecting...");
    return <div className="flex items-center justify-center h-screen"><LoadingSpinner /></div>;
  }

  // 3. If we reach here, auth is loaded and user exists.
  console.log(`[Render] Auth loaded: User is logged in (${user.uid}). Rendering dashboard layout.`);
  const headerText = displayGreeting && studentData
       ? `${displayGreeting}, ${studentData.name}`
       : displayGreeting || 'Welcome';
  // Show profile loading state based on `loadingProfile`
  const initials = !loadingProfile && studentData ? getInitials(studentData.name) : '?'; 

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="p-4 items-center">
           <div className="flex items-center gap-3">
             <Avatar className="h-10 w-10">
               <AvatarFallback>{loadingProfile ? '...' : initials}</AvatarFallback>
             </Avatar>
              <div>
                  <p className="text-sm font-semibold text-sidebar-foreground">{loadingProfile ? 'Loading Profile...' : (studentData?.name || 'User')}</p>
                  <p className="text-xs text-sidebar-foreground/80">{loadingProfile ? '...' : (studentData?.scholarNumber || 'N/A')}</p>
               </div>
           </div>
        </SidebarHeader>

        <SidebarContent className="p-2">
            <SidebarMenu>
                 {/* Navigation Items */}
                 <SidebarMenuItem>
                      <SidebarMenuButton onClick={() => handleNavigate('home')} isActive={activeSection === 'home'} tooltip="Home">
                         <Home /> <span>Home</span>
                      </SidebarMenuButton>
                 </SidebarMenuItem>
                 <SidebarMenuItem>
                     <SidebarMenuButton onClick={() => handleNavigate('profile')} isActive={activeSection === 'profile'} tooltip="My Profile">
                         <UserIconLucide /> <span>Profile</span>
                     </SidebarMenuButton>
                 </SidebarMenuItem>
                 <SidebarMenuItem>
                      <SidebarMenuButton onClick={() => handleNavigate('posts')} isActive={activeSection === 'posts'} tooltip="Posts Feed">
                         <FileText /> <span>Notices</span>
                      </SidebarMenuButton>
                 </SidebarMenuItem>
                 <SidebarMenuItem>
                      <SidebarMenuButton onClick={() => handleNavigate('lost-found')} isActive={activeSection === 'lost-found'} tooltip="Lost & Found">
                         <Search /> <span>Lost & Found</span>
                      </SidebarMenuButton>
                   </SidebarMenuItem>
                   <SidebarMenuItem>
                      <SidebarMenuButton onClick={() => handleNavigate('events')} isActive={activeSection === 'events'} tooltip="Events">
                          <Calendar /> <span>Events</span>
                      </SidebarMenuButton>
                   </SidebarMenuItem>
                  {/* Your Content Submenu */} 
                  <>
                    <p className="text-xs font-semibold text-sidebar-foreground/60 px-3 pt-4 pb-1">Your Content</p>
                    <SidebarMenuItem>
                        <SidebarMenuButton onClick={() => handleNavigate('my-posts')} isActive={activeSection === 'my-posts'} tooltip="My Posts">
                            <ListOrdered /> <span>My Notices</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                     <SidebarMenuItem>
                        <SidebarMenuButton onClick={() => handleNavigate('my-favorites')} isActive={activeSection === 'my-favorites'} tooltip="My Favorites">
                            <Star /> <span>My Pinned Notices</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton onClick={() => handleNavigate('my-events')} isActive={activeSection === 'my-events'} tooltip="My Events">
                            <CalendarCheck /> <span>My Events</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                  </>
             </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="p-2">
            <Button variant="ghost" className="w-full justify-start gap-2 text-sidebar-foreground/80 hover:text-sidebar-foreground" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </Button>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
         <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background px-4 sm:justify-end">
           <div className="flex items-center gap-2 sm:hidden">
             <SidebarTrigger />
             <h1 className="text-lg font-semibold">{headerText}</h1>
           </div>
            <div className="hidden sm:flex items-center gap-4">
                <h1 className="text-lg font-semibold">{headerText}</h1>
            </div>
         </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
           {/* Render spinner if profile is loading, error if failed, or active section */}
           {loadingProfile ? (
               <LoadingSpinner />
            ) : !studentData ? (
               // This case means auth succeeded, but profile fetch failed or hasn't completed (should be covered by loadingProfile)
               <div className="p-4 text-center text-red-500">Failed to load profile data. Please try refreshing.</div>
            ) : (
                // Render the active section component
                (() => {
                    console.log(`[Render] Rendering active section: ${activeSection}`);
                    switch (activeSection) {
                        case 'home': return <HomePageContent />;
                        case 'profile': return <UserProfile user={user} studentData={studentData} />;
                        case 'posts': return <PostsFeed setActiveSection={setActiveSection} studentData={studentData} />;
                        case 'lost-found': return <LostAndFoundFeed user={user} studentData={studentData} />;
                        case 'events': return <EventsFeed user={user} studentData={studentData} setActiveSection={setActiveSection} />;
                        case 'my-posts': return <UserPosts user={user} studentData={studentData} />;
                        case 'my-favorites': return <UserFavorites user={user} studentData={studentData} />;
                        case 'my-events': return <UserEvents user={user} studentData={studentData} />;
                        case 'create-post': return <CreatePostForm />;
                        default: return <HomePageContent />;
                    }
                })()
            )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
