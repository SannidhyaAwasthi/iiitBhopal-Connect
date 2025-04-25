import type { User } from 'firebase/auth';
import type { Student } from '@/types';
import type { FC } from 'react';

interface UserEventsProps {
    user: User | null;
    studentData: Student | null;
}

const UserEvents: FC<UserEventsProps> = ({ user, studentData }) => {
    // Now you can use user and studentData inside this component
  return <div className="text-center py-10">Your Events Placeholder</div>;
};

export default UserEvents;

    