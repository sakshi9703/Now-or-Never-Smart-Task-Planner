export interface Subtask {
  id: string;
  title: string;
  status: "pending" | "completed";
  estimatedHours: number;
}

export interface RiskAnalysis {
  riskLevel: "low" | "medium" | "high";
  probability: number; // 0-100
  reasoning: string;
  isFallback?: boolean;
}

export interface RescuePlan {
  emergencyPlan: string;
  timeBlockedSchedule: {
    timeSlot: string;
    action: string;
  }[];
  immediateActions: string[];
  isFallback?: boolean;
}

export interface CoachAdvice {
  summary: string;
  priorityExplanation: string;
  riskExplanation: string;
  nextAction: string;
  isFallback?: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  deadline?: string;
  priority: "low" | "medium" | "high" | "urgent";
  effortHours: number;
  status: "pending" | "completed";
  userId: string;
  subtasks: Subtask[];
  executionStrategy?: string;
  riskAnalysis?: RiskAnalysis;
  rescuePlan?: RescuePlan;
  coachAdvice?: CoachAdvice;
  createdAt: any;
  updatedAt: any;
  breakdownGenerated?: boolean;
  breakdownIsFallback?: boolean;
  aiSummary?: string;
  aiPriority?: "low" | "moderate" | "high";
  category?: string;
  notes?: string;
  startTime?: string;
  startDate?: string;
  estimatedDuration?: number;
  expectedCompletion?: string;
  dueDate?: string;
}

export interface DailyPlan {
  dailyCoachMessage: string;
  priorities: string[]; // Task IDs or custom priorities
  suggestedSchedule: {
    time: string;
    taskTitle: string;
    action: string;
  }[];
  isFallback?: boolean;
}

export interface SheetsSyncConfig {
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  isEnabled: boolean;
  lastSyncedAt?: string;
}

export interface UserProfile {
  userId: string;
  email: string;
  productivityScore?: number;
  dailyPlan?: DailyPlan;
  sheetsSyncConfig?: SheetsSyncConfig;
  updatedAt: any;
  emailNotificationsEnabled?: boolean;
  dailyEmailSentDate?: string;
  categories?: string[];
}

export function formatDuration(effortHours: number): string {
  const totalMinutes = Math.round(effortHours * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return `${minutes}m`;
  }
}

export function getDerivedStatus(task: Task, nowInput?: Date | number): "completed" | "overdue" | "pending" {
  if (task.status === "completed") {
    return "completed";
  }
  const now = nowInput ? new Date(nowInput).getTime() : Date.now();
  if (task.startTime) {
    const startVal = new Date(task.startTime).getTime();
    if (!isNaN(startVal) && now > startVal) {
      return "overdue";
    }
  }
  return "pending";
}

export interface CalculatedRisk {
  score: number;
  level: "Low" | "Medium" | "High";
  reasons: string[];
  recommendation: string;
  expectedCompletion: string;
}

export function calculateTaskRisk(task: Task, nowInput?: Date): CalculatedRisk {
  if (task.status === "completed") {
    return {
      score: 0,
      level: "Low",
      reasons: ["Task is completed successfully."],
      recommendation: "Excellent job! No further actions needed.",
      expectedCompletion: "Completed",
    };
  }

  const now = nowInput || new Date();
if (!task.deadline) {
  return {
    score: 0,
    level: "Low",
    reasons: ["No deadline has been set."],
    recommendation: "Set a deadline to accurately calculate task risk.",
    expectedCompletion: "Not scheduled",
  };
}

const deadline = new Date(task.deadline);
  const diffMs = deadline.getTime() - now.getTime();
  const effortMs = (task.effortHours || 1) * 3600 * 1000;

  // 1. Proximity Risk (0 to 40)
  let proximityScore = 0;
  if (diffMs <= 0) {
    proximityScore = 40; // Overdue
  } else if (diffMs <= effortMs) {
    proximityScore = 35; // Immediate start required
  } else if (diffMs <= 12 * 3600 * 1000) {
    proximityScore = 25; // Under 12h
  } else if (diffMs <= 24 * 3600 * 1000) {
    proximityScore = 15; // Under 24h
  } else if (diffMs <= 48 * 3600 * 1000) {
    proximityScore = 10; // Under 48h
  } else {
    proximityScore = 2;
  }

  // 2. Priority Weight (0 to 20)
  const priorityScore =
    task.priority === "urgent" ? 20 :
    task.priority === "high" ? 15 :
    task.priority === "medium" ? 10 : 5;

  // 3. Progress/Subtask Risk (0 to 40)
  const totalSubtasks = task.subtasks ? task.subtasks.length : 0;
  const completedSubtasks = task.subtasks ? task.subtasks.filter((s) => s.status === "completed").length : 0;
  const progressFraction = totalSubtasks > 0 ? completedSubtasks / totalSubtasks : 0;
  const remainingFraction = 1 - progressFraction;
  const subtaskScore = Math.round(remainingFraction * 40);

  // Raw score calculation
  let rawScore = proximityScore + priorityScore + subtaskScore;

  // Overdue defaults to very high risk
  if (diffMs <= 0) {
    rawScore = Math.max(85, Math.min(100, 80 + priorityScore));
  } else {
    // Keep between 5 and 95 for uncompleted tasks that are not overdue
    rawScore = Math.max(5, Math.min(95, rawScore));
  }

  const score = Math.round(rawScore);

  let level: "Low" | "Medium" | "High" = "Low";
  if (score > 70) {
    level = "High";
  } else if (score > 30) {
    level = "Medium";
  }

  // Generate Reasons
  const reasons: string[] = [];
  const timeFormatOption: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  const dateFormatOption: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };

  if (diffMs <= 0) {
    reasons.push(`• Deadline was on ${deadline.toLocaleDateString(undefined, dateFormatOption)} at ${deadline.toLocaleTimeString(undefined, timeFormatOption)} (Overdue)`);
  } else {
    const isToday = deadline.toDateString() === now.toDateString();
    if (isToday) {
      reasons.push(`• Deadline is today at ${deadline.toLocaleTimeString(undefined, timeFormatOption)}`);
    } else {
      reasons.push(`• Deadline is ${deadline.toLocaleDateString(undefined, dateFormatOption)} at ${deadline.toLocaleTimeString(undefined, timeFormatOption)}`);
    }

    const hoursLeft = diffMs / (3600 * 1000);
    reasons.push(`• Only ${formatDuration(hoursLeft)} remaining`);
  }

  reasons.push(`• Estimated duration is ${formatDuration(task.effortHours)}`);

  if (totalSubtasks === 0) {
    reasons.push(`• Task has not been started`);
  } else if (completedSubtasks === 0) {
    reasons.push(`• 0 of ${totalSubtasks} subtasks completed`);
  } else {
    reasons.push(`• Only ${completedSubtasks} of ${totalSubtasks} subtasks completed (${Math.round(progressFraction * 100)}% progress)`);
  }

  if (diffMs > 0 && diffMs <= effortMs) {
    reasons.push(`• Only limited time remains to finish`);
  }

  // Recommendations
  let recommendation = "On track. Maintain current execution speed.";
  if (diffMs <= 0) {
    recommendation = "Task is overdue. Complete immediately to prevent critical backlog overflow.";
  } else if (score > 70) {
    recommendation = "Start immediately. Focus 100% of available effort on this delivery.";
  } else if (score > 30) {
    recommendation = "Schedule a dedicated work block today to avoid deadline stress.";
  }

  // Expected completion
  let expectedCompletion = "Completed";
  if (diffMs <= 0) {
    expectedCompletion = "ASAP (Overdue)";
  } else {
    const remainingHours = (task.effortHours || 1) * remainingFraction;
    const expectedDate = new Date(now.getTime() + remainingHours * 3600 * 1000);
    const isToday = expectedDate.toDateString() === now.toDateString();
    if (isToday) {
      expectedCompletion = expectedDate.toLocaleTimeString(undefined, timeFormatOption);
    } else {
      expectedCompletion = `${expectedDate.toLocaleDateString(undefined, dateFormatOption)}, ${expectedDate.toLocaleTimeString(undefined, timeFormatOption)}`;
    }
  }


  return {
    score,
    level,
    reasons,
    recommendation,
    expectedCompletion,
  };
}

export interface CalculatedProductivity {
  score: number;
  rating: string;
  performance: string;
  reasons: string[];
  suggestions: string[];
  coachMessage: string;
  breakdown: {
    completionRate: number;
    onTimeCompletion: number;
    streak: number;
    priorityBonus: number;
    weeklyConsistency: number;
  };
  todayImpact: {
    points: number;
    completedTitles: string[];
  };
  weeklyTrend: {
    diff: number;
    text: string;
  };
  summaryStats: {
    completedCount: number;
    overdueCount: number;
    streakCount: number;
    onTimeRate: number;
  };
}

export function calculateProductivityScore(tasks: Task[]): CalculatedProductivity {
  const getLocalDateString = (updatedAt: any): string => {
    if (!updatedAt) return "";
    let d: Date;
    if (typeof updatedAt === "string") {
      d = new Date(updatedAt);
    } else if (updatedAt.seconds) {
      d = new Date(updatedAt.seconds * 1000);
    } else if (updatedAt instanceof Date) {
      d = updatedAt;
    } else {
      d = new Date(updatedAt);
    }
    if (isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const totalCount = tasks.length;
  if (totalCount === 0) {
    return {
      score: 0,
      rating: "🌱",
      performance: "Getting Started",
      reasons: ["No active tasks currently scheduled."],
      suggestions: ["Create your first task to begin tracking productivity."],
      coachMessage: "Create your first task to begin tracking productivity.",
      breakdown: {
        completionRate: 0,
        onTimeCompletion: 0,
        streak: 0,
        priorityBonus: 0,
        weeklyConsistency: 0,
      },
      todayImpact: {
        points: 0,
        completedTitles: [],
      },
      weeklyTrend: {
        diff: 0,
        text: "No change this week",
      },
      summaryStats: {
        completedCount: 0,
        overdueCount: 0,
        streakCount: 0,
        onTimeRate: 0,
      }
    };
  }

  const completedTasks = tasks.filter((t) => t.status === "completed");
  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const overdueTasks = pendingTasks.filter((t) => getDerivedStatus(t) === "overdue");

  const completedCount = completedTasks.length;
  const overdueCount = overdueTasks.length;

  // 1. Completion Rate (40%)
  const completionRateVal = completedCount / totalCount;
  const completionRatePoints = Math.round(completionRateVal * 40);

  // 2. On-Time Completion Rate (25%)
  const onTimeCompletedCount = completedTasks.filter((t) => {
    if (!t.startTime) return true;
    if (!t.updatedAt) return true;
    const updatedTime = t.updatedAt?.seconds ? t.updatedAt.seconds * 1000 : new Date(t.updatedAt).getTime();
    return updatedTime <= new Date(t.startTime).getTime();
  }).length;

  let onTimePoints = 0;
  if (completedCount > 0) {
    onTimePoints = Math.round((onTimeCompletedCount / completedCount) * 25);
  }

  // 3. Daily Streak (15%)
  const currentStreak = calculateStreak(tasks);
  const streakPoints = Math.min(15, currentStreak * 3);

  // 4. High Priority Task Completion (10%)
  const highPriorityTasks = tasks.filter((t) => t.priority === "high" || t.priority === "urgent");
  let priorityPoints = 10;
  if (highPriorityTasks.length > 0) {
    const highPriorityCompletedCount = highPriorityTasks.filter((t) => t.status === "completed").length;
    priorityPoints = Math.round((highPriorityCompletedCount / highPriorityTasks.length) * 10);
  } else {
    priorityPoints = Math.round(completionRateVal * 10);
  }

  // 5. Weekly Consistency (10%)
  const completedDates = completedTasks.map(t => getLocalDateString(t.updatedAt)).filter(Boolean);
  const completedDatesSet = new Set(completedDates);

  const last7DaysDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const activeDaysCount = last7DaysDates.filter(dStr => completedDatesSet.has(dStr)).length;
  const weeklyConsistencyPoints = Math.min(10, Math.round((activeDaysCount / 5) * 10));

  // Compute final score
  const score = Math.max(0, Math.min(100, completionRatePoints + onTimePoints + streakPoints + priorityPoints + weeklyConsistencyPoints));

  // Determine dynamic qualitative level and symbol
  let performance = "Getting Started";
  let rating = "🌱";

  if (score >= 96) {
    performance = "Elite";
    rating = "🚀";
  } else if (score >= 85) {
    performance = "Excellent";
    rating = "⭐";
  } else if (score >= 70) {
    performance = "Great";
    rating = "👍";
  } else if (score >= 50) {
    performance = "Improving";
    rating = "📈";
  } else if (score >= 30) {
    performance = "Needs Focus";
    rating = "🎯";
  } else {
    performance = "Getting Started";
    rating = "🌱";
  }

  // Generate dynamic explanations/reasons
  const reasons: string[] = [];
  reasons.push(`Completion rate of ${Math.round(completionRateVal * 100)}% (${completedCount} of ${totalCount} tasks completed).`);
  if (completedCount > 0) {
    reasons.push(`${Math.round((onTimeCompletedCount / completedCount) * 100)}% of tasks completed on-time.`);
  }
  if (currentStreak > 0) {
    reasons.push(`Maintained a ${currentStreak}-day productivity streak.`);
  }
  if (highPriorityTasks.length > 0) {
    const highPriorityCompletedCount = highPriorityTasks.filter((t) => t.status === "completed").length;
    reasons.push(`Completed ${highPriorityCompletedCount} of ${highPriorityTasks.length} high priority tasks.`);
  }

  // Generate personalized coaching message based on actual data
  let coachMessage = "";

  // 1. Only consider actionable tasks when generating recommendations.
  // - Include only tasks whose status is Pending or Overdue.
  // - Exclude every Completed task.
  // - Never recommend completed tasks, deleted tasks, or invalid or archived tasks.
  const isValidActionableTask = (t: Task) => {
    if (!t || !t.id || !t.title) return false;
    if (t.status === "completed") return false;
    if (getDerivedStatus(t) === "completed") return false;
    if ((t as any).deleted || (t as any).isDeleted || (t as any).archived || (t as any).isArchived) return false;
    return true;
  };

  const actionableTasks = tasks.filter(isValidActionableTask);

  const getTaskPriorityWeight = (priority: string): number => {
    switch (priority) {
      case "urgent": return 4;
      case "high": return 3;
      case "medium": return 2;
      case "low": return 1;
      default: return 0;
    }
  };

  const isTaskOverdue = (t: Task): boolean => {
    return getDerivedStatus(t) === "overdue";
  };

  const suggestions: string[] = [];

  if (actionableTasks.length === 0) {
    // 2. If there are no pending or overdue tasks, display a positive completion message instead.
    coachMessage = "Excellent work! You've completed all your current tasks.";
    suggestions.push("• No pending tasks remaining. You're all caught up!");
    suggestions.push("• Great job staying on top of your objectives.");
    suggestions.push("• Continue following your scheduled focus blocks.");
  } else {
    // 4. Sort recommended tasks: Overdue first, then urgent, then high, then medium, then low.
    const sortedActionableTasks = [...actionableTasks].sort((a, b) => {
      const overdueA = isTaskOverdue(a);
      const overdueB = isTaskOverdue(b);
      
      // Overdue tasks first
      if (overdueA && !overdueB) return -1;
      if (!overdueA && overdueB) return 1;

      // Priority order
      const pA = getTaskPriorityWeight(a.priority);
      const pB = getTaskPriorityWeight(b.priority);
      if (pB !== pA) return pB - pA;

      // Tie-breaker
      const timeA = a.startTime ? new Date(a.startTime).getTime() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : Infinity);
      const timeB = b.startTime ? new Date(b.startTime).getTime() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : Infinity);
      return timeA - timeB;
    });

    const nextTask = sortedActionableTasks[0];

    if (score >= 90) {
      coachMessage = "Outstanding work. Keep maintaining your consistency.";
    } else if (score >= 80) {
      coachMessage = "You're performing very well. Completing more high-priority tasks on time could improve your score.";
    } else if (score >= 60) {
      coachMessage = "Good progress. Reducing overdue tasks and maintaining your streak will improve your productivity.";
    } else {
      coachMessage = "Complete at least one task today to begin increasing your productivity score.";
    }

    // Custom mentions based on state of actionable tasks
    const actionableOverdue = sortedActionableTasks.filter(isTaskOverdue);
    const actionableHighPriority = sortedActionableTasks.filter(t => t.priority === "high" || t.priority === "urgent");

    if (actionableOverdue.length > 0) {
      coachMessage += " You have overdue tasks that need immediate attention.";
    } else if (actionableHighPriority.length > 1) {
      coachMessage += " Focus on completing your high-priority tasks first.";
    }

    // Generate suggestions from the sorted actionable tasks
    if (isTaskOverdue(nextTask)) {
      suggestions.push(`• Complete the overdue task "${nextTask.title}" immediately to resolve backlog drag.`);
    } else if (nextTask.priority === "urgent" || nextTask.priority === "high") {
      suggestions.push(`• Begin high priority work earlier tomorrow: tackle "${nextTask.title}" first.`);
    } else {
      suggestions.push(`• Focus on your next objective: tackle "${nextTask.title}" to maintain momentum.`);
    }

    if (sortedActionableTasks.length > 1) {
      const secondTask = sortedActionableTasks[1];
      if (secondTask.priority === "urgent" || secondTask.priority === "high") {
        suggestions.push(`• Next up: organize resources to address high priority "${secondTask.title}".`);
      } else {
        suggestions.push(`• Next up: progress on your pending goal "${secondTask.title}".`);
      }
    }

    if (completionRateVal < 0.5) {
      suggestions.push(`• Reduce context switching: finish your active tasks before launching new ones.`);
    }
  }

  // Today's Impact
  const todayStr = last7DaysDates[0];
  const completedTodayTasks = completedTasks.filter(t => getLocalDateString(t.updatedAt) === todayStr);
  const completedTodayTitles = completedTodayTasks.map(t => t.title);
  const todayPoints = completedTodayTasks.reduce((acc, t) => {
    return acc + (t.priority === "urgent" || t.priority === "high" ? 4 : t.priority === "medium" ? 3 : 2);
  }, 0);

  // Weekly Trend: Compare last 7 days with previous 7 days (days 8-14)
  const prev7DaysDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 7 - i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const last7Count = completedTasks.filter(t => last7DaysDates.includes(getLocalDateString(t.updatedAt))).length;
  const prev7Count = completedTasks.filter(t => prev7DaysDates.includes(getLocalDateString(t.updatedAt))).length;
  const trendDiff = last7Count - prev7Count;

  let trendText = "No change this week";
  if (trendDiff > 0) {
    trendText = `↑ +${trendDiff} this week`;
  } else if (trendDiff < 0) {
    trendText = `↓ -${Math.abs(trendDiff)} this week`;
  }

  return {
    score,
    rating,
    performance,
    reasons,
    suggestions: suggestions.slice(0, 3),
    coachMessage,
    breakdown: {
      completionRate: completionRatePoints,
      onTimeCompletion: onTimePoints,
      streak: streakPoints,
      priorityBonus: priorityPoints,
      weeklyConsistency: weeklyConsistencyPoints,
    },
    todayImpact: {
      points: todayPoints,
      completedTitles: completedTodayTitles,
    },
    weeklyTrend: {
      diff: trendDiff,
      text: trendText,
    },
    summaryStats: {
      completedCount,
      overdueCount,
      streakCount: currentStreak,
      onTimeRate: completedCount > 0 ? Math.round((onTimeCompletedCount / completedCount) * 100) : 0,
    }
  };
}

export function calculateStreak(tasks: Task[]): number {
  const completed = tasks.filter(t => t.status === "completed");
  if (completed.length === 0) return 0;
  
  const getLocalDateString = (updatedAt: any): string => {
    if (!updatedAt) return "";
    let d: Date;
    if (typeof updatedAt === "string") {
      d = new Date(updatedAt);
    } else if (updatedAt.seconds) {
      d = new Date(updatedAt.seconds * 1000);
    } else if (updatedAt instanceof Date) {
      d = updatedAt;
    } else {
      d = new Date(updatedAt);
    }
    if (isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const completedDatesSet = new Set(
    completed.map(t => getLocalDateString(t.updatedAt)).filter(Boolean)
  );

  const today = new Date();
  const todayStr = getLocalDateString(today);
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterday);

  // If no task completed today AND yesterday, streak is 0
  if (!completedDatesSet.has(todayStr) && !completedDatesSet.has(yesterdayStr)) {
    return 0;
  }

  // Count backward starting from today (if completed today) or yesterday
  let currentStreak = 0;
  let checkDate = completedDatesSet.has(todayStr) ? today : yesterday;
  
  while (true) {
    const checkStr = getLocalDateString(checkDate);
    if (completedDatesSet.has(checkStr)) {
      currentStreak++;
      // Move to the previous day
      checkDate = new Date(checkDate);
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return currentStreak;
}