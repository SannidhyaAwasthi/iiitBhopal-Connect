import React, { useState, useRef } from 'react';
import type { User } from 'firebase/auth';
import type { StudentProfile } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { uploadResume, updateStudentResumeUrl, deleteResume } from '@/lib/profileActions'; // Import profile actions
import { Loader2, Upload, FileText, Trash2 } from 'lucide-react'; // Import necessary icons
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface UserProfileProps {
    user: User | null; // Firebase auth user
    studentData: StudentProfile | null; // Fetched student profile data
    onUpdate: () => void; // Callback to trigger profile refresh in parent
}

// Helper to get initials
const getInitials = (name: string = '') => {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();
};

// Helper component to display a profile field
const ProfileField: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="grid grid-cols-3 gap-4 items-center">
        <span className="text-sm font-medium text-muted-foreground text-right col-span-1">{label}</span>
        <span className="text-sm col-span-2">{value || '-'}</span>
    </div>
);

const UserProfile: React.FC<UserProfileProps> = ({ user, studentData, onUpdate }) => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false); // State for delete operation
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.type === 'application/pdf') {
            // Optional: Add size check
            if (file.size > 10 * 1024 * 1024) { // 10MB limit example
                 toast({ variant: "destructive", title: "File Too Large", description: "Resume must be under 10MB." });
                 setSelectedFile(null);
                 if (fileInputRef.current) fileInputRef.current.value = '';
                 return;
            }
            setSelectedFile(file);
        } else if (file) {
            toast({ variant: "destructive", title: "Invalid File Type", description: "Please upload a PDF file." });
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } else {
             setSelectedFile(null); // Handle cancellation
        }
    };

    const handleUploadResume = async () => {
        if (!selectedFile || !user || !studentData?.scholarNumber) {
            toast({ variant: "destructive", title: "Upload Error", description: "No PDF file selected or missing user data." });
            return;
        }

        setIsUploading(true);
        try {
            // 1. Upload the resume file
            const downloadURL = await uploadResume(user.uid, selectedFile);

            // 2. Update the student profile with the new URL
            await updateStudentResumeUrl(user.uid, studentData.scholarNumber, downloadURL);

            toast({ title: "Resume Uploaded Successfully!", description: "Your profile has been updated." });
            setSelectedFile(null); // Clear selection
            if (fileInputRef.current) fileInputRef.current.value = ''; // Clear file input
            onUpdate(); // Trigger profile refresh in parent component

        } catch (error: any) {
            console.error("Resume upload/update failed:", error);
            toast({ variant: "destructive", title: "Upload Failed", description: error.message });
        } finally {
            setIsUploading(false);
        }
    };

     const handleDeleteResume = async () => {
         if (!user || !studentData?.scholarNumber || !studentData?.resumeUrl) {
             toast({ variant: "destructive", title: "Delete Error", description: "No resume found or missing user data." });
             return;
         }
         setIsDeleting(true);
         try {
             // 1. Delete the resume file from Storage
             await deleteResume(user.uid);

             // 2. Remove the resumeUrl from the student profile in Firestore
             await updateStudentResumeUrl(user.uid, studentData.scholarNumber, null);

             toast({ title: "Resume Deleted Successfully", description: "Your profile has been updated." });
             onUpdate(); // Refresh profile

         } catch (error: any) {
             console.error("Resume deletion failed:", error);
             toast({ variant: "destructive", title: "Delete Failed", description: error.message });
         } finally {
             setIsDeleting(false);
         }
     };

    if (!studentData) {
        // Consider using a more specific loading indicator or null
        return <p>Loading profile data...</p>;
    }

    const isGuest = studentData.email === 'guest@iiitbhopal.ac.in'; // Keep check for display logic if needed

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-2xl font-semibold">My Profile</h2>
            <Card>
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pb-4">
                    <Avatar className="h-16 w-16 shrink-0">
                        <AvatarFallback className="text-xl">{getInitials(studentData.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-grow">
                        <CardTitle className="text-xl mb-1">{studentData.name}</CardTitle>
                        <CardDescription>{studentData.email}</CardDescription>
                         {studentData.specialRoles && studentData.specialRoles.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                                {studentData.specialRoles.map(role => (
                                    <Badge key={role} variant="secondary">{role}</Badge>
                                ))}
                            </div>
                        )}
                    </div>
                </CardHeader>
                <Separator />
                <CardContent className="pt-6 space-y-4">
                    <ProfileField label="Scholar Number" value={studentData.scholarNumber} />
                    <ProfileField label="Phone Number" value={studentData.phoneNumber} />
                    {!isGuest && (
                        <>
                            <ProfileField label="Branch" value={studentData.branch} />
                            <ProfileField label="Program" value={studentData.programType} />
                            <ProfileField label="Year of Passing" value={studentData.yearOfPassing} />
                            <ProfileField label="Gender" value={studentData.gender} />
                        </>
                    )}
                    {/* Resume Section */}
                     <Separator />
                     <div className="space-y-3 pt-4">
                         <h3 className="text-lg font-medium mb-2">Resume</h3>
                         {studentData.resumeUrl ? (
                             <div className="space-y-3">
                                 <div className="flex items-center justify-between p-3 border rounded-md bg-secondary/50">
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-5 w-5 text-primary" />
                                        <a
                                            href={studentData.resumeUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm font-medium text-primary hover:underline"
                                            title="View/Download Resume"
                                        >
                                            View Current Resume
                                        </a>
                                     </div>
                                     <AlertDialog>
                                         <AlertDialogTrigger asChild>
                                             <Button variant="destructive" size="sm" disabled={isDeleting} title="Delete Resume">
                                                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                             </Button>
                                         </AlertDialogTrigger>
                                         <AlertDialogContent>
                                             <AlertDialogHeader>
                                             <AlertDialogTitle>Delete Resume?</AlertDialogTitle>
                                             <AlertDialogDescription>
                                                 This action cannot be undone. This will permanently delete your resume from storage and your profile.
                                             </AlertDialogDescription>
                                             </AlertDialogHeader>
                                             <AlertDialogFooter>
                                             <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                                             <AlertDialogAction onClick={handleDeleteResume} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                                                  {isDeleting ? "Deleting..." : "Yes, Delete Resume"}
                                             </AlertDialogAction>
                                             </AlertDialogFooter>
                                         </AlertDialogContent>
                                     </AlertDialog>
                                 </div>
                                 {/* PDF Preview (using an iframe) */}
                                 <div className="aspect-[8.5/11] w-full border rounded-md overflow-hidden">
                                    <iframe
                                        src={`${studentData.resumeUrl}#view=fitH`} // Append parameters for better view
                                        title="Resume Preview"
                                        className="w-full h-full"
                                        // sandbox // Optional: Add sandbox for security if needed, might break some PDFs
                                    />
                                 </div>
                                 <p className="text-xs text-muted-foreground text-center">Preview of your uploaded resume.</p>
                                 {/* Option to upload a new one */}
                                 <Label htmlFor="resume-upload" className="text-sm font-medium">Replace Resume (PDF only):</Label>
                             </div>
                         ) : (
                             <p className="text-sm text-muted-foreground">No resume uploaded yet.</p>
                         )}

                         <div className="flex items-center gap-3">
                              <Input
                                  id="resume-upload"
                                  type="file"
                                  accept="application/pdf"
                                  onChange={handleFileChange}
                                  ref={fileInputRef}
                                  className="flex-grow text-sm file:mr-4 file:py-1 file:px-3 file:rounded-md file:border file:border-input file:bg-secondary file:text-secondary-foreground hover:file:bg-secondary/80 file:font-medium"
                                  disabled={isUploading || isDeleting}
                              />
                             <Button
                                 onClick={handleUploadResume}
                                 disabled={!selectedFile || isUploading || isDeleting}
                                 size="sm"
                             >
                                 {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                 {isUploading ? 'Uploading...' : (studentData.resumeUrl ? 'Replace' : 'Upload')}
                             </Button>
                         </div>
                           {selectedFile && !isUploading && (
                                <p className="text-xs text-muted-foreground">Selected: {selectedFile.name}</p>
                           )}
                     </div>

                </CardContent>
            </Card>
        </div>
    );
};

export default UserProfile;