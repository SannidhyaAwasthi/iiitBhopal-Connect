import type { User } from 'firebase/auth';
import type { Student } from '@/types';
import type { FC } from 'react';

interface UserPostsProps {
    user: User | null;
    studentData: Student | null;
}

const UserPosts: FC<UserPostsProps> = ({ user, studentData }) => {
    // Now you can use user and studentData inside this component
  return <div className="text-center py-10">Your Posts Placeholder</div>;
};

export default UserPosts;

    