import { useState } from "react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Opportunity } from "@/types"; // Import Opportunity type
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils"; // Corrected import path
import { Textarea } from "@/components/ui/textarea"; // Import Textarea
import { Timestamp } from "firebase/firestore";
import { updateOpportunity } from "@/lib/opportunityActions"; // Import update action
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Checkbox } from "./ui/checkbox";
import type { OpportunityEligibility, Gender } from "@/types"; // Import necessary types

// Define available options (reuse or centralize if needed)
const AVAILABLE_BRANCHES = ['CSE', 'IT', 'ECE'];
const CURRENT_YEAR = new Date().getFullYear();
const AVAILABLE_YEARS = Array.from({ length: 8 }, (_, i) => CURRENT_YEAR + i - 1);
const AVAILABLE_GENDERS: Gender[] = ['Male', 'Female', 'Other', 'Prefer not to say'];
const AVAILABLE_LOCATIONS: Opportunity['locationType'][] = ['On-Campus', 'Off-Campus', 'Remote'];
const AVAILABLE_TYPES: Opportunity['opportunityType'][] = ['Internship', 'Full-Time', 'Part-Time', 'Competition', 'Scholarship', 'Other'];


const formSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters.").max(100, "Title cannot exceed 100 characters."),
  description: z.string().optional(), // Description is optional
  locationType: z.enum(AVAILABLE_LOCATIONS),
  opportunityType: z.enum(AVAILABLE_TYPES),
  eligibility: z.object({ // Eligibility is now an object
        branches: z.array(z.string()),
        yearsOfPassing: z.array(z.number()),
        genders: z.array(z.string()),
    }),
  applyLink: z.string().url("Please enter a valid URL."),
  deadline: z.date().refine(date => date > new Date(), {
    message: "Deadline must be in the future.",
  }),
});


interface EditOpportunityFormProps {
  opportunity: Opportunity;
  close: () => void; // Function to close the dialog
  onUpdate: () => void; // Callback to refresh list
}

export function EditOpportunityForm({
  opportunity,
  close,
  onUpdate
}: EditOpportunityFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: opportunity.title,
      description: opportunity.description || '', // Handle potentially undefined description
      locationType: opportunity.locationType,
      opportunityType: opportunity.opportunityType,
      eligibility: { // Initialize eligibility object
            branches: opportunity.eligibility?.branches || [],
            yearsOfPassing: opportunity.eligibility?.yearsOfPassing || [],
            genders: opportunity.eligibility?.genders || [],
      },
      applyLink: opportunity.applyLink,
      deadline: opportunity.deadline.toDate(), // Convert Firestore Timestamp to Date
    },
  });

   // --- Eligibility Handlers ---
    const handleEligibilityChange = (
        type: keyof OpportunityEligibility,
        value: string | number,
        isChecked: boolean
    ) => {
        const currentEligibility = form.getValues('eligibility');
        const currentValues = currentEligibility[type] as (string | number)[];
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

        form.setValue(`eligibility.${type}`, newValues as any, { shouldValidate: true }); // Update form state
    };


  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
       // Construct the update data, only including changed fields might be better
       const updateData: Partial<Pick<Opportunity, 'title' | 'description' | 'applyLink' | 'deadline' | 'eligibility' | 'locationType' | 'opportunityType'>> = {
          ...values,
          deadline: Timestamp.fromDate(values.deadline), // Convert Date back to Timestamp
       };

      await updateOpportunity(opportunity.id, updateData); // Call update action

      toast({ title: "Opportunity Updated!", description: "Changes saved successfully." });
      onUpdate(); // Refresh the opportunities list
      close(); // Close the dialog
    } catch (error: any) {
      console.error("Error updating opportunity:", error);
      toast({ variant: "destructive", title: "Update Failed", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-4"> {/* Added scroll */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title <span className="text-red-500">*</span></FormLabel>
              <FormControl>
                <Input placeholder="e.g., SDE Intern @ Google" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Job responsibilities, required skills, etc." {...field} rows={4}/>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
         <FormField
          control={form.control}
          name="locationType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Location Type <span className="text-red-500">*</span></FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a location type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                   {AVAILABLE_LOCATIONS.map((loc) => (
                       <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                   ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="opportunityType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Opportunity Type <span className="text-red-500">*</span></FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an opportunity type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                   {AVAILABLE_TYPES.map((type) => (
                       <SelectItem key={type} value={type}>{type}</SelectItem>
                   ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

         {/* --- Eligibility Settings --- */}
        <div className="space-y-4 border-t pt-4 mt-4">
            <Label className="block text-sm font-medium mb-2">Eligibility (Leave unchecked for All)</Label>
            {/* Branches */}
            <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">Branches:</Label>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {AVAILABLE_BRANCHES.map(branch => (
                        <div key={`edit-elig-branch-${branch}`} className="flex items-center space-x-2">
                            <Checkbox
                                id={`edit-elig-branch-${branch}`}
                                checked={form.watch('eligibility.branches').includes(branch)}
                                onCheckedChange={(checked) => handleEligibilityChange('branches', branch, !!checked)}
                                disabled={isSubmitting}
                            />
                            <Label htmlFor={`edit-elig-branch-${branch}`} className="text-sm font-normal cursor-pointer">{branch}</Label>
                        </div>
                    ))}
                </div>
            </div>
            {/* Years of Passing */}
            <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">Years of Passing:</Label>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {AVAILABLE_YEARS.map(year => (
                        <div key={`edit-elig-year-${year}`} className="flex items-center space-x-2">
                            <Checkbox
                                id={`edit-elig-year-${year}`}
                                checked={form.watch('eligibility.yearsOfPassing').includes(year)}
                                onCheckedChange={(checked) => handleEligibilityChange('yearsOfPassing', year, !!checked)}
                                disabled={isSubmitting}
                            />
                            <Label htmlFor={`edit-elig-year-${year}`} className="text-sm font-normal cursor-pointer">{year}</Label>
                        </div>
                    ))}
                </div>
            </div>
            {/* Genders */}
            <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">Genders:</Label>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {AVAILABLE_GENDERS.map(gender => (
                        <div key={`edit-elig-gender-${gender}`} className="flex items-center space-x-2">
                            <Checkbox
                                id={`edit-elig-gender-${gender.replace(/\s+/g, '-')}`}
                                checked={form.watch('eligibility.genders').includes(gender)}
                                onCheckedChange={(checked) => handleEligibilityChange('genders', gender, !!checked)}
                                disabled={isSubmitting}
                            />
                            <Label htmlFor={`edit-elig-gender-${gender.replace(/\s+/g, '-')}`} className="text-sm font-normal cursor-pointer">{gender}</Label>
                        </div>
                    ))}
                </div>
            </div>
        </div>


        <FormField
          control={form.control}
          name="applyLink"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Application Link <span className="text-red-500">*</span></FormLabel>
              <FormControl>
                <Input type="url" placeholder="https://careers.example.com/..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="deadline"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Deadline <span className="text-red-500">*</span></FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-[240px] pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? (
                        format(field.value, "PPP, p") // Include time in format
                      ) : (
                        <span>Pick a date and time</span>
                      )}
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    initialFocus
                  />
                  {/* Simple time input - consider a dedicated time picker library for better UX */}
                  <div className="p-2 border-t">
                     <Input
                        type="time"
                        value={field.value ? format(field.value, 'HH:mm') : ''}
                        onChange={(e) => {
                             const time = e.target.value;
                             if (field.value && time) {
                                const [hours, minutes] = time.split(':').map(Number);
                                const newDate = new Date(field.value);
                                newDate.setHours(hours, minutes);
                                field.onChange(newDate);
                             } else if (time) {
                                // If no date is set yet, set a default date (today) with the time
                                const [hours, minutes] = time.split(':').map(Number);
                                const newDate = new Date();
                                newDate.setHours(hours, minutes, 0, 0); // Reset seconds/ms
                                field.onChange(newDate);
                             }
                        }}
                        className="w-full"
                        step="60" // Steps of 1 minute
                     />
                  </div>
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2 pt-4 border-t">
           <Button type="button" variant="outline" onClick={close} disabled={isSubmitting}>Cancel</Button>
           <Button type="submit" disabled={isSubmitting}>
             {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
             {isSubmitting ? "Saving..." : "Save Changes"}
           </Button>
         </div>
      </form>
    </Form>
  );
}
