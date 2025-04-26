# IIIT Bhopal Connect

This is a Next.js application designed for the students of IIIT Bhopal.

## Getting Started

1.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```
2.  **Set up environment variables:**
    Create a `.env.local` file in the root directory and add your Firebase project configuration:
    ```env
    NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_API_KEY
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_AUTH_DOMAIN
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_STORAGE_BUCKET
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_MESSAGING_SENDER_ID
    NEXT_PUBLIC_FIREBASE_APP_ID=YOUR_APP_ID

    # Optional: For Genkit/Google AI features
    # GOOGLE_GENAI_API_KEY=YOUR_GOOGLE_AI_API_KEY
    ```
3.  **Run the development server:**
    ```bash
    npm run dev
    # or
    yarn dev
    ```

Open [http://localhost:9002](http://localhost:9002) (or your configured port) with your browser to see the result.

## Features

*   User Authentication (Sign up/Login)
*   Student Profile Display
*   Posts Feed (Create, Read, Vote, Favorite)
*   Lost & Found (Report Lost/Found, Claim)
*   Events Feed (Create, Read, Register, Like/Dislike)

