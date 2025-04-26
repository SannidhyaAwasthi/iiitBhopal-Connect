
'use server';
/**
 * @fileOverview Generates a personalized welcome message for the user's homepage.
 *
 * - generateWelcomeMessage - A function that generates the welcome message.
 * - GenerateWelcomeInput - The input type for the generateWelcomeMessage function.
 * - GenerateWelcomeOutput - The return type for the generateWelcomeMessage function.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'genkit';

const GenerateWelcomeInputSchema = z.object({
  studentName: z.string().describe('The name of the student.'),
  registeredEventTitles: z.array(z.string()).optional().describe('Titles of events the student is registered for (optional, max 5).'),
  favoritedPostTitles: z.array(z.string()).optional().describe('Titles of posts the student has favorited (optional, max 5).'),
});
export type GenerateWelcomeInput = z.infer<typeof GenerateWelcomeInputSchema>;

const GenerateWelcomeOutputSchema = z.object({
  welcomeMessage: z.string().describe('A personalized and motivational welcome message for the student, potentially mentioning upcoming events or favorited content highlights.'),
});
export type GenerateWelcomeOutput = z.infer<typeof GenerateWelcomeOutputSchema>;

export async function generateWelcomeMessage(input: GenerateWelcomeInput): Promise<GenerateWelcomeOutput> {
  return generateWelcomeFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateWelcomePrompt',
  input: {
    schema: GenerateWelcomeInputSchema,
  },
  output: {
    schema: GenerateWelcomeOutputSchema,
  },
  prompt: `You are an AI assistant for IIIT Bhopal Connect, a student platform. Your goal is to generate a short, engaging, and personalized welcome message for the homepage banner.

Student's Name: {{{studentName}}}

Consider the following optional information:
- Events Registered For: {{#if registeredEventTitles}}{{#each registeredEventTitles}} "{{this}}"{{#unless @last}}, {{/unless}}{{/each}}{{else}}None{{/if}}
- Favorited Posts: {{#if favoritedPostTitles}}{{#each favoritedPostTitles}} "{{this}}"{{#unless @last}}, {{/unless}}{{/each}}{{else}}None{{/if}}

Generate a message (max 2-3 sentences) that:
1. Greets the student by name (e.g., "Welcome back, {{{studentName}}}!").
2. Briefly highlights something relevant if available (e.g., an upcoming registered event like "Excited for '{{registeredEventTitles.[0]}}'?" or a general motivational comment if nothing specific is available).
3. Keeps the tone positive and encouraging.
4. Mentions campus news or deadlines ONLY IF specific campus news/deadlines are provided in the context (assume none are provided for this specific generation unless explicitly given).
5. If no specific events or favorites are provided, create a general warm welcome and motivational message appropriate for a student. Example: "Welcome back, {{{studentName}}}! Hope you have a productive day on campus." or "Hi {{{studentName}}}! Ready to connect and make the most of your day?"

Focus on creating a welcoming and slightly personalized banner message. Avoid making up specific news or deadlines.`,
});

const generateWelcomeFlow = ai.defineFlow<
  typeof GenerateWelcomeInputSchema,
  typeof GenerateWelcomeOutputSchema
>(
  {
    name: 'generateWelcomeFlow',
    inputSchema: GenerateWelcomeInputSchema,
    outputSchema: GenerateWelcomeOutputSchema,
  },
  async (input) => {
    // Limit arrays going into the prompt to avoid excessive length
    const limitedInput = {
        ...input,
        registeredEventTitles: input.registeredEventTitles?.slice(0, 3), // Limit to 3 events
        favoritedPostTitles: input.favoritedPostTitles?.slice(0, 3), // Limit to 3 posts
    }
    const { output } = await prompt(limitedInput);
    if (!output) {
        // Fallback in case the prompt fails
         console.error("AI failed to generate welcome message. Providing fallback.");
         return { welcomeMessage: `Welcome back, ${input.studentName}! Have a great day.` };
    }
    return output;
  }
);

// Ensure this flow is registered for development inspection
import './generate-welcome-message'; // Self-import for side effect registration
