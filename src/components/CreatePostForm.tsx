import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { db, storage } from '@/config/firebase';
import { collection, doc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import type { Student, VisibilitySettings } from '@/types'; // Import types
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import LoadingSpinner from './loading-spinner';


// Define available options (can be fetched or hardcoded)
const AVAILABLE_BRANCHES = ['CSE', 'IT', 'ECE'];
// Generate years dynamically or hardcode a range
const CURRENT_YEAR = new Date().getFullYear();
const AVAILABLE_YEARS = Array.from({ length: 8 }, (_, i) => CURRENT_YEAR + i - 1); // Example: last year to next 6 years
const AVAILABLE_GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];


export function CreatePostForm() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [studentProfile, setStudentProfile] = useState<Student | null>(null);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [images, setImages] = useState<FileList | null>(null);
    const [visibility, setVisibility] = useState<VisibilitySettings>({
        branches: [],
        yearsOfPassing: [],
        genders: [],
    });
    const [isLoading, setIsLoading] = useState(false);
    const [loadingProfile, setLoadingProfile] = useState(true); // Separate loading state for profile
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

     // Fetch student profile on component mount
     useEffect(() => {
        const fetchStudentData = async () => {
            if (user) {
                 setLoadingProfile(true);
                 setError(null);
                try {
                    const uidMapRef = doc(db, 'students-by-uid', user.uid);
                    const uidMapSnap = await getDoc(uidMapRef);
                    if (!uidMapSnap.exists()) throw new Error("Student UID mapping not found.");

                    const scholarNumber = uidMapSnap.data()?.scholarNumber;
                    if (!scholarNumber) throw new Error("Scholar number not found in mapping.");

                    const studentDocRef = doc(db, 'students', scholarNumber);
                    const studentSnap = await getDoc(studentDocRef);
                    if (!studentSnap.exists()) throw new Error("Student profile not found.");

                    setStudentProfile(studentSnap.data() as Student);
                } catch (err: any) {
                    console.error("Error fetching student profile:", err);
                    setError("Failed to load your profile. Cannot create post.");
                    setStudentProfile(null);
                     toast({ variant: "destructive", title: "Profile Error", description: "Could not load your profile data." });
                } finally {
                     setLoadingProfile(false);
                }
            } else {
                 setLoadingProfile(false);
                 // Optionally redirect or show login message if needed
            }
        };
        fetchStudentData();
    }, [user, toast]);


    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setImages(event.target.files);
             // Basic validation (optional)
             if (event.target.files.length > 5) { // Limit number of images
                 toast({ variant: "destructive", title: "Too many images", description: "Please select up to 5 images." });
                 setImages(null);
                 event.target.value = ''; // Clear the input
             }
        }
    };

     // --- Visibility Handlers ---
    const handleVisibilityChange = (
        type: keyof VisibilitySettings,
        value: string | number,
        isChecked: boolean
    ) => {
        setVisibility(prev => {
            const currentValues = prev[type] as (string | number)[]; // Type assertion
            let newValues: (string | number)[];

             if (isChecked) {
                 newValues = [...currentValues, value];
             } else {
                 newValues = currentValues.filter(v => v !== value);
             }

             // Ensure correct type for numeric arrays (yearsOfPassing)
             if (type === 'yearsOfPassing') {
                 newValues = newValues.map(Number);
             }


            return { ...prev, [type]: newValues };
        });
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setSuccess(null);
        setError(null);

        if (!user || !studentProfile) {
            setError('You must be logged in and profile loaded to create a post.');
             toast({ variant: "destructive", title: "Error", description: "User or profile data missing." });
            return;
        }
        if (!title || !body) {
            setError('Title and body are required.');
            toast({ variant: "destructive", title: "Missing Fields", description: "Please provide a title and body." });
            return;
        }

        setIsLoading(true);

        try {
            // 1. Upload images (if any)
            const imageUrls: string[] = [];
            if (images && images.length > 0) {
                toast({ title: "Uploading Images...", description: `Uploading ${images.length} image(s).` });
                for (const file of Array.from(images)) {
                    const uniqueFileName = `${uuidv4()}-${file.name}`;
                    // Use scholarNumber in path for better organization (optional)
                    const imagePath = `posts/${studentProfile.scholarNumber}/${uniqueFileName}`;
                    const imageRef = ref(storage, imagePath);

                    try {
                        const uploadResult = await uploadBytes(imageRef, file);
                        const downloadURL = await getDownloadURL(uploadResult.ref);
                        imageUrls.push(downloadURL);
                    } catch (uploadError: any) {
                         console.error("Error uploading image:", file.name, uploadError);
                         // Decide how to handle partial upload failures (e.g., continue without image, show error)
                          throw new Error(`Failed to upload image: ${file.name}. ${uploadError.message}`);
                     }
                }
                 toast({ title: "Images Uploaded", description: "Images successfully uploaded." });
            }

            // 2. Prepare tags using fetched studentProfile
            const tags = [
                studentProfile.name.toLowerCase(),
                studentProfile.scholarNumber.toLowerCase(),
                studentProfile.branch.toLowerCase(),
                studentProfile.yearOfPassing.toString(),
                studentProfile.gender.toLowerCase(), // Add gender tag
            ].filter(tag => tag); // Filter out empty strings


             // 3. Create post document
             const postsCollectionRef = collection(db, 'posts');
             await addDoc(postsCollectionRef, {
                 authorId: user.uid,
                 authorName: studentProfile.name, // Use fetched name
                 authorScholarNumber: studentProfile.scholarNumber, // Use fetched scholar number
                 authorBranch: studentProfile.branch, // Use fetched branch
                 authorYearOfPassing: studentProfile.yearOfPassing, // Use fetched year
                 authorGender: studentProfile.gender, // Use fetched gender
                 title: title,
                 body: body,
                 imageUrls: imageUrls.length > 0 ? imageUrls : [], // Use empty array if no images
                 timestamp: serverTimestamp(),
                 upvotesCount: 0,
                 downvotesCount: 0,
                 hotScore: 0,
                 tags: tags,
                 visibility: visibility,
             });


            // Reset form
            setTitle('');
            setBody('');
            setImages(null);
            // Reset file input visually
             const fileInput = document.getElementById('images') as HTMLInputElement;
             if (fileInput) fileInput.value = '';
            setVisibility({ branches: [], yearsOfPassing: [], genders: [] });
            setSuccess('Post created successfully!');
             toast({ title: "Post Created!", description: "Your post is now live." });
            // TODO: Consider triggering a refresh of the posts feed or redirecting

        } catch (err: any) {
            console.error("Error creating post:", err);
            setError(err.message || 'Failed to create post.');
             toast({ variant: "destructive", title: "Post Creation Failed", description: err.message || 'An unexpected error occurred.' });
        } finally {
            setIsLoading(false);
        }
    };


     if (loadingProfile) {
         return <div className="p-4"><LoadingSpinner /> Loading profile...</div>;
     }

     if (error && !studentProfile) { // Show profile loading error prominently
          return (
               <div className="p-4">
                   <Alert variant="destructive">
                       <AlertTitle>Error Loading Profile</AlertTitle>
                       <AlertDescription>{error}</AlertDescription>
                   </Alert>
               </div>
          );
      }

      // Guests should not see the form
      if (user?.email === 'guest@iiitbhopal.ac.in') {
           return (
                <div className="p-4">
                     <Alert>
                          <AlertTitle>Guest Access</AlertTitle>
                          <AlertDescription>Guest users cannot create posts. Please log in with a student account.</AlertDescription>
                     </Alert>
                </div>
           );
       }

       // If profile loaded but user is null (shouldn't happen if profile loaded, but good check)
       if (!user) {
           return <div className="p-4">Please log in to create a post.</div>;
       }

    return (
        <form onSubmit={handleSubmit} className="p-4 border rounded-lg shadow-md space-y-6 bg-card text-card-foreground">
            <h2 className="text-2xl font-semibold mb-4 border-b pb-2">Create New Post</h2>
            {error && !success && ( // Only show error if no success message
                <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
             )}
             {success && (
                 <Alert variant="default" className="bg-green-100 border-green-300 text-green-800 dark:bg-green-900 dark:border-green-700 dark:text-green-200">
                     <AlertTitle>Success!</AlertTitle>
                     <AlertDescription>{success}</AlertDescription>
                 </Alert>
             )}


            <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-medium">Title</Label>
                <Input
                    id="title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="Enter post title..."
                    className="mt-1"
                    disabled={isLoading}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="body" className="text-sm font-medium">Body</Label>
                <Textarea
                    id="body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    required
                    rows={5}
                    placeholder="Write your post content here..."
                    className="mt-1"
                    disabled={isLoading}
                />
            </div>

             <div className="space-y-2">
                 <Label htmlFor="images" className="text-sm font-medium">Images (Optional, max 5)</Label>
                 <Input
                     id="images"
                     type="file"
                     multiple
                     accept="image/*"
                     onChange={handleImageChange}
                     className="mt-1 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-input file:bg-secondary file:text-secondary-foreground hover:file:bg-secondary/80 file:text-sm file:font-medium cursor-pointer"
                     disabled={isLoading}
                 />
                  {/* Simple image count display */}
                  {images && images.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">{images.length} image(s) selected.</p>
                  )}
                  {/* TODO: Add image preview? */}
             </div>

            {/* --- Visibility Settings --- */}
            <div className="space-y-4 border-t pt-4">
                <Label className="block text-sm font-medium mb-2">Post Visibility (Leave unchecked for All)</Label>

                {/* Branches */}
                <div className="space-y-1">
                     <Label className="text-xs font-medium text-muted-foreground">Branches:</Label>
                     <div className="flex flex-wrap gap-x-4 gap-y-2">
                         {AVAILABLE_BRANCHES.map(branch => (
                             <div key={branch} className="flex items-center space-x-2">
                                 <Checkbox
                                     id={`vis-branch-${branch}`}
                                     checked={visibility.branches.includes(branch)}
                                     onCheckedChange={(checked) => handleVisibilityChange('branches', branch, !!checked)}
                                     disabled={isLoading}
                                 />
                                 <Label htmlFor={`vis-branch-${branch}`} className="text-sm font-normal cursor-pointer">{branch}</Label>
                             </div>
                         ))}
                     </div>
                 </div>

                 {/* Years of Passing */}
                <div className="space-y-1">
                     <Label className="text-xs font-medium text-muted-foreground">Years of Passing:</Label>
                     <div className="flex flex-wrap gap-x-4 gap-y-2">
                         {AVAILABLE_YEARS.map(year => (
                             <div key={year} className="flex items-center space-x-2">
                                 <Checkbox
                                     id={`vis-year-${year}`}
                                     checked={visibility.yearsOfPassing.includes(year)}
                                     onCheckedChange={(checked) => handleVisibilityChange('yearsOfPassing', year, !!checked)}
                                     disabled={isLoading}
                                 />
                                 <Label htmlFor={`vis-year-${year}`} className="text-sm font-normal cursor-pointer">{year}</Label>
                             </div>
                         ))}
                     </div>
                 </div>

                 {/* Genders */}
                 <div className="space-y-1">
                     <Label className="text-xs font-medium text-muted-foreground">Genders:</Label>
                     <div className="flex flex-wrap gap-x-4 gap-y-2">
                         {AVAILABLE_GENDERS.map(gender => (
                             <div key={gender} className="flex items-center space-x-2">
                                 <Checkbox
                                     id={`vis-gender-${gender.replace(/\s+/g, '-')}`} // Create safe ID
                                     checked={visibility.genders.includes(gender)}
                                     onCheckedChange={(checked) => handleVisibilityChange('genders', gender, !!checked)}
                                     disabled={isLoading}
                                 />
                                 <Label htmlFor={`vis-gender-${gender.replace(/\s+/g, '-')}`} className="text-sm font-normal cursor-pointer">{gender}</Label>
                             </div>
                         ))}
                     </div>
                 </div>
            </div>


            <Button
                type="submit"
                disabled={isLoading || loadingProfile} // Disable if loading profile or submitting
                className="w-full"
            >
                {isLoading ? (
                     <>
                         <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                         Creating...
                     </>
                 ) : 'Create Post'}
            </Button>
        </form>
    );
}

// Basic Loader Icon (replace with lucide if preferred)
function Loader2(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
