import { FSRS, Rating, State, createEmptyCard } from "ts-fsrs"
import type { Card } from "ts-fsrs"

/**
 * FSRS 评分类型
 * 1: Again (忘记)
 * 2: Hard (困难)
 * 3: Good (记得)
 * 4: Easy (简单)
 */
export type FsrsGrade = "again" | "hard" | "good" | "easy"

const GRADE_MAP: Record<FsrsGrade, Rating> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
}

// 采用 ts-fsrs 默认参数初始化 FSRS 实例
// ts-fsrs 5.x requires an empty object if using defaults
const fsrs = new FSRS({})

/**
 * 我们存储在标签属性 `srsData` 中的持久化状态结构
 */
export interface CardState {
  stability: number
  difficulty: number
  interval: number
  due: number // timestamp
  lastReviewed: number | null // timestamp
  reps: number
  lapses: number
  state: State // 内部枚举 0:New, 1:Learning, 2:Review, 3:Relearning
}

/**
 * 反序列化为 FSRS 原生 Card 对象
 */
function toFsrsCard(savedState: CardState | null, now: Date = new Date()): Card {
  const base = createEmptyCard(now)
  if (!savedState) {
    return base
  }

  return {
    ...base,
    stability: savedState.stability,
    difficulty: savedState.difficulty,
    due: new Date(savedState.due),
    last_review: savedState.lastReviewed ? new Date(savedState.lastReviewed) : undefined,
    scheduled_days: savedState.interval,
    reps: savedState.reps,
    lapses: savedState.lapses,
    state: savedState.state,
  }
}

/**
 * 将 FSRS 原生 Card 对象序列化为我们要保存的 JSON
 */
function fromFsrsCard(card: Card, lastReviewed?: Date): CardState {
  return {
    stability: card.stability,
    difficulty: card.difficulty,
    interval: card.scheduled_days,
    due: card.due.getTime(),
    lastReviewed: lastReviewed ? lastReviewed.getTime() : (card.last_review?.getTime() ?? null),
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
  }
}

/**
 * 计算一次评分后的最新状态
 *
 * @param savedState 当前保存在块属性里的 JSON 状态（若是新卡传 null）
 * @param grade 用户给出的评分 (again | hard | good | easy)
 * @param now 当前时间
 * @returns { nextState, nextDue }
 */
export function calculateNextReview(
  savedState: CardState | null,
  grade: FsrsGrade,
  now: Date = new Date(),
): { nextState: CardState; nextDue: Date } {
  const fsrsCard = toFsrsCard(savedState, now)

  // 这里的 next() 会计算四个评分的结果，按对应 Rating 取值即可
  const ratingRecord = fsrs.next(fsrsCard, now, GRADE_MAP[grade] as any)

  const nextState = fromFsrsCard(ratingRecord.card, ratingRecord.log.review)
  return {
    nextState,
    nextDue: ratingRecord.card.due,
  }
}
