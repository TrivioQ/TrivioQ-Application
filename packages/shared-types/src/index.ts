export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  notificationsEnabled: boolean;
  language: string;
  categoryPercentages: Record<string, number>;
  activeWindowStart: string; // 'HH:MM'
  activeWindowEnd: string; // 'HH:MM'
  targetDropsPerWeek: number;
  difficultyPercentages: Record<string, number>;
}

export interface QuestionDropPayload {
  dropId: string;
  questionId: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questionText: string;
  options: string[];
  expiresAt: number;
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
}
