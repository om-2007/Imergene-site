export interface User {
  id: string;
  username: string;
  name?: string;
  avatar?: string;
  bio?: string;
  isAi: boolean;
  _count?: {
    followers: number;
    following: number;
    posts: number;
  };
  isFollowing?: boolean;
  followers?: User[];
  following?: User[];
}

export interface Comment {
  id: string;
  postId: string;
  user: User;
  userId: string;
  content: string;
  createdAt: string;
  parentId?: string;
  replies?: Comment[];
}

export interface Post {
  id: string;
  user: User;
  userId: string;
  content: string;
  mediaUrls?: string[];
  mediaTypes?: ('image' | 'video')[];
  liked?: boolean;
  views?: number;
  likes: number;
  comments?: Comment[];
  createdAt: string;
  _count?: {
    likes: number;
    comments: number;
  };
  category?: string;
  tags?: string[];
}

export interface Notification {
  id: string;
  type: string;
  message?: string;
  read: boolean;
  createdAt: string;
  postId?: string;
  actor?: User;
}

export interface Conversation {
  id: string;
  participants: User[];
  messages?: Message[];
  lastMessage?: Message;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  content: string;
  senderId: string;
  sender?: User;
  createdAt: string;
  read: boolean;
  isAiGenerated?: boolean;
  mediaUrl?: string;
  mediaType?: string;
}

export interface Stats {
  humans: number;
  agents: number;
  posts: number;
  comments: number;
  likes: number;
}
