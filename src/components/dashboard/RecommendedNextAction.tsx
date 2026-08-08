import React from "react";
import { Task, formatDuration, getDerivedStatus } from "../../types";
import { Sparkles, Play, Compass, Clock, Calendar, CheckCircle2 } from "lucide-react";
import { safeDate } from "../../utils/dateUtils";

interface RecommendedNextActionProps {
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  onToggleComplete: (id: string) => void;
}

export const RecommendedNextAction: React.FC<RecommendedNextActionProps> = ({
  tasks,
  onSelectTask,
  onToggleComplete,
}) => {
  const isValidActionableTask = (t: Task) => {
    if (!t || !t.id || !t.title) return false;
    if (t.status === "completed") return false;
    if (getDerivedStatus(t) === "completed") return false;
    if ((t as any).deleted || (t as any).isDeleted || (t as any).archived || (t as any).isArchived) return false;
    return true;
  };

  const pending = tasks.filter(isValidActionableTask);

  const getRecommendedTask = (): Task | null => {
    if (pending.length === 0) return null;

    return [...pending].sort((a, b) => {
      const overdueA = getDerivedStatus(a) === "overdue";
      const overdueB = getDerivedStatus(b) === "overdue";

      if (overdueA && !overdueB) return -1;
      if (!overdueA && overdueB) return 1;

      const priorityWeight = { urgent: 4, high: 3, medium: 2, low: 1 };
      const wA = priorityWeight[a.priority] || 0;
      const wB = priorityWeight[b.priority] || 0;

      if (wB !== wA) return wB - wA;

      const timeA = a.startTime ? new Date(a.startTime).getTime() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : Infinity);
      const timeB = b.startTime ? new Date(b.startTime).getTime() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : Infinity);
      return timeA - timeB;
    })[0];
  };

  const nextTask = getRecommendedTask();

  if (!nextTask) {
    return (
      <div id="recommended-next-action-hero" className="bg-gradient-to-br from-bg-surface to-bg-primary border border-border-custom p-6 rounded-[24px] shadow-sm flex flex-col justify-between min-h-[160px] w-full items-center text-center">
        <div className="space-y-2 py-4">
          <Compass className="w-8 h-8 mx-auto text-accent-primary animate-pulse" />
          <h3 className="text-base font-black text-text-primary tracking-tight">Queue fully cleared</h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto leading-relaxed">
            No active pending tasks on your path right now.
          </p>
        </div>
      </div>
    );
  }

  // Get Reason
  const isOverdue = getDerivedStatus(nextTask) === "overdue";
  let reason = "Next optimal task sequence based on priority level and upcoming deadlines.";
  if (isOverdue) {
    reason = "⚠️ Critical overdue objective. Immediate focus required to minimize deadline slippage.";
  } else if (nextTask.priority === "urgent" || nextTask.priority === "high") {
    reason = "⭐ High priority milestone. Completing this immediately delivers the largest boost to your Productivity Score.";
  }

  // Calculate Sug. Start Time
// Calculate Suggested Start Time
const now = new Date();

const effortMs = (nextTask.effortHours || 1) * 60 * 60 * 1000;

// Choose the best available target date
const targetDateString =
  nextTask.deadline ||
  nextTask.expectedCompletion ||
  nextTask.startTime;

let suggestedStartStr = "ASAP (Immediately)";

if (targetDateString) {
  const targetDate = safeDate(targetDateString);

  if (targetDate) {
    const suggestedStartMs =
      nextTask.deadline || nextTask.expectedCompletion
        ? targetDate.getTime() - effortMs
        : targetDate.getTime();

    if (suggestedStartMs > now.getTime() + 30 * 60 * 1000) {
      const suggestedStartDate = new Date(suggestedStartMs);

      const isToday =
        suggestedStartDate.toDateString() === now.toDateString();

      suggestedStartStr = isToday
        ? suggestedStartDate.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        : `${suggestedStartDate.toLocaleDateString([], {
            month: "short",
            day: "numeric",
          })} at ${suggestedStartDate.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}`;
    }
  }
}

  // Expected Finish Time
  let expectedFinishStr = "Unknown";

if (nextTask.expectedCompletion) {
  const finishDate = safeDate(nextTask.expectedCompletion);

  if (finishDate) {
    const isToday =
      finishDate.toDateString() === now.toDateString();

    expectedFinishStr = isToday
      ? finishDate.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : `${finishDate.toLocaleDateString([], {
          month: "short",
          day: "numeric",
        })} at ${finishDate.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}`;
  }
}

const handleStartWorking = () => {
    onSelectTask(nextTask);
    const element = document.getElementById("task-details-workspace");
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div id="recommended-next-action-hero" className="relative bg-gradient-to-br from-bg-surface via-bg-surface to-accent-primary/5 border border-accent-primary/20 p-5 sm:p-6 md:p-8 rounded-2xl md:rounded-[28px] shadow-lg space-y-4 sm:space-y-6 w-full group overflow-hidden">
      {/* Background radial accent */}
      <div className="absolute right-0 top-0 w-64 h-64 bg-accent-primary/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20 group-hover:bg-accent-primary/10 transition-colors duration-500" />

      {/* Hero Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4.5 h-4.5 text-accent-primary animate-pulse shrink-0" />
          <span className="text-[9px] sm:text-[10px] font-black text-accent-primary uppercase tracking-[0.2em] block">
            Recommended Next Action
          </span>
        </div>
        <span className={`text-[8px] sm:text-[9px] uppercase font-black tracking-widest px-2.5 py-1 rounded-full border ${
          isOverdue 
            ? "bg-status-danger/10 text-status-danger border-status-danger/20" 
            : nextTask.priority === "urgent" || nextTask.priority === "high"
            ? "bg-status-warning/10 text-status-warning border-status-warning/20"
            : "bg-accent-primary/10 text-accent-primary border-accent-primary/20"
        }`}>
          {isOverdue ? "OVERDUE" : `${nextTask.priority.toUpperCase()} PRIORITY`}
        </span>
      </div>

      {/* Task Name & Reason */}
      <div className="space-y-1.5 sm:space-y-2.5">
        <h3 className="text-lg sm:text-xl md:text-2xl font-black text-text-primary tracking-tight leading-tight group-hover:text-accent-primary transition-colors duration-300">
          {nextTask.title}
        </h3>
        <p className="text-[11px] sm:text-xs text-text-secondary leading-relaxed font-semibold max-w-2xl">
          {reason}
        </p>
      </div>

      {/* Horizontal Schedule Info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 pt-3 sm:pt-4 border-t border-border-custom/50 text-xs">
        <div className="space-y-0.5 sm:space-y-1">
          <span className="text-[8px] sm:text-[9px] font-black text-text-muted uppercase tracking-wider block">
            Estimated Duration
          </span>
          <div className="flex items-center gap-1.5 text-text-primary font-bold">
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent-primary shrink-0" />
            <span className="text-xs">{formatDuration(nextTask.effortHours)}</span>
          </div>
        </div>

        <div className="space-y-0.5 sm:space-y-1">
          <span className="text-[8px] sm:text-[9px] font-black text-text-muted uppercase tracking-wider block">
            Suggested Start Time
          </span>
          <div className="flex items-center gap-1.5 text-text-primary font-bold">
            <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent-secondary shrink-0" />
            <span className={`text-xs ${isOverdue ? "text-status-danger font-black" : "text-text-primary"}`}>
              {suggestedStartStr}
            </span>
          </div>
        </div>

        <div className="space-y-0.5 sm:space-y-1">
          <span className="text-[8px] sm:text-[9px] font-black text-text-muted uppercase tracking-wider block">
            Expected Finish Time
          </span>
          <div className="flex items-center gap-1.5 text-text-primary font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-status-success shrink-0" />
            <span className="text-xs">{expectedFinishStr}</span>
          </div>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex justify-center pt-2 w-full">
        <button
          onClick={handleStartWorking}
          className="w-full sm:w-80 py-2.5 px-6 bg-accent-primary hover:bg-accent-primary/95 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-md shadow-accent-primary/15 flex items-center justify-center gap-2 group/btn h-10 sm:h-11"
        >
          <Play className="w-3.5 h-3.5 text-white fill-white shrink-0 group-hover/btn:scale-110 transition-transform" />
          <span className="tracking-wider uppercase font-black">Start Working</span>
        </button>
      </div>
    </div>
  );
};
