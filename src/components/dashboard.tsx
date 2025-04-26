
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarTrigger, SidebarInset, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Home, FileText, Search, Calendar, LogOut, User as UserIconLucide, ListOrdered, ListPlus, Star, CalendarCheck } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { useRouter } from 'next/navigation'; // No need for usePathname here
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/loading-spinner';
import type { StudentProfile } from '@/types';

// Import section components directly
import PostsFeed from './posts-feed';
import LostAndFoundFeed from './LostAndFoundFeed'; // Corrected import casing
import { EventsFeed } from './EventsFeed'; // Use named import if it's not default
import UserProfile from './UserProfile';
import UserPosts from './user-posts'; // Import UserPosts
import UserFavorites from './user-favorites'; // Import UserFavorites
import UserEvents from './user-events'; // Import UserEvents
import { CreatePostForm } from './CreatePostForm'; // Import CreatePostForm
import HomePageContent from '../app/home/page'; // Import the HomePage content component

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

export default function Dashboard({
  children, // Keep children prop for potential future use, though not directly used for section switching now
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [studentData, setStudentData] = useState<StudentProfile | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [activeSection, setActiveSection] = useState<string>('home'); // Default to 'home'
  const router = useRouter();
  const { toast } = useToast();

  // --- Fetch Student Data ---
  useEffect(() => {
    const fetchStudentData = async () => {
      if (user) {
        setLoadingData(true);
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
        } catch (error: any) {
          console.error("Error fetching student data:", error);
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
         setStudentData(null);
         setLoadingData(false);
         // Redirect to login if user becomes null (logged out) while on dashboard
         router.push('/login');
      }
    };

    fetchStudentData();
  }, [user, toast, router]); // Added router dependency

  // --- Handle Logout ---
  const handleLogout = async () => {
    try {
      await signOut(auth);
       toast({ title: "Logged Out" });
      setActiveSection('home'); // Reset section on logout
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
        toast({ variant: "destructive", title: "Logout Failed" });
    }
  };

  // --- Navigation Handler ---
  const handleNavigate = (section: string) => {
      setActiveSection(section);
      // Maybe update URL hash for bookmarking? e.g., router.push(`/#${section}`);
  };

  // --- Render Content Based on Active Section ---
   const renderContent = () => {
     if (loadingData && user) {
       return <LoadingSpinner />;
     }

     switch (activeSection) {
       case 'home':
         return <HomePageContent />; // Use the imported component
       case 'profile':
         return <UserProfile user={user} studentData={studentData} />;
       case 'posts':
         return <PostsFeed setActiveSection={setActiveSection} studentData={studentData} />;
       case 'lost-found':
         return <LostAndFoundFeed user={user} studentData={studentData} />;
       case 'events':
         // Pass setActiveSection if needed by EventsFeed
         return <EventsFeed user={user} studentData={studentData} setActiveSection={setActiveSection} />;
       case 'my-posts':
         return <UserPosts user={user} studentData={studentData} />;
       case 'my-favorites':
         return <UserFavorites user={user} studentData={studentData} />;
       case 'my-events':
         return <UserEvents user={user} studentData={studentData} />;
       case 'create-post':
            return <CreatePostForm />; // Render create post form
       default:
         return <HomePageContent />; // Fallback to home
     }
   };


   const greeting = studentData ? `${getGreeting()}, ${studentData.name}` : getGreeting();
   const initials = studentData ? getInitials(studentData.name) : '?';

  // Render the dashboard structure
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="p-4 items-center">
           <div className="flex items-center gap-3">
             <Avatar className="h-10 w-10">
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
                 {/* --- Main Navigation --- */}
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
                         <FileText /> <span>Posts</span>
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

                  {/* --- Your Content Submenu (Triggers section change) --- */}
                  <>
                    <p className="text-xs font-semibold text-sidebar-foreground/60 px-3 pt-4 pb-1">Your Content</p>
                    <SidebarMenuItem>
                        <SidebarMenuButton onClick={() => handleNavigate('my-posts')} isActive={activeSection === 'my-posts'} tooltip="My Posts">
                            <ListOrdered /> <span>My Posts</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                     <SidebarMenuItem>
                        <SidebarMenuButton onClick={() => handleNavigate('my-favorites')} isActive={activeSection === 'my-favorites'} tooltip="My Favorites">
                            <Star /> <span>My Favorites</span>
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
             <h1 className="text-lg font-semibold">{greeting}</h1>
           </div>
            <div className="hidden sm:flex items-center gap-4">
                <h1 className="text-lg font-semibold">{greeting}</h1>
            </div>
         </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
           {/* Render the currently active section's content */}
           {renderContent()}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

    