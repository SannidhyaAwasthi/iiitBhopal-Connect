'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarTrigger, SidebarInset, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Home, FileText, Search, Calendar, Star, LogOut, Settings, User, PlusCircle } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import PostsFeed from './posts-feed';
import LostAndFoundFeed from './lost-found-feed';
import EventsFeed from './events-feed';
import UserPosts from './user-posts';
import UserEvents from './user-events';
import LoadingSpinner from '@/components/loading-spinner';
import type { Student } from '@/types';
import { CreatePostForm } from './CreatePostForm';

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
};

const getInitials = (name: string = '') => {
  if (!name) return 'G'; // G for Guest or if name is empty
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();
};


export default function Dashboard() {
  const { user } = useAuth();
  const [studentData, setStudentData] = useState<Student | null>(null);
  const [activeSection, setActiveSection] = useState('home'); // home, posts, lost-found, events, your-posts, your-events, create-post
  const [loadingData, setLoadingData] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const fetchStudentData = async () => {
      if (user) {
        setLoadingData(true);
        try {
          // Handle guest user explicitly first
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
             } as Student);
             return; // Exit early for guest
          }

          // Proceed for non-guest users
          const uidMapRef = doc(db, 'students-by-uid', user.uid);
          const uidMapSnap = await getDoc(uidMapRef);

          if (uidMapSnap.exists()) {
            const scholarNumber = uidMapSnap.data()?.scholarNumber;

            if (scholarNumber) {
              const studentDocRef = doc(db, 'students', scholarNumber);
              const studentDocSnap = await getDoc(studentDocRef);

              if (studentDocSnap.exists()) {
                 // Ensure gender is always set, defaulting to 'Unknown' if missing
                 const fetchedData = studentDocSnap.data() as Omit<Student, 'gender'> & { gender?: Student['gender'] };
                 setStudentData({
                     ...fetchedData,
                     gender: fetchedData.gender || 'Unknown', // Provide default if undefined
                 } as Student);
              } else {
                 console.warn("No student document found for scholar number:", scholarNumber);
                 // Fallback to Auth display name if Firestore doc doesn't exist
                 setStudentData({
                    name: user.displayName || "Student",
                    scholarNumber: "N/A",
                    email: user.email || "N/A",
                    branch: 'Unknown',
                    yearOfPassing: 0,
                    programType: 'Undergraduate',
                    specialRoles: [],
                    phoneNumber: '',
                    uid: user.uid,
                    gender: 'Prefer not to say',
                 } as Student);
              }
            } else {
                console.warn("Scholar number not found in UID map for user:", user.uid);
                // Handle case where UID map exists but scholar number is missing
                 setStudentData({
                    name: user.displayName || "Student",
                    scholarNumber: "N/A",
                    email: user.email || "N/A",
                    branch: 'Unknown',
                    yearOfPassing: 0,
                    programType: 'Undergraduate',
                    specialRoles: [],
                    phoneNumber: '',
                    uid: user.uid,
                    gender: 'Prefer not to say',
                 } as Student);
            }
          } else {
             console.warn("No UID map document found for user:", user.uid);
             // Fallback if UID map doesn't exist
              setStudentData({
                name: user.displayName || "Student",
                scholarNumber: "N/A",
                email: user.email || "N/A",
                branch: 'Unknown',
                yearOfPassing: 0,
                programType: 'Undergraduate',
                specialRoles: [],
                phoneNumber: '',
                uid: user.uid,
                gender: 'Prefer not to say',
              } as Student);
          }
        } catch (error) {
          console.error("Error fetching student data:", error);
           // Fallback in case of error
            setStudentData({
                name: user.displayName || "Student",
                scholarNumber: "N/A",
                email: user.email || "N/A",
                branch: 'Unknown',
                yearOfPassing: 0,
                programType: 'Undergraduate',
                specialRoles: [],
                phoneNumber: '',
                uid: user.uid,
                gender: 'Prefer not to say',
            } as Student);
        } finally {
          setLoadingData(false);
        }
      } else {
         // No user logged in or still loading auth state
         setStudentData(null); // Clear data if no user
         setLoadingData(false);
      }
    };

    fetchStudentData();
  }, [user]); // Rerun when user object changes


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

  // Disable create post/event/lost&found for guest user
  const isGuest = user?.email === 'guest@iiitbhopal.ac.in';

  const renderContent = () => {
    switch (activeSection) {
      case 'home':
      case 'posts':
        return (
            <div className="space-y-6">
              <PostsFeed setActiveSection={setActiveSection} isGuest={isGuest}/>
            </div>
        );
      case 'create-post':
         // Guests should not reach this state via UI controls
         return isGuest ? (
             <p>Guests cannot create posts.</p>
         ) : (
             <CreatePostForm />
         );
      case 'lost-found':
        return <LostAndFoundFeed user={user} studentData={studentData} />;
      case 'events':
         return <EventsFeed user={user} studentData={studentData} />;
      case 'your-posts':
        // Guests should not reach this state via UI controls
        return isGuest ? (
            <p>Guests do not have posts.</p>
        ) : (
            <UserPosts user={user} studentData={studentData} />
        );
      case 'your-events':
         // Guests should not reach this state via UI controls
         return isGuest ? (
            <p>Guests do not have events.</p>
         ) : (
            <UserEvents user={user} studentData={studentData} />
         );
      default:
         return <PostsFeed setActiveSection={setActiveSection} isGuest={isGuest}/>; // Default to PostsFeed
    }
  };

   const greeting = studentData ? `${getGreeting()}, ${studentData.name}` : getGreeting();
   const initials = studentData ? getInitials(studentData.name) : 'G';

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="p-4 items-center">
           <div className="flex items-center gap-3">
             <Avatar className="h-10 w-10">
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
                      <SidebarMenuButton onClick={() => setActiveSection('home')} isActive={['home', 'posts'].includes(activeSection)} tooltip="Home">
                         <Home />
                         <span>Home / Posts</span>
                      </SidebarMenuButton>
                 </SidebarMenuItem>
                  {/* Removed explicit Posts Feed button */}
                  <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => setActiveSection('create-post')}
                        isActive={activeSection === 'create-post'}
                        tooltip="Create Post"
                        disabled={isGuest} // Disable for guest
                      >
                         <PlusCircle />
                         <span>Create Post</span>
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
                   {/* TODO: Add Create Lost/Found Item Button (disabled for guest) */}
                   <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => setActiveSection('events')}
                        isActive={activeSection === 'events'}
                        tooltip="Events"
                      >
                          <Calendar />
                          <span>Events</span>
                      </SidebarMenuButton>
                   </SidebarMenuItem>
                   {/* TODO: Add Create Event Button (disabled for guest) */}
                 <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => setActiveSection('your-posts')}
                        isActive={activeSection === 'your-posts'}
                        tooltip="Your Posts"
                        disabled={isGuest} // Disable for guest
                      >
                         <User />
                          <span>Your Posts</span>
                      </SidebarMenuButton>
                  </SidebarMenuItem>
                   <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => setActiveSection('your-events')}
                        isActive={activeSection === 'your-events'}
                        tooltip="Your Events"
                        disabled={isGuest} // Disable for guest
                      >
                         <Star />
                          <span>Your Events</span>
                       </SidebarMenuButton>
                    </SidebarMenuItem>
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
                 {/* Removed the global create button from here */}
            </div>
         </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
           {loadingData ? <LoadingSpinner /> : renderContent()}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
