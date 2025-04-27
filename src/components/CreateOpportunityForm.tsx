import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import type { StudentProfile, OpportunityEligibility, Gender, OpportunityLocation, OpportunityType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { createOpportunity } from '@/lib/opportunityActions'; // Assuming this action exists
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Timestamp } from 'firebase/firestore';

// Define available options (reuse or centralize if needed)
const AVAILABLE_BRANCHES = ['CSE', 'IT', 'ECE'];
const CURRENT_YEAR = new Date().getFullYear();
const AVAILABLE_YEARS = Array.from({ length: 8 }, (_, i) => CURRENT_YEAR + i - 1); // Example: last year to next 6 years
const AVAILABLE_GENDERS: Gender[] = ['Male', 'Female', 'Other', 'Prefer not to say'];
const AVAILABLE_LOCATIONS: OpportunityLocation[] = ['On-Campus', 'Off-Campus', 'Remote'];
const AVAILABLE_TYPES: OpportunityType[] = ['Internship', 'Full-Time', 'Part-Time', 'Competition', 'Scholarship', 'Other'];

interface CreateOpportunityFormProps {
    user: User | null;
    studentData: StudentProfile | null;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onSuccess: () => void; // Callback on successful creation
}

export const CreateOpportunityForm: React.FC<CreateOpportunityFormProps> = ({ user, studentData, isOpen, onOpenChange, onSuccess }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [applyLink, setApplyLink] = useState('');
    const [deadline, setDeadline] = useState<string>(''); // Store as string for input type datetime-local
    const [locationType, setLocationType] = useState<OpportunityLocation | ''>('');
    const [opportunityType, setOpportunityType] = useState<OpportunityType | ''>('');
    const [eligibility, setEligibility] = useState<OpportunityEligibility>({
        branches: [],
        yearsOfPassing: [],
        genders: [],
    });
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    // --- Eligibility Handlers ---
    const handleEligibilityChange = (
        type: keyof OpportunityEligibility,
        value: string | number,
        isChecked: boolean
    ) => {
        setEligibility(prev => {
            const currentValues = prev[type] as (string | number)[];
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !studentData) {
            toast({ variant: "destructive", title: "Error", description: "You must be logged in to post an opportunity." });
            return;
        }
        if (!title || !applyLink || !deadline || !locationType || !opportunityType) {
            toast({ variant: "destructive", title: "Error", description: "Title, Apply Link, Deadline, Location, and Type are required." });
            return;
        }

        // Validate Apply Link format (basic check)
        try {
            new URL(applyLink);
        } catch (_) {
            toast({ variant: "destructive", title: "Invalid Apply Link", description: "Please enter a valid URL (e.g., https://...)." });
            return;
        }
         // Validate Deadline is in the future
        const deadlineDate = new Date(deadline);
        if (deadlineDate <= new Date()) {
            toast({ variant: "destructive", title: "Invalid Deadline", description: "Deadline must be in the future." });
            return;
        }


        setIsLoading(true);

        try {
            const opportunityData = {
                title,
                description,
                applyLink,
                deadline: Timestamp.fromDate(deadlineDate),
                locationType,
                opportunityType,
                eligibility,
                // postedBy, postedByName, postedByScholarNumber, createdAt will be added by createOpportunity action
            };

            await createOpportunity(opportunityData, studentData);

            toast({ title: "Opportunity Posted!", description: "The opportunity is now visible to eligible students." });
            onSuccess();
            resetForm(); // Reset form fields
            onOpenChange(false); // Close dialog on success

        } catch (error: any) {
            console.error("Error creating opportunity:", error);
            toast({ variant: "destructive", title: "Posting Failed", description: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setApplyLink('');
        setDeadline('');
        setLocationType('');
        setOpportunityType('');
        setEligibility({ branches: [], yearsOfPassing: [], genders: [] });
        setIsLoading(false);
    };

    const handleClose = (open: boolean) => {
        if (!open) {
            resetForm(); // Reset form when dialog closes
        }
        onOpenChange(open);
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Post New Opportunity</DialogTitle>
                    <DialogDescription>
                        Fill in the details for the job/internship opportunity. Specify eligibility if needed.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4 pr-2">
                    {/* Opportunity Details */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="opp-title" className="text-right">Title <span className="text-red-500">*</span></Label>
                        <Input id="opp-title" value={title} onChange={(e) => setTitle(e.target.value)} className="col-span-3" required disabled={isLoading} placeholder="e.g., SDE Intern @ Google" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="opp-description" className="text-right">Description</Label>
                        <Textarea id="opp-description" value={description} onChange={(e) => setDescription(e.target.value)} className="col-span-3" disabled={isLoading} rows={3} placeholder="Job responsibilities, required skills, etc."/>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="opp-applyLink" className="text-right">Apply Link <span className="text-red-500">*</span></Label>
                        <Input id="opp-applyLink" type="url" value={applyLink} onChange={(e) => setApplyLink(e.target.value)} className="col-span-3" required disabled={isLoading} placeholder="https://careers.google.com/..."/>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="opp-deadline" className="text-right">Deadline <span className="text-red-500">*</span></Label>
                        <Input id="opp-deadline" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="col-span-3" required disabled={isLoading}/>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="opp-location" className="text-right">Location <span className="text-red-500">*</span></Label>
                         <Select value={locationType} onValueChange={(value) => setLocationType(value as OpportunityLocation)} required disabled={isLoading}>
                             <SelectTrigger id="opp-location" className="col-span-3">
                                 <SelectValue placeholder="Select location type" />
                             </SelectTrigger>
                             <SelectContent>
                                 {AVAILABLE_LOCATIONS.map((loc) => (
                                     <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                                 ))}
                             </SelectContent>
                         </Select>
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="opp-type" className="text-right">Type <span className="text-red-500">*</span></Label>
                         <Select value={opportunityType} onValueChange={(value) => setOpportunityType(value as OpportunityType)} required disabled={isLoading}>
                             <SelectTrigger id="opp-type" className="col-span-3">
                                 <SelectValue placeholder="Select opportunity type" />
                             </SelectTrigger>
                             <SelectContent>
                                 {AVAILABLE_TYPES.map((type) => (
                                     <SelectItem key={type} value={type}>{type}</SelectItem>
                                 ))}
                             </SelectContent>
                         </Select>
                    </div>

                    {/* --- Eligibility Settings --- */}
                    <div className="space-y-4 border-t pt-4 mt-4">
                        <Label className="block text-sm font-medium mb-2">Eligibility (Leave unchecked for All)</Label>
                        {/* Branches */}
                        <div className="space-y-1">
                            <Label className="text-xs font-medium text-muted-foreground">Branches:</Label>
                            <div className="flex flex-wrap gap-x-4 gap-y-2">
                                {AVAILABLE_BRANCHES.map(branch => (
                                    <div key={`elig-branch-${branch}`} className="flex items-center space-x-2">
                                        <Checkbox id={`elig-branch-${branch}`} checked={eligibility.branches.includes(branch)} onCheckedChange={(checked) => handleEligibilityChange('branches', branch, !!checked)} disabled={isLoading} />
                                        <Label htmlFor={`elig-branch-${branch}`} className="text-sm font-normal cursor-pointer">{branch}</Label>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Years of Passing */}
                        <div className="space-y-1">
                            <Label className="text-xs font-medium text-muted-foreground">Years of Passing:</Label>
                            <div className="flex flex-wrap gap-x-4 gap-y-2">
                                {AVAILABLE_YEARS.map(year => (
                                    <div key={`elig-year-${year}`} className="flex items-center space-x-2">
                                        <Checkbox id={`elig-year-${year}`} checked={eligibility.yearsOfPassing.includes(year)} onCheckedChange={(checked) => handleEligibilityChange('yearsOfPassing', year, !!checked)} disabled={isLoading} />
                                        <Label htmlFor={`elig-year-${year}`} className="text-sm font-normal cursor-pointer">{year}</Label>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Genders */}
                        <div className="space-y-1">
                            <Label className="text-xs font-medium text-muted-foreground">Genders:</Label>
                            <div className="flex flex-wrap gap-x-4 gap-y-2">
                                {AVAILABLE_GENDERS.map(gender => (
                                    <div key={`elig-gender-${gender}`} className="flex items-center space-x-2">
                                        <Checkbox id={`elig-gender-${gender.replace(/\s+/g, '-')}`} checked={eligibility.genders.includes(gender as Gender)} onCheckedChange={(checked) => handleEligibilityChange('genders', gender, !!checked)} disabled={isLoading} />
                                        <Label htmlFor={`elig-gender-${gender.replace(/\s+/g, '-')}`} className="text-sm font-normal cursor-pointer">{gender}</Label>
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
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {isLoading ? 'Posting...' : 'Post Opportunity'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
