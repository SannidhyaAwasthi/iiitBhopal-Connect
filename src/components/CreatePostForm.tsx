import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { db, storage } from '@/config/firebase';
import { collection, doc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import type { Student, StudentProfile, VisibilitySettings, Gender } from '@/types'; // Import types including StudentProfile
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import LoadingSpinner from './loading-spinner';
import { Loader2 } from 'lucide-react'; // Import Loader2


// Define available options (can be fetched or hardcoded)
const AVAILABLE_BRANCHES = ['CSE', 'IT', 'ECE'];
// Generate years dynamically or hardcode a range
const CURRENT_YEAR = new Date().getFullYear();
const AVAILABLE_YEARS = Array.from({ length: 8 }, (_, i) => CURRENT_YEAR + i - 1); // Example: last year to next 6 years
// Use the Gender type for available genders
const AVAILABLE_GENDERS: Gender[] = ['Male', 'Female', 'Other', 'Prefer not to say'];


export function CreatePostForm() {
    const { user } = useAuth();
    const { toast } = useToast();
    // Use the more specific StudentProfile type which ensures gender exists
    const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
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
                    // Removed guest user check

                    // Proceed for logged-in users
                    const uidMapRef = doc(db, 'students-by-uid', user.uid);
                    const uidMapSnap = await getDoc(uidMapRef);
                    if (!uidMapSnap.exists()) throw new Error("Student UID mapping not found.");

                    const scholarNumber = uidMapSnap.data()?.scholarNumber;
                    if (!scholarNumber) throw new Error("Scholar number not found in mapping.");

                    const studentDocRef = doc(db, 'students', scholarNumber);
                    const studentSnap = await getDoc(studentDocRef);
                    if (!studentSnap.exists()) throw new Error("Student profile not found.");

                    // Ensure gender exists, providing a default if necessary
                    const fetchedData = studentSnap.data() as Student; // Assume it matches Student initially
                    const profileData: StudentProfile = {
                      ...fetchedData,
                      gender: fetchedData.gender || 'Unknown', // Provide default if missing
                    };
                    setStudentProfile(profileData);

                } catch (err: any) {
                    console.error("Error fetching student profile:", err);
                    setError("Failed to load your profile. Cannot create post. Reason: " + err.message);
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

        if (!user) { // Simplified check
            setError('You must be logged in to create a post.');
            toast({ variant: "destructive", title: "Not Logged In", description: "Please log in." });
            return;
        }
        if (!title || !body) {
            setError('Title and body are required.');
            toast({ variant: "destructive", title: "Missing Fields", description: "Please provide a title and body." });
            return;
        }
        if (!studentProfile) { // Check if profile has loaded
            setError('Student profile is not loaded yet. Please wait or try refreshing.');
            toast({ variant: "destructive", title: "Profile Not Loaded", description: "Profile data is unavailable." });
            return;
        }

         // **Critical Check**: Ensure all required fields for tags exist before proceeding
         if (!studentProfile.name || !studentProfile.scholarNumber || !studentProfile.branch || typeof studentProfile.yearOfPassing !== 'number' || !studentProfile.gender) {
             const missingFields = [
                 !studentProfile.name && 'name',
                 !studentProfile.scholarNumber && 'scholar number',
                 !studentProfile.branch && 'branch',
                 typeof studentProfile.yearOfPassing !== 'number' && 'year of passing',
                 !studentProfile.gender && 'gender',
             ].filter(Boolean).join(', ');

             setError(`Profile data is incomplete (missing: ${missingFields}). Cannot create post.`);
             toast({ variant: "destructive", title: "Profile Error", description: `Incomplete profile data (missing: ${missingFields}).` });
             setIsLoading(false); // Ensure loading stops
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
                    // Use user.uid in path for better security and alignment with rules
                    const imagePath = `posts/${user.uid}/${uniqueFileName}`;
                    const imageRef = ref(storage, imagePath);

                    try {
                        console.log(`Attempting to upload image to: ${imagePath}`);
                        const uploadResult = await uploadBytes(imageRef, file);
                        const downloadURL = await getDownloadURL(uploadResult.ref);
                        imageUrls.push(downloadURL);
                        console.log(`Successfully uploaded ${file.name} to ${downloadURL}`);
                    } catch (uploadError: any) {
                         console.error("Error uploading image:", file.name, uploadError);
                          // Provide more specific feedback based on the error code
                          if (uploadError.code === 'storage/unauthorized') {
                             setError(`Permission denied: You don't have permission to upload images. Please check Storage Rules.`);
                             toast({ variant: "destructive", title: "Upload Failed", description: "Permission denied to upload image." });
                          } else {
                             setError(`Failed to upload image: ${file.name}. ${uploadError.message}`);
                             toast({ variant: "destructive", title: "Upload Failed", description: `Error uploading ${file.name}.` });
                          }
                         // Stop the entire post creation if an image fails to upload
                         setIsLoading(false);
                         return;
                     }
                }
                 toast({ title: "Images Uploaded", description: "Images successfully uploaded." });
            }

            // 2. Prepare tags using fetched studentProfile (already validated above)
            // Now safe to use toLowerCase() as fields are confirmed to exist
            const tags = [
                studentProfile.name.toLowerCase(),
                studentProfile.scholarNumber.toLowerCase(),
                studentProfile.branch.toLowerCase(),
                studentProfile.yearOfPassing.toString(),
                studentProfile.gender.toLowerCase(), // gender is now guaranteed to exist
            ].filter(tag => !!tag); // Filter out any potential empty strings just in case


             // 3. Create post document
             const postsCollectionRef = collection(db, 'posts');
             await addDoc(postsCollectionRef, {
                 authorId: user.uid,
                 authorName: studentProfile.name,
                 authorScholarNumber: studentProfile.scholarNumber,
                 authorBranch: studentProfile.branch,
                 authorYearOfPassing: studentProfile.yearOfPassing,
                 authorGender: studentProfile.gender,
                 title: title,
                 body: body,
                 imageUrls: imageUrls.length > 0 ? imageUrls : [],
                 timestamp: serverTimestamp(),
                 upvotesCount: 0,
                 downvotesCount: 0,
                 hotScore: 0, // Initialize hotScore, calculate later if needed
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
             // Avoid overwriting specific upload errors if they were already set
             if (!error) {
                setError(err.message || 'Failed to create post.');
                toast({ variant: "destructive", title: "Post Creation Failed", description: err.message || 'An unexpected error occurred.' });
             }
        } finally {
            setIsLoading(false);
        }
    };


     if (loadingProfile) {
         return <div className="p-4"><LoadingSpinner /> Loading profile...</div>;
     }

     if (error && !studentProfile && user) { // Show profile loading error prominently if user exists
          return (
               <div className="p-4">
                   <Alert variant="destructive">
                       <AlertTitle>Error Loading Profile</AlertTitle>
                       <AlertDescription>{error}</AlertDescription>
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
