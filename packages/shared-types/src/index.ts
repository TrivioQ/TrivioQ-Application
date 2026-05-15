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
  options: string[];
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
