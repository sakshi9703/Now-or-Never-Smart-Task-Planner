import React from "react";
import { Task, formatDuration, getDerivedStatus } from "../../types";
import { Calendar, AlertTriangle, CheckCircle, Clock, Timer } from "lucide-react";
import { motion } from "motion/react";
import { safeDate } from "../../utils/dateUtils";

interface TaskCardProps {
  task: Task;
  isSelected: boolean;
  onSelect: () => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  isSelected,
  onSelect,
}) => {
  const deadlineVal = task.deadline || (task as any).dueDate;
  const hasDeadline = !!deadlineVal;
  const isOverdue = getDerivedStatus(task) === "overdue";
  
  // Format deadline readability
  const formattedDeadline = (() => {
    const d = safeDate(deadlineVal);
    if (!d) return "No due date";
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  })();

  // Format startDate readability
  const formattedStartDate = (() => {
    const d = safeDate(task.startDate) || safeDate(task.startTime);
    if (!d) return "";
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  })();

  // Format startTime readability
  const formattedStartTime = (() => {
    const d = safeDate(task.startTime);
    if (!d) return "";
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  })();

  // Calculate Urgency
  const getUrgency = () => {
    if (task.status === "completed") return null;
    if (!hasDeadline) return null;
    if (isOverdue) return { label: "Overdue", style: "text-status-danger bg-status-danger/10 border-status-danger/20 animate-pulse font-extrabold" };
    
    const today = new Date();
    const dDate = safeDate(deadlineVal);
    if (!dDate) return null;

    const isToday =
      dDate.getDate() === today.getDate() &&
      dDate.getMonth() === today.getMonth() &&
      dDate.getFullYear() === today.getFullYear();
    
    if (isToday) return { label: "Due Today", style: "text-status-warning bg-status-warning/10 border-status-warning/20 font-bold animate-pulse" };
    return { label: "Upcoming", style: "text-text-muted bg-bg-hover border-border-custom" };
  };

  const urgency = getUrgency();

  // Color mappings for priorities (Low, Medium, High, Critical)
  const priorityMeta = {
    urgent: { label: "Critical", style: "bg-status-danger/10 text-status-danger border-status-danger/20" },
    high: { label: "High", style: "bg-status-warning/10 text-status-warning border-status-warning/20" },
    medium: { label: "Medium", style: "bg-accent-primary/10 text-accent-primary border-accent-primary/20" },
    low: { label: "Low", style: "bg-bg-hover text-text-muted border-border-custom" },
  };

  const currentPriority = priorityMeta[task.priority] || priorityMeta.medium;

  return (
    <motion.div
      id={`task-card-${task.id}`}
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onSelect}
      className={`task-card-item p-3 sm:p-4 rounded-[18px] border transition-all duration-200 cursor-pointer ${
        isSelected
          ? "bg-bg-surface border-accent-primary ring-1 ring-accent-primary shadow-lg"
          : "bg-bg-surface border-border-custom hover:border-accent-primary/50 shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          <h3 className={`font-bold tracking-tight text-sm line-clamp-1 text-text-primary`}>
            {task.title}
          </h3>
          {task.category && (
            <span className="text-[10px] text-accent-primary font-bold tracking-wide uppercase">
              {task.category}
            </span>
          )}
        </div>
        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${currentPriority.style}`}>
          {currentPriority.label}
        </span>
      </div>

      <p className="text-xs mt-1 sm:mt-1.5 line-clamp-1 text-text-secondary">
        {task.description || "No description provided."}
      </p>



      {/* Task meta info */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t border-border-custom text-xs">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {formattedStartDate && (
            <div className="flex items-center gap-1.5 text-text-muted" title="Start Date">
              <Calendar className="w-3.5 h-3.5 text-accent-primary" />
              <span className="text-text-primary font-medium">{formattedStartDate}</span>
            </div>
          )}

          {formattedStartTime && (
            <div className="flex items-center gap-1.5 text-text-muted" title="Start Time">
              <Clock className="w-3.5 h-3.5 text-accent-secondary" />
              <span className="text-text-primary font-medium">{formattedStartTime}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 font-mono text-text-muted" title="Estimated Duration">
            <Timer className="w-3.5 h-3.5 text-teal-500" />
            <span className="text-text-primary">{formatDuration(task.effortHours)}</span>
          </div>

          {!formattedStartDate && !formattedStartTime && formattedDeadline && (
            <div className="flex items-center gap-1.5 text-text-muted" title="Due Date">
              <Calendar className="w-3.5 h-3.5 text-status-danger" />
              <span className="text-text-primary">{formattedDeadline}</span>
            </div>
          )}
        </div>

        {/* Status & Urgency Badges */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {(() => {
            const derivedStatus = getDerivedStatus(task);
            if (derivedStatus === "completed") {
              return (
                <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-status-success bg-status-success/10 px-2 py-0.5 rounded border border-status-success/20">
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" /> Completed
                </span>
              );
            }
            if (derivedStatus === "overdue") {
              return (
                <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-status-danger bg-status-danger/10 px-2 py-0.5 rounded border border-status-danger/20 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-danger animate-pulse shrink-0" /> Overdue
                </span>
              );
            }
            return (
              <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-accent-primary bg-accent-primary/10 px-2 py-0.5 rounded border border-accent-primary/20">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-primary shrink-0" /> Pending
              </span>
            );
          })()}
          {task.status !== "completed" && urgency && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${urgency.style}`}>
              {urgency.label}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};
