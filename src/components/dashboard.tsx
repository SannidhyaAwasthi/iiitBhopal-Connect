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
import LostAndFoundFeed from './lost-found-feed'; // Correct import name
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
  const [activeSection, setActiveSection] = useState('posts'); // Default to 'posts'
  const [loadingData, setLoadingData] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const fetchStudentData = async () => {
      if (user) {
        setLoadingData(true);
        try {
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
             return;
          }

          const uidMapRef = doc(db, 'students-by-uid', user.uid);
          const uidMapSnap = await getDoc(uidMapRef);

          if (uidMapSnap.exists()) {
            const scholarNumber = uidMapSnap.data()?.scholarNumber;

            if (scholarNumber) {
              const studentDocRef = doc(db, 'students', scholarNumber);
              const studentDocSnap = await getDoc(studentDocRef);

              if (studentDocSnap.exists()) {
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
              } else {
                 console.warn("No student document found for scholar number:", scholarNumber);
                 // Set default/fallback data if student doc is missing
                 setStudentData({
                    name: user.displayName || "Student",
                    scholarNumber: scholarNumber, // Use scholar number from map if available
                    email: user.email || "N/A",
                    branch: 'Unknown', yearOfPassing: 0, programType: 'Undergraduate',
                    specialRoles: [], phoneNumber: '', uid: user.uid, gender: 'Unknown',
                 });
              }
            } else {
                console.warn("Scholar number not found in UID map for user:", user.uid);
                // Set default/fallback data if mapping is missing scholar number
                 setStudentData({
                    name: user.displayName || "Student",
                    scholarNumber: "N/A", email: user.email || "N/A",
                    branch: 'Unknown', yearOfPassing: 0, programType: 'Undergraduate',
                    specialRoles: [], phoneNumber: '', uid: user.uid, gender: 'Unknown',
                 });
            }
          } else {
             console.warn("No UID map document found for user:", user.uid);
             // Set default/fallback data if UID map is missing
              setStudentData({
                name: user.displayName || "Student",
                scholarNumber: "N/A", email: user.email || "N/A",
                branch: 'Unknown', yearOfPassing: 0, programType: 'Undergraduate',
                specialRoles: [], phoneNumber: '', uid: user.uid, gender: 'Unknown',
              });
          }
        } catch (error) {
          console.error("Error fetching student data:", error);
          // Set default/fallback data on error
            setStudentData({
                name: user.displayName || "Student",
                scholarNumber: "N/A", email: user.email || "N/A",
                branch: 'Unknown', yearOfPassing: 0, programType: 'Undergraduate',
                specialRoles: [], phoneNumber: '', uid: user.uid, gender: 'Unknown',
            });
             toast({ variant: "destructive", title: "Profile Error", description: "Could not load your profile data." });
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


  const renderContent = () => {
     // Show loading spinner while fetching user or student data
     if (loadingData) {
        return <LoadingSpinner />;
     }

      // Handle case where profile data failed to load for a non-guest user
      if (!isGuest && user && !studentData) {
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
         return <PostsFeed isGuest={isGuest} studentData={studentData} />;
       case 'create-post':
         return isGuest ? (
             <p className="p-4 text-center">Guests cannot create posts.</p>
         ) : (
             <CreatePostForm /> // Render the form component
         );
       case 'lost-found':
         // Pass user and studentData to LostAndFoundFeed
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
          // Default back to posts if section is unknown
          return <PostsFeed isGuest={isGuest} studentData={studentData}/>;
    }
  };

   const greeting = studentData ? `${getGreeting()}, ${studentData.name}` : getGreeting();
   const initials = studentData ? getInitials(studentData.name) : 'G';

  // Ensure structure and syntax are correct before the return statement
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
                 <SidebarMenuItem>
                      <SidebarMenuButton onClick={() => setActiveSection('home')} isActive={activeSection === 'home'} tooltip="Home">
                         <Home />
                         <span>Home</span>
                      </SidebarMenuButton>
                 </SidebarMenuItem>
                 <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => setActiveSection('posts')}
                        isActive={['posts', 'create-post', 'your-posts', 'your-favorites'].includes(activeSection)}
                        tooltip="Posts Feed"
                      >
                         <FileText />
                         <span>Posts</span>
                      </SidebarMenuButton>
                 </SidebarMenuItem>
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
                   <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => setActiveSection('events')}
                        isActive={['events', 'your-events'].includes(activeSection)}
                        tooltip="Events"
                      >
                          <Calendar />
                          <span>Events</span>
                      </SidebarMenuButton>
                   </SidebarMenuItem>
                  {/* Add other menu items here if needed */}
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
           <div className="flex items-center gap-2 sm:hidden"> {/* Show trigger and greeting on small screens */}
             <SidebarTrigger />
             <h1 className="text-lg font-semibold">{greeting}</h1>
           </div>
            <div className="hidden sm:flex items-center gap-4"> {/* Show only greeting on larger screens */}
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
