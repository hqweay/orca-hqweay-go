/**
 * Topic 卡片专用调度器
 *
 * Topic 不使用 FSRS 的遗忘曲线模型，因为文章不会被"遗忘"，
 * 只是需要被"再次加工"。
 *
 * 采用简单的递增间隔公式：nextInterval = currentInterval × multiplier
 * 配合用户评分语义来控制加工节奏。
 */

/**
 * Topic 评分类型
 * - soon: 还需要继续处理（间隔缩短）
 * - done: 本次阅读完成（标准递增）
 * - easy: 快速扫过/不太重要（大幅递增）
 */
export type TopicGrade = "soon" | "done" | "easy";

/**
 * Topic 的持久化状态（存储在 srsData 字段中）
 */
export interface TopicState {
  type: "topic"; // 用于区分 FSRS 和 Topic 状态
  interval: number; // 当前间隔（天）
  reps: number; // 已阅读次数
  lastReviewed: number | null; // 上次阅读时间戳
}

// ─── 配置常量 ───────────────────────────────────────────────

/** 首次阅读后的默认间隔（天） */
const DEFAULT_INTERVALS: Record<TopicGrade, number> = {
  soon: 1, // 明天继续
  done: 3, // 3 天后
  easy: 7, // 一周后
};

/** 间隔递增乘数 */
const MULTIPLIERS: Record<TopicGrade, number> = {
  soon: 0.5, // 缩短一半（但有下限）
  done: 2.0, // 标准翻倍
  easy: 4.0, // 快速拉长
};

/** 间隔下限（天） */
const MIN_INTERVAL = 1;

/** 间隔上限（天），约半年 */
const MAX_INTERVAL = 180;

// ─── 核心函数 ───────────────────────────────────────────────

/**
 * 创建空的 Topic 状态
 */
export function createEmptyTopicState(): TopicState {
  return {
    type: "topic",
    interval: 0,
    reps: 0,
    lastReviewed: null,
  };
}

/**
 * 判断一个 srsData 对象是否为 TopicState
 */
export function isTopicState(data: any): data is TopicState {
  return data && data.type === "topic";
}

/**
 * 计算 Topic 卡片下一次出现的时间
 *
 * 公式：
 *   - 新卡片：使用 DEFAULT_INTERVALS[grade]
 *   - 旧卡片：nextInterval = clamp(currentInterval × MULTIPLIERS[grade], MIN, MAX)
 *
 * @param savedState 当前保存的 Topic 状态（新卡传 null）
 * @param grade 用户评分
 * @param now 当前时间
 */
export function calculateTopicNextReview(
  savedState: TopicState | null,
  grade: TopicGrade,
  now: Date = new Date(),
): { nextState: TopicState; nextDue: Date } {
  const current = savedState || createEmptyTopicState();
  const isNew = current.reps === 0;

  let nextInterval: number;

  if (isNew) {
    // 新卡片：使用固定初始间隔
    nextInterval = DEFAULT_INTERVALS[grade];
  } else {
    // 旧卡片：基于当前间隔递增
    const rawInterval = current.interval * MULTIPLIERS[grade];
    nextInterval = Math.max(MIN_INTERVAL, Math.min(MAX_INTERVAL, rawInterval));
  }

  // 计算 Due Date
  const nextDue = new Date(now.getTime() + nextInterval * 24 * 60 * 60 * 1000);

  const nextState: TopicState = {
    type: "topic",
    interval: nextInterval,
    reps: current.reps + 1,
    lastReviewed: now.getTime(),
  };

  return { nextState, nextDue };
}

/**
 * 预测各个评分对应的下一次间隔（用于 UI 显示）
 */
export function predictTopicIntervals(
  savedState: TopicState | null,
): Record<TopicGrade, number> {
  const current = savedState || createEmptyTopicState();
  const isNew = current.reps === 0;

  const grades: TopicGrade[] = ["soon", "done", "easy"];
  const result: Record<string, number> = {};

  for (const grade of grades) {
    if (isNew) {
      result[grade] = DEFAULT_INTERVALS[grade];
    } else {
      const raw = current.interval * MULTIPLIERS[grade];
      result[grade] = Math.max(MIN_INTERVAL, Math.min(MAX_INTERVAL, raw));
    }
  }

  return result as Record<TopicGrade, number>;
}
