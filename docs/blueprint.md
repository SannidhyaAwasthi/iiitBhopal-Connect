# **App Name**: IIITBhopal Connect

## Core Features:

- User Authentication: Implement Firebase Authentication with Email/Password for user management. Students must log in before accessing any features. Also implements a Guest account for demo purposes.
- Posts: Students can publish posts containing: Title, Main Body. Posts have upvote and downvote buttons. Posts can be sorted by 'Recent' or 'Popular'. These posts will be connected to the firestore database.
- Lost and Found: Students can post found items with: Title, Time found, Place found. Owners can claim items. Poster can mark items as found after return. Users can view their own posts under 'Your Posts'. These will be connected to the firestore database.
- Events: Event creation, sharing, registration, and update system with registration tracking, moderator support, and favoriting. These will be connected to the firestore database.

## Style Guidelines:

- Primary color: Use the existing IIIT Bhopal color palette.
- Secondary color: Light gray or off-white for backgrounds to provide contrast.
- Accent: Use a shade of blue (#007BFF) for interactive elements and highlights.
- Clean and modern layout with a focus on readability and user experience.
- Use clear and consistent icons for navigation and actions.

## Original User Request:
IIIT Bhopal Student Connect
Authentication

Implement Firebase Authentication with Email/Password for user management
Students must login before accessing any features

Login Page

Only requires:

Email
Password



Signup Page

Required fields:

Scholar Number
Name
Email
Phone Number
Password
Confirm Password


Scholar number format: YY(U/P)XXZZZ

YY = year of admission (20YY)
U/P = Undergraduate or Postgraduate
XX = Branch Code (01=ECE, 02=CSE, 03=IT)
ZZZ = roll number
Examples: 22U01030, 24P02111


After signup, automatically extract and calculate:

If third character is 'U': 4-year program, year of passing = admission year + 4
If third character is 'P': 2-year program, year of passing = admission year + 2
Branch code: 01=ECE, 02=CSE, 03=IT


Guest account available (ID: guest, password: guest)
Store user profile data in Firestore "students" collection after signup

Features
1. Posts

Students can publish posts containing: Image/Poster, Title, Main Body
Posts require approval by CR (class representative)
CRs can approve or remove posts
Posts have upvote and downvote buttons
Posts can be sorted by "Recent" or "Popular"

2. Lost and Found

Students can post found items with: Image, Title, Time found, Place found
Owners can claim items via claim button
Poster can mark items as found after return
Found items no longer display in Lost and Found page
Users can view their own posts under "Your Posts"

3. Events

Events are posts with additional functionality
Each event has its own sharable link (not a separate registration link)
Register button uses logged-in user's scholar number for event registration
Event creators can track registrations
Creators can send updates to registered attendees
Events can have multiple moderators
Users can favorite events to see them on homepage under "Your Events"

Database Structure (Firestore Collections)

students: Scholar_Number[PK], Name, Branch, Section, Year of Passing, Special Roles, Phone Number, Email
posts: Post_ID, Author_ID, Title, Body, Image_URL, Created_At, Status, Approval_Info, Vote_Counts
lostAndFound: Item_ID, Reporter_ID, Title, Image, Time_Found, Place_Found, Status (lost/found), Claimed_By
events: Event_ID, Creator_ID, Title, Description, Poster, Start_Time, End_Time, Location, Registration_Count
Supporting Collections:

eventModerators
eventRegistrations
eventUpdates
eventFavorites
postVotes



Homepage

Greeting: "Good Morning/Afternoon {Student_Name}" based on time
Display all posts with sort options
"Your Posts" section
"Your Events" section (showing attended and created/moderated events)

  