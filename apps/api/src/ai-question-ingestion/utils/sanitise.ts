/**
 * Shared sanitisation helpers for AI-returned enum values.
 *
 * Both `QuestionExtractionProcess` and `QuizGenerationProcess` previously
 * duplicated these guards. Centralising them here ensures the allowed value
 * sets stay in sync when new enum members are added.
 */

import { DifficultyLevel, AgeRating } from '@trivioq/database';

const VALID_DIFFICULTIES: DifficultyLevel[] = ['EASY', 'MEDIUM', 'HARD'];

/**
 * Validates an AI-returned difficulty string.
 * Falls back to MEDIUM if the value is missing or unrecognised.
 */
export function sanitiseDifficulty(raw: string | undefined): DifficultyLevel {
  if (raw && (VALID_DIFFICULTIES as string[]).includes(raw)) {
    return raw as DifficultyLevel;
  }
  return 'MEDIUM';
}

const VALID_AGE_RATINGS: AgeRating[] = ['ALL', 'TEEN', 'MATURE'];

/**
 * Validates an AI-returned age rating string.
 * Falls back to ALL (the safest default) if the value is missing or unrecognised.
 */
export function sanitiseAgeRating(raw: string | undefined): AgeRating {
  if (raw && (VALID_AGE_RATINGS as string[]).includes(raw)) {
    return raw as AgeRating;
  }
  return 'ALL';
}
