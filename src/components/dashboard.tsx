'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarTrigger, SidebarInset, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Home, FileText, Search, Calendar, Star, LogOut, Settings, User } from 'lucide-react'; // Removed PlusCircle
import { signOut } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import PostsFeed from './posts-feed'; // Keep this
import LostAndFoundFeed from './lost-found-feed';
import EventsFeed from './events-feed';
import UserPosts from './user-posts';
import UserEvents from './user-events';
import LoadingSpinner from '@/components/loading-spinner';
import type { Student, StudentProfile } from '@/types'; // Import StudentProfile
import { CreatePostForm } from './CreatePostForm'; // Keep this import

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
  const [studentData, setStudentData] = useState<StudentProfile | null>(null); // Use StudentProfile
  // Default active section changed to 'posts'
  const [activeSection, setActiveSection] = useState('posts'); // home, posts, lost-found, events, your-posts, your-events, create-post
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
                 gender: 'Prefer not to say', // Gender is guaranteed by StudentProfile
             });
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
                     // Ensure required fields exist, providing defaults if necessary
                     name: fetchedData.name || user.displayName || "Student",
                     scholarNumber: fetchedData.scholarNumber || "N/A",
                     email: fetchedData.email || user.email || "N/A",
                     branch: fetchedData.branch || 'Unknown',
                     yearOfPassing: fetchedData.yearOfPassing || 0,
                     programType: fetchedData.programType || 'Undergraduate',
                     specialRoles: fetchedData.specialRoles || [],
                     phoneNumber: fetchedData.phoneNumber || '',
                     uid: fetchedData.uid || user.uid, // Ensure UID is present
                     gender: fetchedData.gender || 'Unknown', // Provide default if undefined
                 });
              } else {
                 console.warn("No student document found for scholar number:", scholarNumber);
                 // Fallback to Auth display name if Firestore doc doesn't exist
                 setStudentData({
                    name: user.displayName || "Student",
                    scholarNumber: "N/A", // Indicate missing data
                    email: user.email || "N/A",
                    branch: 'Unknown',
                    yearOfPassing: 0,
                    programType: 'Undergraduate',
                    specialRoles: [],
                    phoneNumber: '',
                    uid: user.uid,
                    gender: 'Prefer not to say',
                 });
              }
            } else {
                console.warn("Scholar number not found in UID map for user:", user.uid);
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
                 });
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
              });
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
            });
             toast({ variant: "destructive", title: "Profile Error", description: "Could not load your profile data." });
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
  }, [user, toast]); // Rerun when user object changes


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
   const isGuest = user?.email === 'guest@iiitbhopal.ac.in' || studentData?.scholarNumber === 'guest';


  const renderContent = () => {
     if (loadingData) {
        return <LoadingSpinner />;
     }
     // Add a check here to ensure studentData is loaded before rendering feeds that depend on it
      // unless it's a guest or the home page
     if (!studentData && !isGuest && activeSection !== 'home') {
         // It's possible studentData fetch failed, show error or different loading state
         return (
            <div className="p-4 text-center text-red-500">
               Failed to load profile data. Cannot display content.
            </div>
         );
     }

    switch (activeSection) {
      case 'home':
        return <div className="text-center py-10 text-xl font-semibold">Homepage Placeholder - Coming Soon!</div>; // Placeholder for home
      case 'posts':
         // Pass setActiveSection for navigation, isGuest for disabling create button
        return (
            <div className="space-y-6">
              <PostsFeed setActiveSection={setActiveSection} isGuest={isGuest} studentData={studentData} />
            </div>
        );
      case 'create-post':
         // Guests should not reach this state via UI controls
         return isGuest ? (
             <p className="p-4 text-center">Guests cannot create posts.</p>
         ) : (
             <CreatePostForm /> // Render the form component
         );
      case 'lost-found':
        return <LostAndFoundFeed user={user} studentData={studentData} />;
      case 'events':
         return <EventsFeed user={user} studentData={studentData} />;
      case 'your-posts':
        // Guests should not reach this state via UI controls
        return isGuest ? (
            <p className="p-4 text-center">Guests do not have posts.</p>
        ) : (
            <UserPosts user={user} studentData={studentData} />
        );
      case 'your-events':
         // Guests should not reach this state via UI controls
         return isGuest ? (
            <p className="p-4 text-center">Guests do not have events.</p>
         ) : (
            <UserEvents user={user} studentData={studentData} />
         );
      default:
         // Default to posts view if section is unknown
         return <PostsFeed setActiveSection={setActiveSection} isGuest={isGuest} studentData={studentData}/>;
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
                {/* Add AvatarImage if you store profile picture URLs */}
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
                      <SidebarMenuButton onClick={() => setActiveSection('posts')} isActive={['posts', 'create-post'].includes(activeSection)} tooltip="Posts">
                         <FileText />
                         <span>Posts</span>
                      </SidebarMenuButton>
                 </SidebarMenuItem>
                  {/* Removed Create Post button */}
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
                 {/* Removed Your Posts button */}
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
