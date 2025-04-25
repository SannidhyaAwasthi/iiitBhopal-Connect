import type { User } from 'firebase/auth';
import type { Student } from '@/types';
import type { FC } from 'react';

interface EventsFeedProps {
    user: User | null;
    studentData: Student | null;
}

const EventsFeed: FC<EventsFeedProps> = ({ user, studentData }) => {
    // Now you can use user and studentData inside this component
  return <div className="text-center py-10">Events Feed Placeholder</div>;
};

export default EventsFeed;

    