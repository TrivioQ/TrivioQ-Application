export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  notificationsEnabled: boolean;
  language: string;
  categoryPercentages: Record<string, number>;
  targetDropsPerWeek: number;
  difficultyPercentages: Record<string, number>;
  displayName?: string;
  // activeWindowStart / activeWindowEnd live as typed DateTime columns on User,
  // not in this JSON blob. They are accepted by PUT /preferences but not stored here.
}

export interface QuestionDropPayload {
  dropId: string;
  questionId: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questionText: string;
  options: { id: string; text: string }[];
  expiresAt: number;
  answerDeadline: number | null;
  pointsValue: number;
  hintCost: number;
  usedHint: boolean;
  revealedAnswer: boolean;
}

export interface AnswerSubmission {
  questionId: string;
  userId: string;
  selectedOptionIndex: number;
  timeTakenMs: number;
}

export interface AnswerResponse {
  isCorrect: boolean;
  correctOptionIndex: number;
  pointsAwarded: number;
  explanation?: string;
}

export enum SubscriptionTier {
  FREE = 'FREE',
  PREMIUM = 'PREMIUM',
  PLUS = 'PLUS',
}

export interface SuggestedChoice {
  text: string;
  order: number;
  isCorrect: boolean;
}

export enum DifficultyLevel {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
}

export interface PendingQuestionPayload {
  id: string;
  topic: string;
  categorySlug: string;
  difficultyLevel: DifficultyLevel;
  suggestedText: string;
  suggestedChoices: SuggestedChoice[];
  hint?: string | null;
  explanation?: string | null;
  status: string;
  rejectionReason?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface UserProfile {
  id: string;
  firebaseUid: string;
  email: string;
  username: string;
  displayName?: string | null;
  profilePicture?: string | null;
  subscriptionTier: SubscriptionTier;
  dropsReceivedToday: number;
  lastDropDate: Date | string;
  currentStreak: number;
  cumulativeScore: number;
  activeWindowStart: string;
  activeWindowEnd: string;
  preferences?: any;
}

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

export enum NotificationType {
  TRIVIA_DROP = 'TRIVIA_DROP',
  SYSTEM_ANNOUNCEMENT = 'SYSTEM_ANNOUNCEMENT',
  SUBSCRIPTION_REMINDER = 'SUBSCRIPTION_REMINDER',
  OFFER_PROMOTION = 'OFFER_PROMOTION',
  CREDIT_ALERT = 'CREDIT_ALERT',
  ADMIN_MESSAGE = 'ADMIN_MESSAGE',
}

export enum NotificationChannel {
  PUSH_MOBILE = 'PUSH_MOBILE',
  PUSH_WEB = 'PUSH_WEB',
  EMAIL = 'EMAIL',
}

export enum NotificationAudience {
  ALL_USERS = 'ALL_USERS',
  USER_SEGMENT = 'USER_SEGMENT',
  SPECIFIC_USERS = 'SPECIFIC_USERS',
}

export enum NotificationStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  SENDING = 'SENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface NotificationPreferences {
  triviaDrop: boolean;
  systemAnnouncement: boolean;
  subscriptionReminder: boolean;
  offerPromotion: boolean;
  creditAlert: boolean;
  adminMessage: boolean;
  enablePushNotification: boolean;
  enableWebPushNotification: boolean;
  enableEmailNotification: boolean;
}

export interface UserNotification {
  id: string;
  notificationId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  isRead: boolean;
  pushDelivered: boolean;
  emailDelivered: boolean;
  readAt?: Date | string | null;
  clickedAt?: Date | string | null;
  createdAt: Date | string;
}

export interface CreateNotificationInput {
  type: NotificationType;
  audience: NotificationAudience;
  title: string;
  body: string;
  data?: Record<string, any>;
  channels: NotificationChannel[];
  targetUserIds?: string[];
  targetCriteria?: Record<string, any>;
  scheduledAt?: Date;
}

export interface CreateTemplateInput {
  name: string;
  type: NotificationType;
  title: string;
  body: string;
  emailSubject?: string;
  emailHtml?: string;
  channels: NotificationChannel[];
  variables: string[];
}

export interface WebPushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
  browser?: string;
}

// ── Client API shapes (web + mobile) ─────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  id: string;
  username: string;
  displayName: string | null;
  currentStreak: number;
  cumulativeScore: number;
  baseScore: number;
  bonusScore: number;
}

export interface LeaderboardPosition {
  rank: number | null;
  score: number;
  pointsToNextRank: number | null;
}

export interface TodayProgress {
  answeredToday: number;
  receivedToday: number;
  dailyLimit: number;
  nextDropAt: string | null;
  windowStart: string;
  windowEnd: string;
  currentStreak: number;
  streakAtRisk: boolean;
  lastResult: {
    wasCorrect: boolean;
    revealedAnswer: boolean;
    pointsAwarded: number;
    answeredAt: string | null;
    category: string | null;
  } | null;
}

export interface DropHistoryItem {
  id: string;
  wasCorrect: boolean | null;
  pointsAwarded: number;
  usedHint: boolean;
  hintCostDeducted: number;
  revealedAnswer: boolean;
  selectedChoiceId: string | null;
  answeredAt: string | null;
  question: {
    id: string;
    questionText: string;
    difficultyLevel: 'EASY' | 'MEDIUM' | 'HARD';
    explanationText: string | null;
    categories: { name: string }[];
    choices: { id: string; text: string; order: number; isCorrect: boolean }[];
  };
}

export type DropHistoryFilter = 'all' | 'correct' | 'incorrect' | 'revealed';

export interface MistakeQuestion {
  questionId: string;
  questionText: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  options: { id: string; text: string }[];
}

export interface PracticeResult {
  isCorrect: boolean;
  correctOptionIndex: number;
  explanation?: string;
}

export type FriendRelationship = 'NONE' | 'OUTGOING' | 'INCOMING' | 'ACCEPTED';

export interface UserSearchResult {
  id: string;
  username: string;
  displayName: string | null;
  profilePicture: string | null;
  relationship: FriendRelationship;
}

export interface NotificationPreferences {
  triviaDrop: boolean;
  systemAnnouncement: boolean;
  subscriptionReminder: boolean;
  offerPromotion: boolean;
  creditAlert: boolean;
  adminMessage: boolean;
  socialActivity: boolean;
  streakReminder: boolean;
  enablePushNotification: boolean;
  enableWebPushNotification: boolean;
  enableEmailNotification: boolean;
}

export interface SubmitAnswerResult {
  isCorrect: boolean;
  correctOptionIndex: number;
  pointsAwarded: number;
  revealedAnswer: boolean;
  explanation?: string;
  newStreak: number;
  newTotalScore: number;
  category: string;
  difficulty: string;
}

export * from './client-utils';
