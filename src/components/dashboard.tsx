'use client';

import { useState, useEffect, useCallback } from 'react'; // Added useCallback
import { useAuth } from '@/hooks/use-auth';
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
import type { StudentProfile } from '@/types'; // Import StudentProfile type

// Import section components directly
import PostsFeed from './posts-feed';
import LostAndFoundFeed from './LostAndFoundFeed';
import { EventsFeed } from './EventsFeed';
import UserProfile from './UserProfile';
import UserPosts from './user-posts';
import UserFavorites from './user-favorites';
import UserEvents from './user-events';
import { CreatePostForm } from './CreatePostForm';
import HomePageContent from '../app/home/page'; // Assuming this path is correct

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
export default function Dashboard({ children }: { children?: React.ReactNode }) { // Default export and accept children
  const { user, loading: isAuthLoading } = useAuth();
  const [studentData, setStudentData] = useState<StudentProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('home'); // Default to 'home'
  const [displayGreeting, setDisplayGreeting] = useState('');
  const router = useRouter();
  const { toast } = useToast();

  // --- Fetch Student Data Callback ---
  const fetchStudentData = useCallback(async (forceRefresh = false) => {
      // Only fetch if auth is loaded AND user exists.
      if (!isAuthLoading && user) {
        if (!forceRefresh && studentData && !loadingProfile) {
             console.log("[Dashboard fetchStudentData] Profile data exists and not forced refresh, skipping fetch.");
             return;
        }

        console.log(`[Dashboard fetchStudentData] Fetching profile for user (${user.uid}). Force refresh: ${forceRefresh}`);
        setLoadingProfile(true);
        // Don't clear existing data immediately on refresh unless forced without prior data
        // if (forceRefresh || !studentData) {
        //     setStudentData(null);
        // }

        try {
          const uidMapRef = doc(db, 'students-by-uid', user.uid);
          const uidMapSnap = await getDoc(uidMapRef);
          if (!uidMapSnap.exists()) throw new Error("Student UID mapping not found.");
          const scholarNumber = uidMapSnap.data()?.scholarNumber;
          if (!scholarNumber) throw new Error("Scholar number not found in mapping.");
          const studentDocRef = doc(db, 'students', scholarNumber);
          const studentDocSnap = await getDoc(studentDocRef);
          if (!studentDocSnap.exists()) throw new Error(`Student profile not found: ${scholarNumber}`);

           const fetchedData = studentDocSnap.data() as Omit<StudentProfile, 'gender'> & { gender?: StudentProfile['gender'], resumeUrl?: string | null }; // Include resumeUrl
            setStudentData({
                ...fetchedData,
                name: fetchedData.name || user.displayName || "Student",
                scholarNumber: fetchedData.scholarNumber || "N/A", email: fetchedData.email || user.email || "N/A",
                branch: fetchedData.branch || 'Unknown', yearOfPassing: fetchedData.yearOfPassing || 0, programType: fetchedData.programType || 'Undergraduate',
                specialRoles: fetchedData.specialRoles || [], phoneNumber: fetchedData.phoneNumber || '', uid: user.uid, gender: fetchedData.gender || 'Unknown',
                resumeUrl: fetchedData.resumeUrl || null, // Add resumeUrl
            });
            console.log("[Dashboard fetchStudentData] Profile fetched successfully.");
        } catch (error: any) {
          console.error("[Dashboard fetchStudentData] Error fetching student data:", error);
            // Provide a fallback profile structure on error
             setStudentData({
                name: user.displayName || "Student",
                scholarNumber: "N/A", email: user.email || "N/A",
                branch: 'Error', yearOfPassing: 0, programType: 'Unknown',
                specialRoles: [], phoneNumber: '', uid: user.uid, gender: 'Unknown',
                resumeUrl: null, // Default resumeUrl to null on error
            });
             toast({ variant: "destructive", title: "Profile Error", description: `Could not load your profile data. ${error.message}` });
        } finally {
          setLoadingProfile(false);
        }
      } else if (!isAuthLoading && user === null) {
        // If auth is loaded but user is null, clear data
        console.log("[Dashboard fetchStudentData] Auth loaded, user is null. Clearing profile data.");
        setStudentData(null);
        setLoadingProfile(false);
      }
  }, [isAuthLoading, user, toast, studentData, loadingProfile]); // Add studentData and loadingProfile as dependencies


  // --- Effect for Client-Side Greeting ---
  useEffect(() => {
    setDisplayGreeting(getGreeting());
  }, []);

  // --- Effect for Redirecting if Logged Out ---
  useEffect(() => {
    if (!isAuthLoading && user === null) {
      console.log("[Dashboard Effect] Auth loaded, user is null. Redirecting to /login...");
      router.push('/login');
    }
  }, [isAuthLoading, user, router]);

  // --- Effect for Initial Profile Fetch ---
  useEffect(() => {
    fetchStudentData(); // Initial fetch when component mounts or user changes
  }, [fetchStudentData]); // Depend on the memoized fetch function

  // --- Handle Logout ---
  const handleLogout = async () => {
    console.log("handleLogout: Attempting sign out...");
    try {
      await signOut(auth);
      toast({ title: "Logged Out" });
      setActiveSection('home'); // Reset section on logout
      setStudentData(null); // Clear student data immediately
      // Redirect is handled by the [isAuthLoading, user, router] effect
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
  if (isAuthLoading) {
    console.log("[Render] Auth is loading. Showing full-page spinner.");
    return <div className="flex items-center justify-center h-screen"><LoadingSpinner /></div>;
  }

  if (user === null) {
    console.log("[Render] Auth loaded: User is null. Showing spinner while redirecting...");
    // Render children directly if needed for login/signup pages (though redirect should handle it)
    // return children || <div className="flex items-center justify-center h-screen"><LoadingSpinner /></div>;
     return <div className="flex items-center justify-center h-screen"><LoadingSpinner /></div>;
  }


  console.log(`[Render] Auth loaded: User is logged in (${user.uid}). Rendering dashboard layout. Active Section: ${activeSection}`);
  const headerText = displayGreeting && studentData
       ? `${displayGreeting}, ${studentData.name}`
       : displayGreeting || 'Welcome';
  const initials = !loadingProfile && studentData ? getInitials(studentData.name) : '?';


   // Function to render the active section content
   const renderContent = () => {
    // Show profile loading spinner if profile is still loading after auth
    if (loadingProfile) {
        return <LoadingSpinner />;
    }
    // Show error if profile loading failed
    if (!studentData) {
        return <div className="p-4 text-center text-red-500">Failed to load profile data. Please try refreshing.</div>;
    }

    // Render the active section component, passing necessary props
    switch (activeSection) {
        case 'home': return <HomePageContent />;
        // Pass onUpdate callback to UserProfile
        case 'profile': return <UserProfile user={user} studentData={studentData} onUpdate={() => fetchStudentData(true)} />;
        case 'posts': return <PostsFeed setActiveSection={setActiveSection} studentData={studentData} />;
        case 'lost-found': return <LostAndFoundFeed user={user} studentData={studentData} />;
        case 'events': return <EventsFeed user={user} studentData={studentData} setActiveSection={setActiveSection} />;
        case 'my-posts': return <UserPosts user={user} studentData={studentData} />;
        case 'my-favorites': return <UserFavorites user={user} studentData={studentData} />;
        case 'my-events': return <UserEvents user={user} studentData={studentData} />;
        case 'create-post': return <CreatePostForm />;
        default:
             console.warn(`[Dashboard Render] Unknown active section: ${activeSection}. Defaulting to home.`);
             return <HomePageContent />;
    }
  };


  // Ensure structure and syntax are correct before the return statement
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
             {renderContent()}
              {/* Render children passed from layout only if no specific section is active (or adjust logic) */}
             {/* {activeSection === 'none' && children} */}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}