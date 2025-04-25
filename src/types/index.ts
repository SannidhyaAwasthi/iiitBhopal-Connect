import type { Timestamp } from 'firebase/firestore';

// Define possible gender values explicitly
export type Gender = 'Male' | 'Female' | 'Other' | 'Prefer not to say' | 'Unknown'; // Ensure Unknown is included

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
  // Gender might be missing initially, but should be set later (or defaulted).
  // Made optional here to reflect potential Firestore state before profile completion/update.
  gender?: Gender;
}

// Represents the data stored in 'students-by-uid' collection for quick mapping
// UID (Auth ID) -> Scholar Number
export interface StudentUidMap {
  // Document ID is the user's UID (request.auth.uid)
  scholarNumber: string;
}


// Type for the full student profile data used in components after fetching and potentially defaulting values.
// Ensures required fields for app functionality are present.
export interface StudentProfile extends Omit<Student, 'gender'> {
    // Inherits all fields from Student except gender
    gender: Gender; // Gender is required here, ensuring it has a value (e.g., 'Unknown' if not set)
}


export interface VisibilitySettings {
    branches: string[]; // Empty array means visible to all branches
    yearsOfPassing: number[]; // Empty array means visible to all years
    genders: string[]; // Empty array means visible to all genders, uses Gender type values
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
  imageUrl?: string; // Optional image URL (primarily for 'found' items)
  timestamp: Timestamp; // Timestamp when reported/found/lost
  location: string; // Location where item was lost/found
  reporterId: string; // UID of the student reporting
  reporterName: string; // Denormalized name
  reporterScholarNumber: string; // Denormalized scholar number
  status: LostFoundStatus; // 'active' or 'inactive' (e.g., after claimed)
  // Fields specific to 'found' items
  claimers?: string[]; // Array of UIDs of users who have claimed (for 'found' items)
  confirmedClaimer?: string; // UID of the user whose claim was confirmed (for 'found' items)
}

// Used for displaying claimer info on a found item card
export interface ClaimerInfo {
    uid: string;
    name: string;
    scholarNumber: string;
}


// --- Events ---
// Placeholder - Define Event related types later if needed
export interface Event {
  id: string;
  // ... other event fields
}
