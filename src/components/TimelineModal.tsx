import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Task } from "../types";
import { X, Calendar, Clock, AlertTriangle, CheckCircle, ArrowLeft } from "lucide-react";
import { safeDate } from "../lib/dateUtils";

interface TimelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  onSelectTask: (task: Task) => void;
}

function formatDurationHoursMins(effortHours: number): string {
  const totalMinutes = Math.round(effortHours * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    const hrStr = hours === 1 ? "1 hr" : `${hours} hrs`;
    const minStr = minutes === 1 ? "1 min" : `${minutes} mins`;
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
  hours = hours ? hours : 12;
  const minStr = minutes < 10 ? '0' + minutes : minutes;
  return `${hours}:${minStr} ${ampm}`;
}

const isSameLocalDate = (d1: Date, d2: Date) => {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
};

export const TimelineModal: React.FC<TimelineModalProps> = ({ isOpen, onClose, tasks, onSelectTask }) => {
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    const today = new Date();
    const tzOffset = today.getTimezoneOffset() * 60000;
    return new Date(today.getTime() - tzOffset).toISOString().split("T")[0];
  });
  const [view, setView] = useState<"setup" | "timeline">("setup");

  useEffect(() => {
    if (isOpen) {
      const today = new Date();
      const tzOffset = today.getTimezoneOffset() * 60000;
      setSelectedDateStr(new Date(today.getTime() - tzOffset).toISOString().split("T")[0]);
      setView("setup");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const targetDate = new Date(selectedDateStr + "T00:00:00");

  const getEffectiveStartTime = (task: Task): Date => {
    const startObj = safeDate(task.startTime);
    if (startObj) return startObj;

    const deadlineObj = safeDate(task.deadline);
    if (deadlineObj) {
      const effortHours = task.effortHours || 1;
      return new Date(deadlineObj.getTime() - effortHours * 3600 * 1000);
    }

    return new Date();
  };

  const isTaskOnDate = (task: Task) => {
    // 1. Check planned execution
    const startDate = getEffectiveStartTime(task);
    if (isSameLocalDate(startDate, targetDate)) return true;

    const totalMinutes = Math.round((task.effortHours || 0) * 60);
    const endDate = new Date(startDate.getTime() + totalMinutes * 60 * 1000);
    if (isSameLocalDate(endDate, targetDate)) return true;

    // Or if targetDate falls strictly inside the execution period
    const targetStartOfDay = new Date(targetDate);
    targetStartOfDay.setHours(0, 0, 0, 0);
    const targetEndOfDay = new Date(targetDate);
    targetEndOfDay.setHours(23, 59, 59, 999);

    if (startDate <= targetEndOfDay && endDate >= targetStartOfDay) {
      return true;
    }

    return false;
  };

  // Filter and sort tasks
  const matchedTasks = tasks.filter(isTaskOnDate);
  matchedTasks.sort((a, b) => getEffectiveStartTime(a).getTime() - getEffectiveStartTime(b).getTime());

  const formattedSelectedDate = targetDate.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  const handleClose = () => {
    setView("setup");
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.95, y: 15, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.95, y: 15, opacity: 0 }}
          transition={{ type: "spring", damping: 20 }}
          className="bg-bg-surface border border-border-custom rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[85vh] relative z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-border-custom/50">
            <div className="flex items-center gap-2">
              {view === "timeline" && (
                <button
                  onClick={() => setView("setup")}
                  className="p-1 hover:bg-bg-hover rounded-lg text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <h3 className="text-sm font-black text-text-primary uppercase tracking-wider">
                {view === "setup" ? "Generate My Timeline" : "Your Daily Timeline"}
              </h3>
            </div>
            <button
              onClick={handleClose}
              className="p-1 hover:bg-bg-hover rounded-lg text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Setup view */}
          {view === "setup" && (
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-accent-primary" />
                  Select Date
                </label>
                <div className="relative">
                <input
                  type="date"
                  value={selectedDateStr}
                  onChange={(e) => setSelectedDateStr(e.target.value)}
                  className="w-full px-4 py-3 border border-border-custom rounded-2xl text-sm text-text-primary bg-bg-primary focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary transition-all font-medium"
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted pointer-events-none" />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-3 bg-bg-primary hover:bg-bg-hover text-text-secondary border border-border-custom text-xs font-bold rounded-2xl transition-colors cursor-pointer h-11"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setView("timeline")}
                  className="flex-1 px-4 py-3 bg-accent-primary hover:bg-accent-primary/95 text-white text-xs font-bold rounded-2xl transition-colors cursor-pointer shadow-md shadow-accent-primary/10 h-11"
                >
                  Generate
                </button>
              </div>
            </div>
          )}

          {/* Timeline View */}
          {view === "timeline" && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Selected Date Header */}
              <div className="flex items-center gap-2 pb-3 border-b border-border-custom/40">
                <Calendar className="w-4 h-4 text-accent-primary" />
                <span className="text-sm font-black text-text-primary tracking-tight">{formattedSelectedDate}</span>
              </div>

              {matchedTasks.length === 0 ? (
                <div className="py-12 text-center space-y-4">
                  <p className="text-xs text-text-muted font-medium">No tasks are scheduled for this date.</p>
                  <button
                    onClick={handleClose}
                    className="px-5 py-2.5 bg-accent-primary hover:bg-accent-primary/95 text-white text-xs font-bold rounded-2xl transition-colors cursor-pointer shadow-sm shadow-accent-primary/10 inline-flex items-center justify-center"
                  >
                    Return to Dashboard
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {matchedTasks.map((task) => {
                    const startDate = getEffectiveStartTime(task);
                    const totalMins = Math.round((task.effortHours || 0) * 60);
                    const endDate = new Date(startDate.getTime() + totalMins * 60 * 1000);
                    
                    return (
                      <motion.div
                        key={task.id}
                        whileHover={{ y: -2, scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => onSelectTask(task)}
                        className="task-card-item p-4 rounded-[18px] border transition-all duration-200 cursor-pointer bg-bg-surface border-border-custom hover:border-accent-primary/50 shadow-sm space-y-3"
                      >
                        {/* Time & Title */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <span className="text-xs font-black text-accent-primary font-mono block">
                              {formatTime12Hour(startDate)}
                            </span>
                            <h4 className="text-sm font-black text-text-primary tracking-tight mt-0.5">
                              {task.title}
                            </h4>
                            {task.category && (
                              <span className="text-[10px] text-accent-primary font-bold tracking-wide uppercase block mt-0.5">
                                {task.category}
                              </span>
                            )}
                          </div>
                          
                          {/* Badges */}
                          <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-center">
                            {/* Status Badge */}
                            {(() => {
                              if (task.status === "completed") {
                                return (
                                  <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border bg-status-success/10 text-status-success border-status-success/20">
                                    Completed
                                  </span>
                                );
                              }
                              const deadlineVal = task.deadline || (task as any).dueDate;
                              const dObj = safeDate(deadlineVal);
                              const isOverdue = dObj && dObj.getTime() < Date.now();
                              if (isOverdue) {
                                return (
                                  <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border bg-status-danger/10 text-status-danger border-status-danger/20 animate-pulse">
                                    Pending
                                  </span>
                                );
                              }
                              return null;
                            })()}
                            
                            {/* Priority Badge */}
                            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                              task.priority === "urgent" ? "bg-status-danger/10 text-status-danger border-status-danger/20" :
                              task.priority === "high" ? "bg-status-warning/10 text-status-warning border-status-warning/20" :
                              task.priority === "medium" ? "bg-accent-primary/10 text-accent-primary border-accent-primary/20" :
                              "bg-bg-primary text-text-muted border-border-custom"
                            }`}>
                              {task.priority}
                            </span>
                          </div>
                        </div>

                        {/* Details Row */}
                        <div className="grid grid-cols-2 gap-3 text-[11px] pt-1 border-t border-border-custom/20">
                          <div className="flex items-center gap-1.5 text-text-secondary">
                            <Clock className="w-3.5 h-3.5 text-text-muted shrink-0" />
                            <div>
                              <span className="text-text-muted font-bold block uppercase text-[8px] tracking-wider leading-none">Estimated Duration</span>
                              <span className="font-bold font-mono">{formatDurationHoursMins(task.effortHours)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 text-text-secondary">
                            <CheckCircle className="w-3.5 h-3.5 text-text-muted shrink-0" />
                            <div>
                              <span className="text-text-muted font-bold block uppercase text-[8px] tracking-wider leading-none">Expected Completion</span>
                              <span className="font-bold font-mono">{formatTime12Hour(endDate)}</span>
                            </div>
                          </div>
                        </div>

                        {(() => {
                          const deadlineD = safeDate(task.deadline);
                          if (!deadlineD) return null;
                          if (isSameLocalDate(deadlineD, targetDate)) return null;
                          return (
                            <div className="text-[10px] text-text-muted flex items-center gap-1 bg-bg-surface/50 px-2 py-1 rounded-lg border border-border-custom/30 w-fit">
                              <Calendar className="w-3 h-3 text-status-warning" />
                              <span>Due {deadlineD.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                            </div>
                          );
                        })()}
                      </motion.div>
                    );
                  })}
                  
                  {/* Action at bottom */}
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={handleClose}
                      className="px-5 py-2.5 bg-bg-primary hover:bg-bg-hover text-text-secondary border border-border-custom text-xs font-bold rounded-2xl transition-colors cursor-pointer"
                    >
                      Return to Dashboard
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
