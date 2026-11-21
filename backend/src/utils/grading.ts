import type { QuestionType } from '../db/schema';
import { numbersMatch, parseNumericAnswer } from './math';

export function gradeAnswer(type: QuestionType, correctAnswer: string, given: string): boolean {
  const answer = given.trim();
  if (!answer) return false;
  if (type === 'MCQ') return answer.toLowerCase() === correctAnswer.trim().toLowerCase();
  const expected = parseNumericAnswer(correctAnswer);
  const actual = parseNumericAnswer(answer);
  if (expected === null || actual === null) return false;
  return numbersMatch(actual, expected);
}
