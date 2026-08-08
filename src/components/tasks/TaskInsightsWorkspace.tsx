import React, { useState, useEffect } from "react";
import { Task, Subtask, getDerivedStatus } from "../../types";
import { 
  Clock, Calendar, AlertTriangle, CheckCircle, 
  Trash2, ListTodo, Activity
} from "lucide-react";
import { safeDate } from "../../utils/dateUtils";

function formatDurationHoursMins(effortHours: number): string {
  const totalMinutes = Math.round(effortHours * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    const hrStr = hours === 1 ? "1 hour" : `${hours} hours`;
    const minStr = minutes === 1 ? "1 minute" : `${minutes} minutes`;
    return `${hrStr} ${minStr}`;
  } else if (hours > 0) {
    return hours === 1 ? "1 hour" : `${hours} hours`;
  } else {
    return minutes === 1 ? "1 minute" : `${minutes} minutes`;
  }
}

function formatTime12Hour(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const minStr = minutes < 10 ? '0' + minutes : minutes;
  return `${hours}:${minStr} ${ampm}`;
}

interface TaskInsightsWorkspaceProps {
  tasks: Task[];
  selectedTask: Task | null;
  onToggleComplete: (id: string) => Promise<void>;
  onEditClick: (task: Task) => void;
  onDeleteClick: (id: string) => void;
  onRefreshAI: (id: string) => void;
  refreshingTaskId: string | null;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onGenerateBreakdown: (task: Task) => Promise<void>;
  breakdownLoading: boolean;
}

export const TaskInsightsWorkspace: React.FC<TaskInsightsWorkspaceProps> = ({
  selectedTask,
  onToggleComplete,
  onEditClick,
  onDeleteClick,
  tasks
}) => {
  const [isCompleting, setIsCompleting] = useState(false);
  const [completeSuccess, setCompleteSuccess] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  useEffect(() => {
    setCompleteSuccess(false);
    setCompleteError(null);
  }, [selectedTask?.id]);

  if (tasks.length === 0) {
  return null;
}

  if (!selectedTask) {
    return (
      <div id="task-details-workspace" className="bg-bg-surface border border-border-custom p-6 rounded-2xl text-center flex flex-col items-center justify-center min-h-[140px] shadow-sm">
        <p className="text-sm font-medium text-text-secondary">
          Select an objective to view its detailed timeline and action controls.
        </p>
      </div>
    );
  }

  const handleCompleteClick = async () => {
    if (!selectedTask) return;
    setIsCompleting(true);
    setCompleteError(null);
    setCompleteSuccess(false);
    try {
      await onToggleComplete(selectedTask.id);
      setCompleteSuccess(true);
      setTimeout(() => {
        setCompleteSuccess(false);
      }, 4000);
    } catch (err) {
      console.error("Task completion failed:", err);
      setCompleteError("Unable to complete the task. Please try again.");
    } finally {
      setIsCompleting(false);
    }
  };

  const startTimeDate = (() => {
    const startObj = safeDate(selectedTask.startTime);
    if (startObj) return startObj;

    const deadlineObj = safeDate(selectedTask.deadline);
    if (deadlineObj) {
      const effortHours = selectedTask.effortHours || 1;
      return new Date(deadlineObj.getTime() - effortHours * 3600 * 1000);
    }

    return new Date();
  })();

  const startTimeStr = formatTime12Hour(startTimeDate);

  const totalMinutes = Math.round((selectedTask.effortHours || 0) * 60);
  const expectedCompletionDate = new Date(startTimeDate.getTime() + totalMinutes * 60 * 1000);
  const expectedCompletionStr = formatTime12Hour(expectedCompletionDate);

  const formattedDeadline = (() => {
    const d = safeDate(selectedTask.deadline);
    return d ? d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) : "";
  })();

  const formattedStartDate = (() => {
    if (selectedTask.startDate) {
      const d = safeDate(selectedTask.startDate);
      if (d) {
        return d.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric"
        });
      }
    }
    if (selectedTask.startTime) {
      const d = safeDate(selectedTask.startTime);
      if (d) {
        return d.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric"
        });
      }
    }
    if (selectedTask.deadline) {
      const d = safeDate(selectedTask.deadline);
      if (d) {
        const fallbackDate = new Date(d.getTime() - (selectedTask.effortHours || 1) * 3600 * 1000);
        return fallbackDate.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric"
        });
      }
    }
    return "Not set";
  })();

  const formattedStartTime = (() => {
    if (selectedTask.startTime) {
      const d = safeDate(selectedTask.startTime);
      if (d) {
        return d.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        });
      }
    }
    if (selectedTask.deadline) {
      const d = safeDate(selectedTask.deadline);
      if (d) {
        const fallbackDate = new Date(d.getTime() - (selectedTask.effortHours || 1) * 3600 * 1000);
        return fallbackDate.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        });
      }
    }
    return "";
  })();

  return (
    <div id="task-details-workspace" className="bg-bg-surface border border-border-custom rounded-2xl md:rounded-[28px] overflow-hidden p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6 w-full shadow-md">
      {/* TASK OVERVIEW Heading */}
      <div className="flex items-center justify-between pb-4 border-b border-border-custom/50">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-accent-primary" />
          <span className="text-xs font-black text-text-muted uppercase tracking-widest">TASK OVERVIEW</span>
        </div>
      </div>

      {/* Title & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-lg sm:text-xl md:text-2xl font-black text-text-primary tracking-tight leading-tight">
          {selectedTask.title}
        </h3>
        {(() => {
          const derivedStatus = getDerivedStatus(selectedTask);
          if (derivedStatus === "completed") {
            return (
              <span className="self-start sm:self-center text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border bg-status-success/10 text-status-success border-status-success/20">
                Completed
              </span>
            );
          }
          if (derivedStatus === "overdue") {
            return (
              <span className="self-start sm:self-center text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border bg-status-danger/10 text-status-danger border-status-danger/20 animate-pulse">
                Overdue
              </span>
            );
          }
          return (
            <span className="self-start sm:self-center text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border bg-accent-primary/10 text-accent-primary border-accent-primary/20">
              Pending
            </span>
          );
        })()}
      </div>

      {/* Grid: Category, Priority, Start Date, Status */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-bg-primary/30 p-4 rounded-2xl border border-border-custom/40">
        <div>
          <span className="text-[9px] font-black text-text-muted uppercase tracking-widest block mb-1">Category</span>
          <span className="text-xs sm:text-sm font-bold text-text-primary truncate block">
            {selectedTask.category || "General"}
          </span>
        </div>
        <div>
          <span className="text-[9px] font-black text-text-muted uppercase tracking-widest block mb-1">Priority</span>
          <span className={`text-xs font-black uppercase tracking-wide font-mono ${
            selectedTask.priority === "urgent" ? "text-status-danger" :
            selectedTask.priority === "high" ? "text-status-warning" :
            selectedTask.priority === "medium" ? "text-accent-primary" : "text-text-muted"
          }`}>
            {selectedTask.priority}
          </span>
        </div>
        <div>
          <span className="text-[9px] font-black text-text-muted uppercase tracking-widest block mb-1">Start Date</span>
          <span className="text-xs font-bold text-text-primary block">
            {formattedStartDate} {formattedStartTime ? `@ ${formattedStartTime}` : ""}
          </span>
        </div>
        <div>
          <span className="text-[9px] font-black text-text-muted uppercase tracking-widest block mb-1">Status</span>
          <span className={`text-xs font-black uppercase tracking-wide ${
            selectedTask.status === "completed" ? "text-status-success" : "text-status-warning"
          }`}>
            {selectedTask.status === "completed" ? "Completed" : "Pending"}
          </span>
        </div>
      </div>

      {/* Deadline (only if explicitly provided) */}
      {selectedTask.deadline && (
        <div className="space-y-1.5 p-4 rounded-xl border border-status-danger/10 bg-status-danger/5">
          <span className="text-[9px] font-black text-status-danger uppercase tracking-widest block">Deadline</span>
          <div className="text-xs text-text-primary leading-relaxed font-bold flex items-center gap-2">
            <span className="text-status-danger">⚠ Due Date & Time:</span>
            <span>{formattedDeadline}</span>
          </div>
        </div>
      )}

      {/* Description */}
      <div className="space-y-1.5">
        <span className="text-[9px] font-black text-text-muted uppercase tracking-widest block">Description</span>
        <p className="text-xs text-text-secondary leading-relaxed bg-bg-primary p-4 rounded-xl border border-border-custom/60 whitespace-pre-wrap min-h-[70px]">
          {selectedTask.description || "No description provided for this objective."}
        </p>
      </div>

      {/* Important Note */}
      <div className="space-y-1.5">
        <span className="text-[9px] font-black text-text-muted uppercase tracking-widest block">Important Note</span>
        <p className="text-xs text-text-secondary leading-relaxed bg-bg-primary p-4 rounded-xl border border-border-custom/60 whitespace-pre-wrap">
          {selectedTask.notes?.trim() || "No additional notes."}
        </p>
      </div>

      {/* Suggested Timeline */}
      <div className="space-y-4">
        <div className="pb-1">
          <span className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-accent-primary" /> Suggested Timeline
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-bg-primary/30 p-4 rounded-2xl border border-border-custom/40">
          <div>
            <span className="text-[9px] font-black text-text-muted uppercase tracking-widest block mb-1">Start Time</span>
            <span className="text-sm font-bold text-text-primary font-mono">{startTimeStr}</span>
          </div>
          <div>
            <span className="text-[9px] font-black text-text-muted uppercase tracking-widest block mb-1">Estimated Duration</span>
            <span className="text-sm font-bold text-text-primary font-mono">
              {formatDurationHoursMins(selectedTask.effortHours)}
            </span>
          </div>
          <div>
            <span className="text-[9px] font-black text-accent-primary uppercase tracking-widest block mb-1">Expected Completion Time</span>
            <span className="text-sm font-black text-accent-primary font-mono">
              {expectedCompletionStr}
            </span>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border-custom/50 my-6"></div>

      {/* Complete Status Toast / Error Message */}
      {completeSuccess && (
        <div className="p-2.5 bg-status-success/10 text-status-success text-xs rounded-xl border border-status-success/20 flex items-center gap-1.5 font-bold">
          <CheckCircle className="w-4 h-4 text-status-success shrink-0" />
          <span>{selectedTask.status === "completed" ? "Task marked as completed." : "Task marked as pending."}</span>
        </div>
      )}
      {completeError && (
        <div className="p-2.5 bg-status-danger/10 text-status-danger text-xs rounded-xl border border-status-danger/20 flex items-center gap-1.5 font-bold">
          <AlertTriangle className="w-4 h-4 text-status-danger shrink-0" />
          <span>{completeError}</span>
        </div>
      )}

      {/* Action Buttons: Complete, Edit, Delete */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 pt-4">
        {/* Complete */}
        <button
          onClick={handleCompleteClick}
          disabled={isCompleting}
          className={`px-4 py-3 text-white text-xs font-extrabold rounded-xl flex items-center justify-center gap-1.5 transition-all h-10 sm:h-11 shadow-sm w-full ${
            isCompleting
              ? "bg-accent-primary/50 cursor-not-allowed"
              : "bg-accent-primary hover:bg-accent-primary/95 cursor-pointer shadow-sm shadow-accent-primary/10"
          }`}
          title={selectedTask.status === "completed" ? "Mark Pending" : "Mark Complete"}
        >
          <CheckCircle className={`w-4 h-4 shrink-0 ${isCompleting ? "animate-spin" : ""}`} />
          <span className="truncate">
            {isCompleting ? "Completing..." : selectedTask.status === "completed" ? "Mark Pending" : "Complete"}
          </span>
        </button>

        {/* Edit */}
        <button
          onClick={() => onEditClick(selectedTask)}
          className="px-4 py-3 bg-bg-primary text-text-primary hover:text-accent-primary rounded-xl border border-border-custom hover:border-accent-primary/30 transition-all cursor-pointer flex items-center justify-center gap-1.5 text-xs font-extrabold h-10 sm:h-11 w-full"
        >
          <ListTodo className="w-4 h-4 shrink-0 text-accent-primary" />
          <span className="truncate">Edit</span>
        </button>

        {/* Delete */}
        <button
          onClick={() => onDeleteClick(selectedTask.id)}
          className="px-4 py-3 text-text-muted hover:text-status-danger hover:bg-status-danger/10 rounded-xl border border-transparent hover:border-status-danger/20 transition-all cursor-pointer flex items-center justify-center gap-1.5 text-xs font-extrabold h-10 sm:h-11 w-full"
        >
          <Trash2 className="w-4 h-4 shrink-0 text-status-danger" />
          <span className="truncate">Delete</span>
        </button>
      </div>
    </div>
  );
};
