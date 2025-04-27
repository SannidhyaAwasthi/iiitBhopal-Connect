
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from 'lucide-react';
import type { ReviewResumeOutput } from '@/ai/flows/review-resume-flow'; // Import the output type

interface ResumeReviewDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    reviewData: ReviewResumeOutput | null;
    isLoading: boolean;
    error: string | null;
}

export const ResumeReviewDialog: React.FC<ResumeReviewDialogProps> = ({
    isOpen,
    onOpenChange,
    reviewData,
    isLoading,
    error,
}) => {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Resume Review & Role Suggestions</DialogTitle>
                    <DialogDescription>
                        AI-powered feedback on your resume and potential career paths.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-grow overflow-y-auto pr-6 -mr-6"> {/* Allow content to scroll */}
                    <div className="py-4 space-y-6">
                        {isLoading && (
                            <div className="flex items-center justify-center min-h-[200px]">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <p className="ml-3 text-muted-foreground">Analyzing your resume...</p>
                            </div>
                        )}

                        {error && !isLoading && (
                            <div className="text-destructive bg-destructive/10 p-4 rounded-md">
                                <p className="font-medium">Error:</p>
                                <p>{error}</p>
                            </div>
                        )}

                        {reviewData && !isLoading && !error && (
                            <>
                                {/* Suggestions Section */}
                                <div>
                                    <h3 className="text-lg font-semibold mb-2">Improvement Suggestions:</h3>
                                    {reviewData.suggestions ? (
                                        <div
                                            className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap bg-muted/50 p-4 rounded-md"
                                            // Using dangerouslySetInnerHTML assumes the suggestions are simple text or safe HTML.
                                            // For production, consider sanitizing or using a markdown renderer if format is complex.
                                            dangerouslySetInnerHTML={{ __html: reviewData.suggestions.replace(/\n/g, '<br />') }} // Basic newline handling
                                        />

                                    ) : (
                                        <p className="text-muted-foreground italic">No specific suggestions provided.</p>
                                    )}
                                </div>

                                {/* Suggested Roles Section */}
                                <div>
                                    <h3 className="text-lg font-semibold mb-2">Suggested Roles:</h3>
                                    {reviewData.suggestedRoles && reviewData.suggestedRoles.length > 0 ? (
                                        <ul className="list-disc list-inside space-y-1 bg-muted/50 p-4 rounded-md">
                                            {reviewData.suggestedRoles.map((role, index) => (
                                                <li key={index} className="text-sm">{role}</li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-muted-foreground italic">No specific roles suggested based on the provided text.</p>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                 </ScrollArea>

                <DialogFooter className="mt-auto pt-4 border-t">
                    <DialogClose asChild>
                        <Button type="button" variant="outline">
                            Close
                        </Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
