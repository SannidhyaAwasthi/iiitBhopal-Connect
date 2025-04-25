import type { Timestamp } from 'firebase/firestore';

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
  gender: 'Male' | 'Female' | 'Other' | 'Prefer not to say'; // Assuming gender is in student profile
}

// Represents the data stored in 'students-by-uid' collection
export interface StudentProfile {
  uid: string; // Firebase Auth User ID, also document ID
  scholarNumber: string;
  name: string;
  branch: string;
  yearOfPassing: number;
  gender: string;
  // Add other profile fields if needed
}

export interface VisibilitySettings {
    branches: string[]; // Empty array means visible to all branches
    yearsOfPassing: number[]; // Empty array means visible to all years
    genders: string[]; // Empty array means visible to all genders
}

export interface Post {
  id: string; // Document ID
  authorId: string; // UID of the author from students-by-uid
  authorName: string; // Denormalized author name
  title: string;
  body: string;
  imageUrls?: string[]; // Optional: URLs of images in Firebase Storage
  timestamp: Timestamp; // Firestore Timestamp
  upvotesCount: number;
  downvotesCount: number;
  hotScore: number; // For 'Hot' sorting, needs to be calculated/updated
  tags: string[]; // Includes authorName, scholarNumber, branch, yearOfPassing
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
export interface AppUser extends Student {
    // Inherits all fields from Student
    // Add any additional combined fields if necessary
}
