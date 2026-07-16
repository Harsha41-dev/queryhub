export type Role = "USER" | "MODERATOR" | "ADMIN";

export type FeedAuthor = {
  id?: string;
  name: string;
  username: string;
  avatar: string;
  headline: string;
  verified?: boolean;
};

export type FeedQuestion = {
  id: string;
  slug: string;
  title: string;
  topics: string[];
  author: FeedAuthor;
  answer: string;
  publishedAt: string;
  score: number;
  comments: number;
  views: number;
  answers: number;
  followed?: boolean;
  bookmarked?: boolean;
  userVote?: -1 | 0 | 1;
  description?: string;
  followerCount?: number;
  authorId?: string;
  createdAt?: string;
  bookmarkAnswerId?: string;
  voteAnswerId?: string;
};

export type CommentSummary = {
  id: string;
  content: string;
  author: FeedAuthor;
  score: number;
  userVote: -1 | 0 | 1;
  createdAt: string;
  parentId?: string | null;
  replies?: CommentSummary[];
  canEdit?: boolean;
};

export type AnswerSummary = {
  id: string;
  content: string;
  author: FeedAuthor;
  score: number;
  userVote: -1 | 0 | 1;
  bookmarked: boolean;
  createdAt: string;
  comments: CommentSummary[];
  commentCount: number;
  canEdit?: boolean;
};

export type QuestionDetailData = FeedQuestion & {
  description: string;
  answersList: AnswerSummary[];
  canEdit?: boolean;
  hasAnswered?: boolean;
};

export type TopicSummary = {
  id?: string;
  slug: string;
  name: string;
  description: string;
  followers: number;
  questions: number;
  accent: string;
  icon: string;
  followed?: boolean;
};

export type PersonSummary = FeedAuthor & {
  id?: string;
  followers: number;
  answers: number;
  expertise: string[];
  questions?: number;
  reputation?: number;
  following?: boolean;
  bio?: string;
  occupation?: string;
  location?: string;
  website?: string;
  joinedAt?: string;
};

export type NotificationItem = {
  id: string;
  type: "answer" | "upvote" | "comment" | "follow" | "mention" | "moderation";
  actorName: string;
  actorAvatar?: string | null;
  message: string;
  detail: string;
  href: string;
  createdAt: string;
  read: boolean;
};

export type AdminRow = {
  id: string;
  primary: string;
  secondary: string;
  meta: string;
  status: string;
  date: string;
  avatar?: string | null;
  href?: string;
  target?: "question" | "answer" | "comment" | "user" | "topic";
};
