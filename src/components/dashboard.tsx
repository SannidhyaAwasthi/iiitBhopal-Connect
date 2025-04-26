'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarTrigger, SidebarInset, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Home, FileText, Search, Calendar, LogOut, User as UserIcon, ListOrdered, Star, CalendarCheck } from 'lucide-react'; // Removed ListPlus, added CalendarCheck
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
import { CreatePostForm } from './CreatePostForm'; // Keep this if needed elsewhere

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
};

const getInitials = (name: string = '') => {
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

  // --- Render Content based on Active Section ---
  const renderContent = () => {
     if (loadingData) return <LoadingSpinner />;
     if (!user) {
        return <LoadingSpinner />;
     }
      if (!studentData) {
         return <div className="p-4 text-center text-red-500">Failed to load profile data. Please try refreshing.</div>;
     }

    switch (activeSection) {
       case 'home':
         return <div className="text-center py-10 text-xl font-semibold">Homepage Placeholder</div>;
       case 'posts':
         // Pass studentData and setActiveSection
         return <PostsFeed setActiveSection={setActiveSection} studentData={studentData} />;
       case 'create-post': // This case might be handled within PostsFeed now
         return <CreatePostForm />;
       case 'lost-found':
         return <LostAndFoundFeed user={user} studentData={studentData} />;
       case 'events':
          // Pass setActiveSection to EventsFeed
          return <EventsFeed user={user} studentData={studentData} setActiveSection={setActiveSection} />;
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
   const initials = studentData ? getInitials(studentData.name) : 'U';

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

                   {/* --- User Content Submenu --- */}
                   {user && (
                     <>
                       <p className="text-xs font-semibold text-sidebar-foreground/60 px-3 pt-4 pb-1">Your Content</p>
                       {/* Your Posts Button removed from here */}
                       <SidebarMenuItem>
                           <SidebarMenuButton onClick={() => setActiveSection('my-events')} isActive={activeSection === 'my-events'} tooltip="My Events">
                               <CalendarCheck /> <span>My Events</span>
                           </SidebarMenuButton>
                       </SidebarMenuItem>
                       {/* Favorites Button removed from here */}
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
