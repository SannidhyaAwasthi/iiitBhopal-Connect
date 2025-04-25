'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarTrigger, SidebarInset, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Home, FileText, Search, Calendar, Star, LogOut, Settings, User } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import PostsFeed from './posts-feed';
import LostAndFoundFeed from './lost-found-feed';
import EventsFeed from './events-feed';
import UserPosts from './user-posts';
import UserEvents from './user-events';
import LoadingSpinner from '@/components/loading-spinner'; // Import LoadingSpinner

type StudentData = {
    name: string;
    scholarNumber: string;
    // Add other fields as needed
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
};

const getInitials = (name: string = '') => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();
};


export default function Dashboard() {
  const { user } = useAuth();
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [activeSection, setActiveSection] = useState('home'); // home, posts, lost-found, events, your-posts, your-events
  const [loadingData, setLoadingData] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const fetchStudentData = async () => {
      if (user && user.email !== 'guest@example.com') { // Don't fetch for guest
        try {
          // Fetch student data using UID from the 'students-by-uid' collection
          // This assumes you have a Firestore collection named 'students-by-uid'
          // where the document ID is the user's UID.
          const userDocRef = doc(db, 'students-by-uid', user.uid);
          const docSnap = await getDoc(userDocRef);

          if (docSnap.exists()) {
             setStudentData(docSnap.data() as StudentData);
          } else {
            console.log("No student document found for user:", user.uid);
             // Fallback to Auth display name if Firestore doc doesn't exist
             setStudentData({ name: user.displayName || "Student", scholarNumber: "N/A" });
          }
        } catch (error) {
          console.error("Error fetching student data:", error);
           // Fallback in case of error
           setStudentData({ name: user.displayName || "Student", scholarNumber: "N/A" });
        } finally {
          setLoadingData(false);
        }
      } else if (user && user.email === 'guest@example.com') {
         // Handle guest user
         setStudentData({ name: "Guest", scholarNumber: "guest" });
         setLoadingData(false);
      } else {
         // No user logged in or still loading auth state
         setLoadingData(false);
      }
    };

    fetchStudentData();
  }, [user]);


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

  const renderContent = () => {
    switch (activeSection) {
      case 'home':
        return <PostsFeed />; // Default to posts feed on home
      case 'posts':
         return <PostsFeed />;
      case 'lost-found':
        return <LostAndFoundFeed />;
      case 'events':
         return <EventsFeed />;
      case 'your-posts':
        return <UserPosts />;
      case 'your-events':
         return <UserEvents />;
      default:
        return <PostsFeed />;
    }
  };

   const greeting = studentData ? `${getGreeting()}, ${studentData.name}` : getGreeting();
   const initials = studentData ? getInitials(studentData.name) : 'G'; // G for Guest

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="p-4 items-center">
           <div className="flex items-center gap-3">
             <Avatar className="h-10 w-10">
                {/* Add AvatarImage if profile picture URL exists */}
               <AvatarFallback>{initials}</AvatarFallback>
             </Avatar>
              <div>
                  <p className="text-sm font-semibold text-sidebar-foreground">{studentData?.name || 'Loading...'}</p>
                  <p className="text-xs text-sidebar-foreground/80">{studentData?.scholarNumber || '...'}</p>
               </div>
           </div>
        </SidebarHeader>
        <SidebarContent className="p-2">
            <SidebarMenu>
                 <SidebarMenuItem>
                      <SidebarMenuButton onClick={() => setActiveSection('home')} isActive={activeSection === 'home'} tooltip="Home">
                         <Home />
                         <span>Home</span>
                      </SidebarMenuButton>
                 </SidebarMenuItem>
                  <SidebarMenuItem>
                      <SidebarMenuButton onClick={() => setActiveSection('posts')} isActive={activeSection === 'posts'} tooltip="Posts">
                         <FileText />
                         <span>Posts</span>
                      </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                      <SidebarMenuButton onClick={() => setActiveSection('lost-found')} isActive={activeSection === 'lost-found'} tooltip="Lost & Found">
                         <Search />
                         <span>Lost & Found</span>
                      </SidebarMenuButton>
                   </SidebarMenuItem>
                   <SidebarMenuItem>
                      <SidebarMenuButton onClick={() => setActiveSection('events')} isActive={activeSection === 'events'} tooltip="Events">
                          <Calendar />
                          <span>Events</span>
                      </SidebarMenuButton>
                   </SidebarMenuItem>
                 <SidebarMenuItem>
                      <SidebarMenuButton onClick={() => setActiveSection('your-posts')} isActive={activeSection === 'your-posts'} tooltip="Your Posts">
                         <User />
                          <span>Your Posts</span>
                      </SidebarMenuButton>
                  </SidebarMenuItem>
                   <SidebarMenuItem>
                      <SidebarMenuButton onClick={() => setActiveSection('your-events')} isActive={activeSection === 'your-events'} tooltip="Your Events">
                         <Star />
                          <span>Your Events</span>
                       </SidebarMenuButton>
                    </SidebarMenuItem>
             </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-2">
           {/* <SidebarMenu>
                <SidebarMenuItem>
                      <SidebarMenuButton tooltip="Settings">
                         <Settings />
                         <span>Settings</span>
                      </SidebarMenuButton>
                 </SidebarMenuItem>
           </SidebarMenu> */}
            <Button variant="ghost" className="w-full justify-start gap-2 text-sidebar-foreground/80 hover:text-sidebar-foreground" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </Button>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
         <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background px-4 sm:justify-end">
           <div className="flex items-center gap-2 sm:hidden"> {/* Show trigger and greeting on small screens */}
             <SidebarTrigger />
             <h1 className="text-lg font-semibold">{greeting}</h1>
           </div>
            <div className="hidden sm:flex items-center gap-4"> {/* Show only greeting on larger screens */}
                <h1 className="text-lg font-semibold">{greeting}</h1>
                {/* Optionally add other header elements here */}
            </div>
            {/* <div className="flex items-center gap-2">
                 <SidebarTrigger className="hidden sm:flex" /> Add trigger for large screens if needed
            </div> */}
         </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
           {loadingData ? <LoadingSpinner /> : renderContent()}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
