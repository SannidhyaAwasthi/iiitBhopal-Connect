'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarTrigger, SidebarInset, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Home, FileText, Search, Calendar, LogOut, User as UserIcon, ListOrdered, ListPlus, Star, CalendarCheck } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import PostsFeed from './posts-feed';
import LostAndFoundFeed from './LostAndFoundFeed';
import { EventsFeed } from './EventsFeed';
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
  // Return 'U' for User if name is empty or unavailable
  if (!name) return 'U';
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
          // Removed guest user check
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
               scholarNumber: fetchedData.scholarNumber || "N/A",
               email: fetchedData.email || user.email || "N/A",
               branch: fetchedData.branch || 'Unknown',
               yearOfPassing: fetchedData.yearOfPassing || 0,
               programType: fetchedData.programType || 'Undergraduate',
               specialRoles: fetchedData.specialRoles || [],
               phoneNumber: fetchedData.phoneNumber || '',
               uid: fetchedData.uid || user.uid,
               gender: fetchedData.gender || 'Unknown',
           });

        } catch (error: any) {
          console.error("Error fetching student data:", error);
            // Fallback to basic user info if profile fetch fails
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
      }
    };

    fetchStudentData();
  }, [user, toast]);


  // --- Handle Logout ---
  const handleLogout = async () => {
    try {
      await signOut(auth);
       toast({ title: "Logged Out" });
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
        toast({ variant: "destructive", title: "Logout Failed" });
    }
  };

  // Removed isGuest constant

  // --- Render Content based on Active Section ---
  const renderContent = () => {
     if (loadingData) return <LoadingSpinner />;
     if (!user) {
        // Redirect should be handled by page.tsx or similar logic
        return <LoadingSpinner />; // Show spinner while potentially redirecting
     }
      // Check if profile data is missing after loading attempted
      if (!studentData) {
         return <div className="p-4 text-center text-red-500">Failed to load profile data. Please try refreshing.</div>;
     }

    switch (activeSection) {
       case 'home':
         return <div className="text-center py-10 text-xl font-semibold">Homepage Placeholder</div>;
       case 'posts':
         // Pass studentData directly, remove isGuest
         return <PostsFeed setActiveSection={setActiveSection} studentData={studentData} />;
       case 'create-post':
         return <CreatePostForm />; // Allow creation if user exists and profile loaded
       case 'lost-found':
         return <LostAndFoundFeed user={user} studentData={studentData} />;
       case 'events':
          return <EventsFeed user={user} studentData={studentData} />;
       case 'my-posts':
         return <UserPosts user={user} studentData={studentData} />;
       case 'my-events':
          return <UserEvents user={user} studentData={studentData} />;
       case 'my-favorites':
          return <UserFavorites user={user} studentData={studentData} />;
       default:
          return <div className="text-center py-10 text-xl font-semibold">Homepage Placeholder</div>;
    }
  };

   const greeting = studentData ? `${getGreeting()}, ${studentData.name}` : getGreeting();
   const initials = studentData ? getInitials(studentData.name) : 'U'; // Default to 'U' for User

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="p-4 items-center">
           <div className="flex items-center gap-3">
             <Avatar className="h-10 w-10">
               {/* Use initials based on fetched name or 'U' */}
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
                      <SidebarMenuButton onClick={() => setActiveSection('home')} isActive={activeSection === 'home'} tooltip="Home">
                         <Home /> <span>Home</span>
                      </SidebarMenuButton>
                 </SidebarMenuItem>
                 <SidebarMenuItem>
                      <SidebarMenuButton onClick={() => setActiveSection('posts')} isActive={activeSection === 'posts'} tooltip="Posts Feed">
                         <FileText /> <span>Posts</span>
                      </SidebarMenuButton>
                 </SidebarMenuItem>
                 <SidebarMenuItem>
                      <SidebarMenuButton onClick={() => setActiveSection('lost-found')} isActive={activeSection === 'lost-found'} tooltip="Lost & Found">
                         <Search /> <span>Lost & Found</span>
                      </SidebarMenuButton>
                   </SidebarMenuItem>
                   <SidebarMenuItem>
                      <SidebarMenuButton onClick={() => setActiveSection('events')} isActive={activeSection === 'events'} tooltip="Events">
                          <Calendar /> <span>Events</span>
                      </SidebarMenuButton>
                   </SidebarMenuItem>

                   {/* --- User Content Submenu (always show if user is logged in) --- */}
                   {user && (
                     <>
                       <p className="text-xs font-semibold text-sidebar-foreground/60 px-3 pt-4 pb-1">Your Content</p>
                       <SidebarMenuItem>
                           <SidebarMenuButton onClick={() => setActiveSection('my-posts')} isActive={activeSection === 'my-posts'} tooltip="My Posts">
                               <ListOrdered /> <span>My Posts</span>
                           </SidebarMenuButton>
                       </SidebarMenuItem>
                       <SidebarMenuItem>
                           <SidebarMenuButton onClick={() => setActiveSection('my-events')} isActive={activeSection === 'my-events'} tooltip="My Events">
                               <CalendarCheck /> <span>My Events</span>
                           </SidebarMenuButton>
                       </SidebarMenuItem>
                       <SidebarMenuItem>
                           <SidebarMenuButton onClick={() => setActiveSection('my-favorites')} isActive={activeSection === 'my-favorites'} tooltip="My Favorites">
                               <Star /> <span>My Favorites</span>
                           </SidebarMenuButton>
                       </SidebarMenuItem>
                     </>
                   )}
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
           {renderContent()}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
