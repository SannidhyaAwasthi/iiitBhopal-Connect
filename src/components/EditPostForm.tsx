import { useState, useEffect, useCallback, type FC } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/config/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import type { Post, VisibilitySettings } from '@/types'; // Import Post and VisibilitySettings types

// Define available options (reuse from CreatePostForm or define centrally)
const AVAILABLE_BRANCHES = ['CSE', 'IT', 'ECE'];
const CURRENT_YEAR = new Date().getFullYear();
const AVAILABLE_YEARS = Array.from({ length: 8 }, (_, i) => CURRENT_YEAR + i - 1);
const AVAILABLE_GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];


interface EditPostFormProps {
    post: Post | null; // The post to edit
    isOpen: boolean;
    onClose: (refresh?: boolean) => void; // Callback to close the dialog, optional refresh flag
}

export const EditPostForm: FC<EditPostFormProps> = ({ post, isOpen, onClose }) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [visibility, setVisibility] = useState<VisibilitySettings>({
        branches: [],
        yearsOfPassing: [],
        genders: [],
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Populate form when post data changes (and dialog opens)
    useEffect(() => {
        if (post) {
            setTitle(post.title || '');
            setBody(post.body || '');
            // Deep copy visibility settings to avoid direct state mutation
            setVisibility(post.visibility ? { ...post.visibility } : { branches: [], yearsOfPassing: [], genders: [] });
            setError(null); // Clear previous errors when opening
        }
    }, [post]);

    const handleVisibilityChange = (
        type: keyof VisibilitySettings,
        value: string | number,
        isChecked: boolean
    ) => {
        setVisibility(prev => {
            const currentValues = prev[type] as (string | number)[];
            let newValues: (string | number)[];

             if (isChecked) {
                 newValues = [...currentValues, value];
             } else {
                 newValues = currentValues.filter(v => v !== value);
             }

             if (type === 'yearsOfPassing') {
                 newValues = newValues.map(Number);
             }

            return { ...prev, [type]: newValues };
        });
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError(null);

        if (!user) {
            setError('You must be logged in to edit a post.');
            toast({ variant: "destructive", title: "Not Logged In", description: "Please log in." });
            return;
        }
        if (!post) {
            setError('No post selected for editing.');
            toast({ variant: "destructive", title: "Error", description: "No post data available." });
            return;
        }
        if (!title || !body) {
            setError('Title and body are required.');
            toast({ variant: "destructive", title: "Missing Fields", description: "Please provide a title and body." });
            return;
        }
         // Authorization check (ensure the current user is the author)
         if (user.uid !== post.authorId) {
             setError('You are not authorized to edit this post.');
             toast({ variant: "destructive", title: "Unauthorized", description: "You can only edit your own posts." });
             return;
         }


        setIsLoading(true);

        try {
            const postRef = doc(db, 'posts', post.id);
            await updateDoc(postRef, {
                title: title,
                body: body,
                visibility: visibility,
                lastEdited: serverTimestamp(), // Optional: Track edit time
            });

            toast({ title: "Post Updated!", description: "Your post has been successfully updated." });
            onClose(true); // Close the dialog and signal refresh

        } catch (err: any) {
            console.error("Error updating post:", err);
            setError(err.message || 'Failed to update post.');
            toast({ variant: "destructive", title: "Update Failed", description: err.message || 'An unexpected error occurred.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            onClose(); // Call onClose when the dialog is closed via X or overlay click
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Edit Post</DialogTitle>
                    <DialogDescription>
                        Make changes to your post here. Click save when you're done.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6 py-4">
                    {error && (
                        <Alert variant="destructive">
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                     )}

                    <div className="space-y-2">
                        <Label htmlFor="edit-title" className="text-sm font-medium">Title</Label>
                        <Input
                            id="edit-title"
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
                        <Label htmlFor="edit-body" className="text-sm font-medium">Body</Label>
                        <Textarea
                            id="edit-body"
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            required
                            rows={5}
                            placeholder="Write your post content here..."
                            className="mt-1"
                            disabled={isLoading}
                        />
                    </div>

                    {/* --- Visibility Settings --- */}
                    <div className="space-y-4 border-t pt-4">
                        <Label className="block text-sm font-medium mb-2">Post Visibility (Leave unchecked for All)</Label>
                        {/* Branches */}
                        <div className="space-y-1">
                             <Label className="text-xs font-medium text-muted-foreground">Branches:</Label>
                             <div className="flex flex-wrap gap-x-4 gap-y-2">
                                 {AVAILABLE_BRANCHES.map(branch => (
                                     <div key={`edit-branch-${branch}`} className="flex items-center space-x-2">
                                         <Checkbox
                                             id={`edit-vis-branch-${branch}`}
                                             checked={visibility.branches.includes(branch)}
                                             onCheckedChange={(checked) => handleVisibilityChange('branches', branch, !!checked)}
                                             disabled={isLoading}
                                         />
                                         <Label htmlFor={`edit-vis-branch-${branch}`} className="text-sm font-normal cursor-pointer">{branch}</Label>
                                     </div>
                                 ))}
                             </div>
                         </div>
                         {/* Years of Passing */}
                        <div className="space-y-1">
                             <Label className="text-xs font-medium text-muted-foreground">Years of Passing:</Label>
                             <div className="flex flex-wrap gap-x-4 gap-y-2">
                                 {AVAILABLE_YEARS.map(year => (
                                     <div key={`edit-year-${year}`} className="flex items-center space-x-2">
                                         <Checkbox
                                             id={`edit-vis-year-${year}`}
                                             checked={visibility.yearsOfPassing.includes(year)}
                                             onCheckedChange={(checked) => handleVisibilityChange('yearsOfPassing', year, !!checked)}
                                             disabled={isLoading}
                                         />
                                         <Label htmlFor={`edit-vis-year-${year}`} className="text-sm font-normal cursor-pointer">{year}</Label>
                                     </div>
                                 ))}
                             </div>
                         </div>
                         {/* Genders */}
                         <div className="space-y-1">
                             <Label className="text-xs font-medium text-muted-foreground">Genders:</Label>
                             <div className="flex flex-wrap gap-x-4 gap-y-2">
                                 {AVAILABLE_GENDERS.map(gender => (
                                     <div key={`edit-gender-${gender}`} className="flex items-center space-x-2">
                                         <Checkbox
                                             id={`edit-vis-gender-${gender.replace(/\s+/g, '-')}`}
                                             checked={visibility.genders.includes(gender)}
                                             onCheckedChange={(checked) => handleVisibilityChange('genders', gender, !!checked)}
                                             disabled={isLoading}
                                         />
                                         <Label htmlFor={`edit-vis-gender-${gender.replace(/\s+/g, '-')}`} className="text-sm font-normal cursor-pointer">{gender}</Label>
                                     </div>
                                 ))}
                             </div>
                         </div>
                    </div>
                    <DialogFooter>
                         <DialogClose asChild>
                              <Button type="button" variant="outline" disabled={isLoading}>Cancel</Button>
                          </DialogClose>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? (
                                 <>
                                     <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                                 </>
                             ) : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
