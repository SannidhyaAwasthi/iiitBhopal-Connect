
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
import { useRouter, usePathname } from 'next/navigation'; // Import usePathname
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/loading-spinner';
import type { StudentProfile } from '@/types';

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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [studentData, setStudentData] = useState<StudentProfile | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const router = useRouter();
  const pathname = usePathname(); // Get current path
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

  // --- Navigation Handler ---
  const handleNavigate = (path: string) => {
      router.push(path);
  };

  // Determine active section based on pathname
  const getActiveSection = () => {
      if (pathname?.startsWith('/home')) return 'home';
      if (pathname?.startsWith('/profile')) return 'profile';
      if (pathname?.startsWith('/posts')) return 'posts';
      if (pathname?.startsWith('/lost-found')) return 'lost-found';
      if (pathname?.startsWith('/events')) return 'events';
      if (pathname?.startsWith('/my-posts')) return 'my-posts'; // Note: This route doesn't exist yet, handled within /posts
      if (pathname?.startsWith('/my-events')) return 'my-events'; // Note: This route doesn't exist yet, handled within /events
      if (pathname?.startsWith('/my-favorites')) return 'my-favorites'; // Note: This route doesn't exist yet, handled within /posts
      // Add other sections as needed
      return 'home'; // Default to home
  };
  const activeSection = getActiveSection();


   const greeting = studentData ? `${getGreeting()}, ${studentData.name}` : getGreeting();
   const initials = studentData ? getInitials(studentData.name) : '?';

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
                      <SidebarMenuButton onClick={() => handleNavigate('/home')} isActive={activeSection === 'home'} tooltip="Home">
                         <Home /> <span>Home</span>
                      </SidebarMenuButton>
                 </SidebarMenuItem>
                 <SidebarMenuItem>
                     <SidebarMenuButton onClick={() => handleNavigate('/profile')} isActive={activeSection === 'profile'} tooltip="My Profile">
                         <UserIconLucide /> <span>Profile</span>
                     </SidebarMenuButton>
                 </SidebarMenuItem>
                 <SidebarMenuItem>
                      <SidebarMenuButton onClick={() => handleNavigate('/posts')} isActive={activeSection === 'posts'} tooltip="Posts Feed">
                         <FileText /> <span>Posts</span>
                      </SidebarMenuButton>
                 </SidebarMenuItem>
                 <SidebarMenuItem>
                      <SidebarMenuButton onClick={() => handleNavigate('/lost-found')} isActive={activeSection === 'lost-found'} tooltip="Lost & Found">
                         <Search /> <span>Lost & Found</span>
                      </SidebarMenuButton>
                   </SidebarMenuItem>
                   <SidebarMenuItem>
                      <SidebarMenuButton onClick={() => handleNavigate('/events')} isActive={activeSection === 'events'} tooltip="Events">
                          <Calendar /> <span>Events</span>
                      </SidebarMenuButton>
                   </SidebarMenuItem>

                  {/* --- User Content Submenu --- */}
                  {/* Keep these, but they might navigate to subsections within main routes or dedicated routes if complex */}
                  {/* For now, they navigate to the main section */}
                  <>
                    <p className="text-xs font-semibold text-sidebar-foreground/60 px-3 pt-4 pb-1">Your Content</p>
                    <SidebarMenuItem>
                        {/* My Posts might live within /posts with a filter */}
                        <SidebarMenuButton onClick={() => handleNavigate('/posts?filter=myPosts')} isActive={pathname?.includes('filter=myPosts')} tooltip="My Posts">
                            <ListOrdered /> <span>My Posts</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                         {/* My Events might live within /events with a filter */}
                        <SidebarMenuButton onClick={() => handleNavigate('/events?filter=myEvents')} isActive={pathname?.includes('filter=myEvents')} tooltip="My Events">
                            <CalendarCheck /> <span>My Events</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                     <SidebarMenuItem>
                           {/* My Favorites might live within /posts with a filter */}
                         <SidebarMenuButton onClick={() => handleNavigate('/posts?filter=favorites')} isActive={pathname?.includes('filter=favorites')} tooltip="My Favorites">
                             <Star /> <span>My Favorites</span>
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
           {/* Render the currently active route's content */}
           {loadingData && user ? <LoadingSpinner /> : children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
