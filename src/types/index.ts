import type { Timestamp } from 'firebase/firestore';

// Define possible gender values explicitly
export type Gender = 'Male' | 'Female' | 'Other' | 'Prefer not to say' | 'Unknown'; // Added Unknown as a fallback

export interface Student {
  scholarNumber: string; // PK
  name: string;
  branch: 'ECE' | 'CSE' | 'IT' | 'Unknown'; // Example branches, adjust as needed
  section?: string; // Optional
  yearOfPassing: number;
  programType: 'Undergraduate' | 'Postgraduate';
  specialRoles: string[]; // e.g., ['CR', 'Admin']
  phoneNumber: string;
  email: string;
  uid: string; // Firebase Auth User ID
  // Make gender explicitly optional and use the Gender type
  gender?: Gender; // Use the specific type, mark as optional if it might not exist
}

// Represents the data stored in 'students-by-uid' collection for quick profile access
export interface StudentUidMap {
  uid: string; // Firebase Auth User ID, also document ID
  scholarNumber: string;
  // Consider adding other frequently needed fields here if querying 'students' is too slow often
  // name?: string;
  // branch?: string;
}


// Type for the full student profile data used in components after fetching
// Often combines data from Auth and Firestore
export interface StudentProfile extends Student {
    // Inherits all fields from Student
    // Ensure gender is handled correctly (might be optional initially)
    gender: Gender; // Make gender required in the profile used by components, providing a default if necessary
}


export interface VisibilitySettings {
    branches: string[]; // Empty array means visible to all branches
    yearsOfPassing: number[]; // Empty array means visible to all years
    genders: string[]; // Empty array means visible to all genders (using string representation of Gender type)
}

export interface Post {
  id: string; // Document ID
  authorId: string; // UID of the author from students-by-uid
  authorName: string; // Denormalized author name
  authorScholarNumber: string; // Denormalized
  authorBranch: string; // Denormalized
  authorYearOfPassing: number; // Denormalized
  authorGender: Gender; // Denormalized author gender
  title: string;
  body: string;
  imageUrls?: string[]; // Optional: URLs of images in Firebase Storage
  timestamp: Timestamp; // Firestore Timestamp
  upvotesCount: number;
  downvotesCount: number;
  hotScore: number; // For 'Hot' sorting, needs to be calculated/updated
  tags: string[]; // Includes authorName, scholarNumber, branch, yearOfPassing, gender
  visibility: VisibilitySettings;
}

export interface PostVote {
  userId: string; // UID of the voter
  postId: string;
  voteType: 'up' | 'down';
  timestamp: Timestamp; // When the vote was cast/updated
}

export interface FavoritePost {
  userId: string; // UID of the user who favorited
  postId: string;
  timestamp: Timestamp; // When the post was favorited
}


// Existing types from the original file (keeping them for context)

export interface LostAndFoundItem {
  id: string; // Document ID
  reporterId: string; // UID of the student who reported
  reporterName: string; // Denormalized
  reporterScholarNumber: string; // Denormalized
  title: string;
  description?: string;
  image?: string; // URL
  timeFound: Timestamp;
  placeFound: string;
  status: 'lost' | 'found' | 'claimed';
  claimedBy?: string; // UID of the student who claimed
  claimedAt?: Timestamp;
}

export interface Event {
  id: string; // Document ID
  creatorId: string; // UID of the creator
  creatorName: string; // Denormalized
  creatorScholarNumber: string; // Denormalized
  title: string;
  description: string;
  poster?: string; // URL
  startTime: Timestamp;
  endTime: Timestamp;
  location: string;
  registrationCount: number; // Denormalized count
  createdAt: Timestamp;
}

// Supporting Collections Types

export interface EventModerator {
  eventId: string;
  moderatorId: string; // UID of the moderator
}

export interface EventRegistration {
  eventId: string;
  attendeeId: string; // UID of the attendee
  attendeeScholarNumber: string; // Store scholar number for easy tracking
  registeredAt: Timestamp;
}

export interface EventUpdate {
  eventId: string;
  updateId: string; // Document ID for the update
  message: string;
  sentAt: Timestamp;
  senderId: string; // UID of creator/moderator who sent it
}

export interface EventFavorite {
  userId: string; // UID of the user who favorited
  eventId: string;
}

// Type for storing user data fetched from Firestore along with Auth data
// Using StudentProfile as the primary type for application logic after data fetch
// export interface AppUser extends StudentProfile {
//     // Inherits all fields from StudentProfile
//     // Add any additional combined fields if necessary
// }
