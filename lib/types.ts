export type Role = "USER" | "MODERATOR" | "ADMIN";

export type FeedAuthor = {
  id?: string;
  name: string;
  username: string;
  avatar: string;
  headline: string;
  credential?: string;
  badges?: string[];
  followed?: boolean;
  verified?: boolean;
};

export type FeedQuestion = {
  id: string;
  slug: string;
  title: string;
  topics: string[];
  topicItems?: TopicSummary[];
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
  acceptedAnswerId?: string | null;
  bookmarkId?: string;
  collectionId?: string | null;
  viewerFeedback?: string[];
  spaces?: Array<{ name: string; slug: string }>;
  matchReason?: string;
  matchedTerms?: string[];
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
  credentialId?: string | null;
  score: number;
  userVote: -1 | 0 | 1;
  bookmarked: boolean;
  createdAt: string;
  comments: CommentSummary[];
  commentCount: number;
  canEdit?: boolean;
  canAccept?: boolean;
  accepted?: boolean;
};

export type QuestionDetailData = FeedQuestion & {
  description: string;
  answersList: AnswerSummary[];
  canEdit?: boolean;
  canDelete?: boolean;
  hasAnswered?: boolean;
  answerRequests?: AnswerRequestItem[];
  spaces?: Array<{ name: string; slug: string }>;
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
  badges?: string[];
  credentials?: CredentialSummary[];
  profileViews?: number;
  acceptedAnswers?: number;
};

export type NotificationItem = {
  id: string;
  type:
    | "answer"
    | "answer-request"
    | "accepted"
    | "upvote"
    | "comment"
    | "follow"
    | "mention"
    | "moderation"
    | "space";
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

export type AdminRowsPage = {
  rows: AdminRow[];
  total: number;
  page: number;
  pageSize: number;
  query: string;
  status: string;
  sort: "asc" | "desc";
};

export type CredentialSummary = {
  id: string;
  label: string;
  organization?: string | null;
  topic?: { id: string; name: string; slug: string } | null;
  url?: string | null;
  isDefault: boolean;
};

export type AnswerRequestItem = {
  id: string;
  questionId: string;
  questionSlug: string;
  questionTitle: string;
  requester: FeedAuthor;
  requestedUser?: FeedAuthor;
  status: "PENDING" | "ANSWERED" | "DISMISSED";
  message?: string | null;
  createdAt: string;
};

export type AnswerRequestQueueItem = AnswerRequestItem & {
  question: FeedQuestion;
};

export type SpaceSummary = {
  id: string;
  slug: string;
  name: string;
  description: string;
  color?: string | null;
  image?: string | null;
  followers: number;
  questions: number;
  role?: "OWNER" | "MODERATOR" | "CONTRIBUTOR" | "MEMBER";
  joined?: boolean;
  rules?: string | null;
  allowMemberSubmissions?: boolean;
  requireApproval?: boolean;
};

export type SpaceViewData = {
  space: SpaceSummary;
  questions: FeedQuestion[];
  pending: FeedQuestion[];
  myQuestions: FeedQuestion[];
  members: Array<FeedAuthor & { role?: SpaceSummary["role"] }>;
};

export type SpaceInviteSummary = {
  id: string;
  role: NonNullable<SpaceSummary["role"]>;
  message?: string | null;
  createdAt: string;
  space: Pick<SpaceSummary, "id" | "slug" | "name" | "description" | "color">;
  inviter: FeedAuthor;
};

export type BookmarkCollectionSummary = {
  id: string;
  name: string;
  description?: string | null;
  count: number;
  createdAt: string;
};

export type SearchSuggestion = {
  label: string;
  href: string;
  type: "question" | "topic" | "person";
};
