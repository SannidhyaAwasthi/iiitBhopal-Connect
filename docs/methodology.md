# Proposed Methodology and Work

## 1. Introduction

This document outlines the proposed methodology and work plan for the development of a comprehensive social platform designed exclusively for students. This platform will serve as a central hub, connecting students through various functionalities, including a dynamic posts feed, a practical lost and found system, and a comprehensive event management module. The project aims to foster a more connected and engaged student community by providing tools for sharing information, finding lost items, and coordinating social and academic events. The core features include user authentication, student profiles, a posts feed with content moderation, a lost and found system, and event management. This document details our agile development approach, technology stack, work breakdown, project timeline, team roles, and anticipated outcomes.

## 2. Development Methodology

### 2.1 Agile/Iterative Development

We will employ an agile development methodology, characterized by short, iterative development cycles known as sprints, typically lasting one to two weeks. This approach emphasizes flexibility, continuous improvement, and adaptability to evolving requirements. Each sprint will focus on delivering a specific set of features or enhancements, followed by a review and feedback session. This iterative process ensures that the project remains aligned with the objectives and allows for timely adjustments based on feedback. Regular testing and quality checks will be integrated throughout each sprint to maintain high standards and address issues promptly.

### 2.2 Technology Stack

The project leverages a robust and modern technology stack, ensuring scalability, maintainability, and a rich user experience:

*   **Frontend:**
    *   **React (Next.js):** Chosen for its component-based architecture, efficient rendering, and strong developer community. Next.js enhances React with server-side rendering capabilities, improving SEO and initial page load times.
*   **Backend:**
    *   **Node.js:** Selected for its non-blocking, event-driven architecture, which allows for high concurrency and efficient resource utilization.
    *   **Firebase:** Utilized for its comprehensive suite of backend services, including:
        *   **Firestore:** A NoSQL cloud database for storing and syncing data, known for its flexibility and scalability.
        *   **Authentication:** Manages user authentication with various methods (email/password, social logins).
        *   **Storage:** Stores user-generated content, including images and files.
*   **Database:**
    *   **Firebase Firestore:** Chosen for its real-time data synchronization, schema-less design, and seamless integration with Firebase Authentication and Storage.
*   **UI:**
    *   **Tailwind CSS:** A utility-first CSS framework that facilitates rapid UI development with its pre-defined utility classes, ensuring consistent design and responsive layouts.
* **AI:**
    * AI will be used to generate welcome message to the user or any other future features.
* **Tools:**
    *   **Git**: Version Control.
    *   **VS Code:** Code editor.

### 2.3 Version Control

*   **Git:** We will employ Git for version control, providing a comprehensive history of code changes, enabling collaborative development, and facilitating easy rollbacks when needed. Each feature or bug fix will be developed in separate branches, which are then merged into the main branch after thorough review.

### 2.4 Testing

*   **Unit Testing:** Each component and function will be tested in isolation to ensure they perform as expected.
*   **Integration Testing:** Tests interactions between components and modules to verify proper communication and data flow.
*   **End-to-End (E2E) Testing:** Simulates real user scenarios to ensure the entire application works correctly.
* **User Testing**: We will perform user testing to test the UX and UI of the platform.

## 3. Proposed Work Breakdown

The project is divided into six main phases, each consisting of several sprints. Each phase builds upon the previous one, incrementally adding functionality and complexity to the platform.

### Phase 1: Core Platform Setup (Sprint 1-3)

This phase focuses on establishing the foundation of the platform, including user authentication, profiles, and basic navigation.

*   **Sprint 1: Authentication and Basic Structure**
    *   Implement user registration using Firebase Authentication (email/password).
    *   Implement user login using Firebase Authentication.
    *   Implement guest account.
    *   Set up Firestore collections for "students."
    *   Create a basic navigation structure (header, footer, links to main pages).
    * Create basic UI components like buttons, inputs, labels etc.
*   **Sprint 2: User Profiles**
    *   Develop the "My Profile" page.
    *   Allow users to view and edit their profile information.
    *   Integrate student data into Firestore.
*   **Sprint 3: Basic Navigation and Layout**
    *   Set up main app pages (Homepage, Posts, Lost & Found, Events, Profile).
    * Ensure all links are correctly connected and all pages can be navigated.
    * Finalize basic UI.

### Phase 2: Posts Feature (Sprint 4-6)

This phase introduces the posts feed, allowing students to share content and interact with each other.

*   **Sprint 4: Post Creation**
    *   Develop the ability for students to create posts.
    *   Implement fields for post titles, content (text), and image uploads.
    *   Create a Firestore collection for posts.
    * Display posts on the "Posts" page.
*   **Sprint 5: Content Moderation**
    *   Implement a post approval workflow for moderators (CRs).
    *   Posts need CR approval before displaying.
    *   Create UI for CRs to approve posts.
*   **Sprint 6: Voting and Sorting**
    *   Implement upvote/downvote functionality for posts.
    *   Add sorting options to the posts feed ("Recent" and "Popular").
    *   Create UI elements for voting and sorting.

### Phase 3: Lost & Found (Sprint 7-9)

This phase adds the lost and found feature, enabling students to report lost items and claim found items.

*   **Sprint 7: Reporting Lost/Found Items**
    *   Develop the ability for students to report lost or found items.
    *   Include fields for image uploads, titles, descriptions, time found, and place found.
    *   Create a Firestore collection for lost and found items.
*   **Sprint 8: Claiming Items**
    *   Allow owners to claim lost items.
    *   Implement a process for verifying ownership claims.
*   **Sprint 9: Marking Items as Found/Filtering**
    *   Allow the poster to mark lost items as found after return.
    *   Filter out found items from the main lost and found feed.
    * Implement "Your posts" for the user.

### Phase 4: Events (Sprint 10-12)

This phase adds the event management feature, enabling students to create and register for events.

*   **Sprint 10: Event Creation**
    *   Develop the ability for students to create events.
    *   Include fields for event titles, descriptions, dates, times, and locations.
    *   Create a Firestore collection for events.
*   **Sprint 11: Event Registration**
    *   Allow students to register for events.
    *   Implement a system to track event registrations.
*   **Sprint 12: Liking/Disliking and User Events**
    *   Implement like/dislike functionality for events.
    * Implement "Your events" section for the user.

### Phase 5: Refine and polish (Sprint 13-14):

This phase will consist on refactoring code, fixing any bugs, and improving UX and UI of the platform.

* **Sprint 13: Refactor and bug fix:**
    * Refactor code to improve code quality.
    * Fix any bugs.
* **Sprint 14: Improve UX and UI:**
    * Improve UX and UI of the platform.

### Phase 6: Testing and deployment (Sprint 15):

This phase will consist in testing the whole project and deploying it.

* **Sprint 15: Testing and deployment:**
    * Perform user, integration, unit and E2E testing.
    * Deploy the project.

### Additional Features:

*   **Student ID Logic:** We will implement logic to handle student IDs. The platform will determine if a student is in a 4-year or 2-year program, along with their respective branch codes. This can help to sort or personalize the content that is shown.

## 4. Project Timeline

| Phase                         | Sprint  | Start Date | End Date   | Tasks                                                                                                                                                                 |
| ----------------------------- | ------- | ---------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core Platform Setup           | Sprint 1 | \[Date]    | \[Date]    | Authentication, basic structure, set up Firestore, create basic UI components.                                                                                                |
| Core Platform Setup           | Sprint 2 | \[Date]    | \[Date]    | User profiles.                                                                                                                                                        |
| Core Platform Setup           | Sprint 3 | \[Date]    | \[Date]    | Basic navigation, layout.                                                                                                                                                            |
| Posts Feature                 | Sprint 4 | \[Date]    | \[Date]    | Post creation.                                                                                                                                                          |
| Posts Feature                 | Sprint 5 | \[Date]    | \[Date]    | Content moderation.                                                                                                                                                    |
| Posts Feature                 | Sprint 6 | \[Date]    | \[Date]    | Voting and sorting.                                                                                                                                                    |
| Lost & Found                  | Sprint 7 | \[Date]    | \[Date]    | Reporting lost/found items.                                                                                                                                           |
| Lost & Found                  | Sprint 8 | \[Date]    | \[Date]    | Claiming items.                                                                                                                                                     |
| Lost & Found                  | Sprint 9 | \[Date]    | \[Date]    | Marking items as found/filtering, "Your posts".                                                                                                                                         |
| Events                        | Sprint 10 | \[Date]    | \[Date]    | Event creation.                                                                                                                                                       |
| Events                        | Sprint 11 | \[Date]    | \[Date]    | Event registration.                                                                                                                                                  |
| Events                        | Sprint 12 | \[Date]    | \[Date]    | Liking/disliking, "Your events".                                                                                                                                                               |
| Refine and polish              | Sprint 13 | \[Date]    | \[Date]    | Refactor and bug fix. |
| Refine and polish             | Sprint 14 | \[Date]    | \[Date]    | Improve UX and UI. |
| Testing and Deployment             | Sprint 15 | \[Date]    | \[Date]    | Testing and Deployment. |

## 5. Team Roles

*   **Project Manager:**
    *   Oversees the entire project lifecycle.
    *   Manages timelines, resources, and communication.
    *   Ensures alignment with project goals.
*   **Frontend Developer:**
    *   Designs and implements the user interface.
    *   Develops interactive components and features.
    *   Focuses on the user experience and visual design.
*   **Backend Developer:**
    *   Manages the server-side logic and infrastructure.
    *   Develops and maintains the database and APIs.
    *   Ensures data integrity and system performance.
* **Full Stack Developers:**
    * They will be in charge of the frontend and backend side.
* **Tester:**
    *   Conducts comprehensive testing to ensure functionality and quality.
    *   Identifies and documents bugs.
    *   Works closely with developers to fix issues.
* **CRs**
    * The CRs will be in charge of reviewing and approve the posts.

## 6. Conclusion

This proposed methodology, combined with a well-defined work breakdown, forms a solid foundation for the project's successful execution. Our choice of agile development, combined with modern technologies, allows for iterative development. The team is confident that the planned methodology will deliver a robust and user-friendly social platform that meets the students' needs, fostering a more connected and engaged student community. The regular feedback and testing ensure we will deliver a high quality product.