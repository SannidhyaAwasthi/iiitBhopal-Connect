import type { Timestamp, GeoPoint } from 'firebase/firestore'; // Added GeoPoint

// Define possible gender values explicitly
// Make sure 'Unknown' is included if it's a possible state (e.g., profile not fully updated)
export type Gender = 'Male' | 'Female' | 'Other' | 'Prefer not to say' | 'Unknown';

// Represents the core data stored for a student in Firestore ('students' collection)
export interface Student {
  uid: string; // Firebase Auth User ID, should ideally be the document ID in a 'users' or 'profiles' collection if using UID as ID.
  scholarNumber: string; // Unique student identifier, used as ID in 'students' collection for this app structure.
  name: string;
  email: string;
  phoneNumber: string;
  branch: 'ECE' | 'CSE' | 'IT' | 'Unknown';
  programType: 'Undergraduate' | 'Postgraduate';
  yearOfPassing: number;
  specialRoles: string[]; // e.g., ['CR', 'Admin']
  gender: Gender;
  resumeUrl?: string | null; // Optional URL for the uploaded resume
}

// Represents the data stored in 'students-by-uid' collection for quick mapping
// UID (Auth ID) -> Scholar Number
export interface StudentUidMap {
  // Document ID is the user's UID (request.auth.uid)
  scholarNumber: string;
}


// Type for the full student profile data used in components after fetching and potentially defaulting values.
// Ensures required fields for app functionality are present.
// Since gender is now required at signup, StudentProfile is identical to Student
export interface StudentProfile extends Student {
    // Inherits all fields from Student including the required gender and optional resumeUrl
}


export interface VisibilitySettings {
    branches: string[]; // Empty array means visible to all branches
    yearsOfPassing: number[]; // Empty array means visible to all years
    genders: Gender[]; // Empty array means visible to all genders, uses Gender type values
}

export interface Post {
  id: string; // Document ID from Firestore
  authorId: string; // UID of the author
  authorName: string; // Denormalized author name
  authorScholarNumber: string; // Denormalized scholar number
  authorBranch: string; // Denormalized branch
  authorYearOfPassing: number; // Denormalized year
  authorGender: Gender; // Denormalized gender
  title: string;
  body: string;
  imageUrls?: string[]; // URLs of images in Firebase Storage
  timestamp: Timestamp; // Firestore Timestamp for creation
  lastEdited?: Timestamp; // Firestore Timestamp for last edit
  upvotesCount: number;
  downvotesCount: number;
  hotScore: number; // Calculated score for sorting
  tags: string[]; // Search tags (e.g., author details, keywords)
  visibility: VisibilitySettings;
  // Client-side added properties
  userVote?: 'up' | 'down' | null; // Current user's vote status
  isFavorite?: boolean; // Current user's favorite status
}

export interface PostVote {
  // Document ID is composite: `${userId}_${postId}`
  userId: string;
  postId: string;
  voteType: 'up' | 'down';
  timestamp: Timestamp;
}

export interface FavoritePost {
  // Document ID is composite: `${userId}_${postId}`
  userId: string;
  postId: string;
  timestamp: Timestamp; // When favorited
}

// --- Lost and Found ---

export type LostFoundType = 'lost' | 'found';
export type LostFoundStatus = 'active' | 'inactive' | 'claimed'; // 'claimed' could replace 'inactive' for found items

export interface LostAndFoundItem {
  id: string; // Firestore Document ID
  type: LostFoundType; // 'lost' or 'found'
  title: string;
  description?: string;
  imageUrl?: string | null; // Optional image URL (allow null)
  timestamp: Timestamp; // Timestamp when reported/found/lost
  location: string; // Location where item was lost/found
  reporterId: string; // UID of the student reporting
  reporterName: string; // Denormalized name
  reporterScholarNumber: string; // Denormalized scholar number
  status: LostFoundStatus; // 'active' or 'inactive' (e.g., after claimed)
  createdAt?: Timestamp; // Add creation timestamp if needed
  // Fields specific to 'found' items
  claimers?: string[]; // Array of UIDs of users who have claimed (for 'found' items)
  confirmedClaimer?: string | null; // UID of the user whose claim was confirmed (for 'found' items, allow null)
}

// Used for displaying claimer info on a found item card
export interface ClaimerInfo {
    uid: string;
    name: string;
    scholarNumber: string;
}


// --- Events ---

export interface Event {
  id: string; // Firestore Document ID
  title: string;
  description: string;
  venue: string;
  location?: GeoPoint | null; // Optional GeoPoint
  startTime?: Timestamp | null; // Optional start time
  endTime?: Timestamp | null; // Optional end time
  poster?: string | null; // URL of the event poster image
  createdAt: Timestamp;
  numberOfRegistrations: number;
  postedBy: string; // UID of the user who created the event
  postedByName: string;
  postedByScholarNumber: string;
  likes: string[]; // Array of UIDs
  dislikes: string[]; // Array of UIDs
  eventLink: string; // Unique link/ID for the event
  visibility: VisibilitySettings; // Added visibility settings

  // Client-side added properties (optional)
  userLikeStatus?: 'liked' | 'disliked' | null;
  isRegistered?: boolean;
}

export interface EventRegistration {
  // Document ID can be the user's UID for easy checking
  eventId: string; // reference back to the event
  uid: string;
  scholarNumber: string;
  name: string;
  phoneNumber: string;
  email: string;
  registrationTime: Timestamp;
}