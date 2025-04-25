import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth'; // Assuming you have this hook
import { db, storage } from '@/config/firebase'; // Assuming firebase is initialized here
import { collection, doc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid'; // For unique file names

// Assuming Student type from your prompt's description (adjust if needed to match src/types/index.ts)
interface StudentProfile {
    name: string;
    scholarNumber: string;
    branch: string;
    yearOfPassing: number;
    gender: string; // Assuming gender exists in the profile
    // Add other fields if needed
}

interface VisibilitySettings {
    branches: string[];
    yearsOfPassing: number[];
    genders: string[];
}

export function CreatePostForm() {
    const { user } = useAuth();
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [images, setImages] = useState<FileList | null>(null);
    const [visibility, setVisibility] = useState<VisibilitySettings>({
        branches: [],
        yearsOfPassing: [],
        genders: [],
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);


    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setImages(event.target.files);
        }
    };

    // Add functions here to handle visibility changes based on your UI (e.g., checkboxes, multi-selects)
    // You will need to define the UI elements for selecting branches, years, and genders.
    // Example handler (you'll need to implement the UI):
    // const handleBranchChange = (branch: string, isChecked: boolean) => {
    //     setVisibility(prev => {
    //         const newBranches = isChecked
    //             ? [...prev.branches, branch]
    //             : prev.branches.filter(b => b !== branch);
    //         return { ...prev, branches: newBranches };
    //     });
    // };
    // Similarly for years and genders.


    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setSuccess(null); // Clear previous success messages
        if (!user || !title || !body) {
            setError('Title and body are required.');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // 1. Fetch author details
            const studentDocRef = doc(db, 'students-by-uid', user.uid);
            const studentSnap = await getDoc(studentDocRef);

            if (!studentSnap.exists()) {
                throw new Error('Student profile not found. Cannot create post.');
            }
            const studentData = studentSnap.data() as StudentProfile; // Cast to your profile type

            // 2. Upload images (if any)
            const imageUrls: string[] = [];
            if (images) {
                for (const file of Array.from(images)) {
                    const uniqueFileName = `${uuidv4()}-${file.name}`;
                    const imageRef = ref(storage, `posts/${user.uid}/${uniqueFileName}`);
                    const uploadResult = await uploadBytes(imageRef, file);
                    const downloadURL = await getDownloadURL(uploadResult.ref);
                    imageUrls.push(downloadURL);
                }
            }

            // 3. Prepare tags
            // Include relevant student profile data for search/filtering
            const tags = [
                studentData.name.toLowerCase(), // Add lowercased name for case-insensitive search
                studentData.scholarNumber.toLowerCase(), // Add lowercased scholar number
                studentData.branch.toLowerCase(), // Add lowercased branch
                studentData.yearOfPassing.toString(), // Ensure years are strings if used in tags
                 // Add any other relevant tags you want to be searchable
            ].filter(tag => tag); // Filter out empty strings


             // 4. Create post document
             const postsCollectionRef = collection(db, 'posts');
             await addDoc(postsCollectionRef, {
                 authorId: user.uid,
                 authorName: studentData.name, // Denormalized name
                 authorScholarNumber: studentData.scholarNumber, // Denormalized for easier access if needed
                 authorBranch: studentData.branch, // Denormalized
                 authorYearOfPassing: studentData.yearOfPassing, // Denormalized
                 authorGender: studentData.gender, // Denormalized
                 title: title,
                 body: body,
                 imageUrls: imageUrls.length > 0 ? imageUrls : undefined, // Only include if images exist
                 timestamp: serverTimestamp(),
                 upvotesCount: 0,
                 downvotesCount: 0,
                 hotScore: 0, // Initialize hotScore (you'll need a mechanism to update this, e.g., Cloud Function)
                 tags: tags,
                 visibility: visibility,
                 // Add other fields from your prompt's schema if necessary
             });


            // Reset form
            setTitle('');
setBody('');
setImages(null);
setVisibility({ branches: [], yearsOfPassing: [], genders: [] });
setSuccess('Post created successfully!');
// Consider triggering a refresh of the posts feed if it's visible on the same page
// or redirecting the user.

        } catch (err: any) {
            console.error("Error creating post:", err);
            setError(err.message || 'Failed to create post.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="p-4 border rounded-md shadow-sm space-y-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            <h2 className="text-2xl font-bold mb-4">Create New Post</h2>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            {success && <p className="text-green-500 text-sm">{success}</p>}


            <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Title:</label>
                <input
                    id="title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
            </div>

            <div>
                <label htmlFor="body" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Body:</label>
                <textarea
                    id="body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    required
                    rows={4}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
            </div>

             <div>
                 <label htmlFor="images" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Images (Optional):</label>
                 <input
                     id="images"
                     type="file"
                     multiple
                     accept="image/*"
                     onChange={handleImageChange}
                     className="mt-1 block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900 file:text-blue-700 dark:file:text-blue-200 hover:file:bg-blue-100 dark:hover:file:bg-blue-800"
                 />
                  {/* TODO: Add image preview */}
             </div>

            {/* Add UI elements for setting visibility based on branches, years, genders */}
            {/* You will need to fetch the available options for these fields and render checkboxes or multi-selects */}
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Visibility (Leave empty for All):</label>
                <div className="mt-2 space-y-2">
                     {/* Placeholder for visibility controls - Replace with actual UI */}
                     <p className="text-sm text-gray-500 dark:text-gray-400">Implement UI for selecting visible Branches, Years, and Genders here.</p>
                     {/* Example structure for Branches (similarly for Years and Genders): */}
                     {/* <div className="flex items-center">
                         <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">Branches:</span>
                         {['CSE', 'IT', 'ECE'].map(branch => ( // Replace with actual branches
                             <label key={branch} className="inline-flex items-center mr-4">
                                 <input
                                     type="checkbox"
                                     value={branch}
                                     checked={visibility.branches.includes(branch)}
                                     onChange={(e) => handleBranchChange(branch, e.target.checked)}
                                     className="form-checkbox h-4 w-4 text-blue-600"
                                 />
                                 <span className="ml-1 text-gray-600 dark:text-gray-300">{branch}</span>
                             </label>
                         ))}
                     </div> */}
                </div>
            </div>


            <button
                type="submit"
                disabled={isLoading}
                className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800`}
            >
                {isLoading ? 'Creating...' : 'Create Post'}
            </button>
        </form>
    );
}
