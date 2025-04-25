import type { User } from 'firebase/auth';
import type { Student } from '@/types';
import type { FC } from 'react';

interface LostAndFoundFeedProps {
    user: User | null;
    studentData: Student | null;
}

const LostAndFoundFeed: FC<LostAndFoundFeedProps> = ({ user, studentData }) => {
    // Now you can use user and studentData inside this component
  return <div className="text-center py-10">Lost &amp; Found Feed Placeholder</div>;
};

export default LostAndFoundFeed;

    