
'use server';
/**
 * @fileOverview Provides an AI flow to review resume text and suggest improvements and roles.
 *
 * - reviewResume - A function that analyzes resume text.
 * - ReviewResumeInput - The input type for the reviewResume function.
 * - ReviewResumeOutput - The return type for the reviewResume function.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'genkit';

// --- Input Schema ---
const ReviewResumeInputSchema = z.object({
  resumeText: z.string().describe('The full text content extracted from the user\'s resume PDF.'),
});
export type ReviewResumeInput = z.infer<typeof ReviewResumeInputSchema>;

// --- Output Schema ---
const ReviewResumeOutputSchema = z.object({
  suggestions: z.string().describe('Constructive feedback and suggestions for improving the resume content and formatting.'),
  suggestedRoles: z.array(z.string()).describe('A short list of 3-5 job roles that seem suitable based on the resume content.'),
});
export type ReviewResumeOutput = z.infer<typeof ReviewResumeOutputSchema>;

// --- Exported Flow Function ---
export async function reviewResume(input: ReviewResumeInput): Promise<ReviewResumeOutput> {
  console.log('[reviewResume] Flow invoked.');
  // Basic input validation (length check)
  if (!input.resumeText || input.resumeText.trim().length < 50) {
    console.warn('[reviewResume] Resume text is too short or empty.');
    // Provide a meaningful error or default response instead of proceeding
    return {
        suggestions: "The provided resume text was too short or empty to analyze. Please ensure the PDF was converted correctly.",
        suggestedRoles: []
    };
    // Or throw new Error("Resume text is too short or empty.");
  }

  try {
     const result = await reviewResumeFlow(input);
     console.log('[reviewResume] Flow execution successful.');
     return result;
  } catch (error) {
     console.error('[reviewResume] Error during flow execution:', error);
     // Return a structured error response
      return {
          suggestions: "An error occurred while reviewing the resume. Please try again later.",
          suggestedRoles: []
      };
      // Or re-throw if the caller should handle it differently
     // throw error;
  }
}

// --- Prompt Definition ---
const prompt = ai.definePrompt({
  name: 'reviewResumePrompt',
  input: {
    schema: ReviewResumeInputSchema,
  },
  output: {
    schema: ReviewResumeOutputSchema,
  },
  prompt: `You are an expert career advisor and resume reviewer. Analyze the following resume text extracted from a student's PDF.

Resume Text:
\`\`\`
{{{resumeText}}}
\`\`\`

Based on the text provided:
1.  **Provide constructive feedback:** Offer specific, actionable suggestions (3-5 bullet points) on how to improve the resume's content, structure, clarity, and impact. Focus on common areas like action verbs, quantification, formatting for readability, and tailoring for specific roles (though no target role is specified here).
2.  **Suggest suitable job roles:** Based *only* on the skills and experiences mentioned in the resume text, list 3-5 specific job titles or role types that the student might be well-suited to apply for.

Format your response strictly according to the output schema.`,
});

// --- Flow Definition ---
const reviewResumeFlow = ai.defineFlow<
  typeof ReviewResumeInputSchema,
  typeof ReviewResumeOutputSchema
>(
  {
    name: 'reviewResumeFlow',
    inputSchema: ReviewResumeInputSchema,
    outputSchema: ReviewResumeOutputSchema,
  },
  async (input) => {
    console.log('[reviewResumeFlow] Calling Gemini model...');
    const { output } = await prompt(input);
    console.log('[reviewResumeFlow] Received output from model.');

    if (!output) {
        console.error('[reviewResumeFlow] Failed to get output from the prompt.');
        // Provide a more specific fallback based on flow failure
        return {
             suggestions: "Unable to generate review at this time. The AI model did not return a response.",
             suggestedRoles: []
        };
    }

    // Basic validation of the output (e.g., ensure arrays aren't empty if they shouldn't be)
    if (!output.suggestions || output.suggestedRoles === undefined) {
         console.warn('[reviewResumeFlow] Model output might be incomplete:', output);
          // You might refine the output here or return as-is depending on requirements
    }

    return output;
  }
);

// Self-import for side effect registration during development
import './review-resume-flow';
