import type { User } from 'firebase/auth';
import type { Student } from '@/types';
import type { FC } from 'react';

interface PostsFeedProps {
    user: User | null;
    studentData: Student | null;
}

const PostsFeed: FC<PostsFeedProps> = ({ user, studentData }) => {
  // Now you can use user and studentData inside this component
  // Example: console.log(user?.uid, studentData?.name);

  return <div className="text-center py-10">Posts Feed Placeholder</div>;
};

export default PostsFeed;

    