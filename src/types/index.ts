import type { Timestamp } from 'firebase/firestore';

export interface Student {
  scholarNumber: string; // PK
  name: string;
  branch: 'ECE' | 'CSE' | 'IT' | 'Unknown';
  section?: string; // Optional
  yearOfPassing: number;
  programType: 'Undergraduate' | 'Postgraduate';
  specialRoles: string[]; // e.g., ['CR', 'Admin']
  phoneNumber: string;
  email: string;
  uid: string; // Firebase Auth User ID
}

export interface Post {
  id: string; // Document ID
  authorId: string; // UID of the author (student)
  authorName: string; // Denormalized for display
  authorScholarNumber: string; // Denormalized for display
  title: string;
  body: string;
  imageUrl?: string; // Optional
  createdAt: Timestamp;
  status: 'pending' | 'approved' | 'rejected';
  approvalInfo?: {
    approverId: string; // UID of CR
    approvedAt: Timestamp;
  };
  upvotes: number;
  downvotes: number;
  // Store UIDs of users who voted to prevent multiple votes
  votedBy?: { [uid: string]: 'up' | 'down' };
}

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

export interface PostVote {
    postId: string;
    userId: string; // UID of the voter
    voteType: 'up' | 'down';
}

// Type for storing user data fetched from Firestore along with Auth data
export interface AppUser extends Student {
    // Inherits all fields from Student
    // Add any additional combined fields if necessary
}
