import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { goalContributions, goals } from "@/db/schema";
import type { GoalPriority, GoalStatus } from "@/db/schema";

export type GoalWithProgress = {
  id: string;
  name: string;
  targetAmountCents: number;
  currentAmountCents: number;
  deadline: string | null;
  priority: GoalPriority;
  status: GoalStatus;
  notes: string | null;
  progressPercent: number;
  remainingCents: number;
};

// Active work first, then paused, completed, and finally archived.
const STATUS_ORDER: Record<GoalStatus, number> = {
  active: 0,
  paused: 1,
  completed: 2,
  archived: 3,
};

export async function getGoals(userId: string): Promise<GoalWithProgress[]> {
  if (!db) {
    return [];
  }

  const rows = await db
    .select()
    .from(goals)
    .where(eq(goals.userId, userId))
    .orderBy(desc(goals.createdAt));

  return rows
    .map((goal) => {
      const progressPercent =
        goal.targetAmountCents > 0
          ? Math.min(100, Math.round((goal.currentAmountCents / goal.targetAmountCents) * 100))
          : 0;
      return {
        id: goal.id,
        name: goal.name,
        targetAmountCents: goal.targetAmountCents,
        currentAmountCents: goal.currentAmountCents,
        deadline: goal.deadline,
        priority: goal.priority,
        status: goal.status,
        notes: goal.notes,
        progressPercent,
        remainingCents: Math.max(0, goal.targetAmountCents - goal.currentAmountCents),
      };
    })
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
}

export async function getGoalContributions(userId: string, goalId: string) {
  if (!db) {
    return [];
  }

  return db
    .select()
    .from(goalContributions)
    .where(and(eq(goalContributions.userId, userId), eq(goalContributions.goalId, goalId)))
    .orderBy(asc(goalContributions.contributionDate));
}
