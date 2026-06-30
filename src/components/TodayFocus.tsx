import React, { useState } from "react";
import { Task, formatDuration, getDerivedStatus } from "../types";
import { CheckCircle2, Clock, CalendarClock, Plus, AlertCircle, Sparkles, ArrowRight } from "lucide-react";
import { safeDate } from "../lib/dateUtils";

interface TodayFocusProps {
  tasks: Task[];
  onToggleComplete: (id: string) => void;
  onCreateTaskClick: () => void;
  onSelectTask: (task: Task) => void;
}

export const TodayFocus: React.FC<TodayFocusProps> = ({
  tasks,
  onToggleComplete,
  onCreateTaskClick,
  onSelectTask,
}) => {
  const [activeTab, setActiveTab] = useState<"all" | "overdue" | "today" | "upcoming">("all");

  const isToday = (dateStr: string) => {
    const today = new Date();
    const dDate = safeDate(dateStr);
    if (!dDate) return false;
    return (
      dDate.getDate() === today.getDate() &&
      dDate.getMonth() === today.getMonth() &&
      dDate.getFullYear() === today.getFullYear()
    );
  };

  const isOverdue = (task: Task) => {
    return getDerivedStatus(task) === "overdue";
  };

  // Setup tabs
  const overdueTasks = tasks.filter((t) => t.status !== "completed" && isOverdue(t));
  const todayOnlyTasks = tasks.filter((t) => t.status !== "completed" && !!t.deadline && isToday(t.deadline) && !isOverdue(t));
  const upcomingTasks = tasks.filter(
    (t) => {
      if (t.status === "completed" || !t.deadline) return false;
      const dObj = safeDate(t.deadline);
      return dObj && !isToday(t.deadline) && dObj.getTime() >= Date.now();
    }
  );
  const allFocusTasks = tasks.filter((t) => t.status !== "completed" && ( (!!t.deadline && isToday(t.deadline)) || isOverdue(t) ));

  const displayedTasks = {
    all: allFocusTasks,
    overdue: overdueTasks,
    today: todayOnlyTasks,
    upcoming: upcomingTasks,
  }[activeTab];

  // Sort them so overdue/critical are first, followed by high, medium, low
  const sortedTasks = [...displayedTasks].sort((a, b) => {
    const aOverdue = isOverdue(a);
    const bOverdue = isOverdue(b);
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;

    const priorityWeight = { urgent: 4, high: 3, medium: 2, low: 1 };
    const weightA = priorityWeight[a.priority] || 2;
    const weightB = priorityWeight[b.priority] || 2;
    return weightB - weightA;
  });

  const priorityLabels = {
    urgent: "Critical",
    high: "High",
    medium: "Medium",
    low: "Low",
  };

  const priorityColors = {
    urgent: "text-status-danger",
    high: "text-status-warning",
    medium: "text-accent-primary",
    low: "text-text-muted",
  };

  const priorityDots = {
    urgent: "bg-status-danger",
    high: "bg-status-warning",
    medium: "bg-accent-primary",
    low: "bg-text-muted/40",
  };

  return (
    <div id="today-focus-panel" className="bg-bg-surface p-6 rounded-[24px] border border-border-custom shadow-sm flex flex-col h-full space-y-5">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-black text-text-muted tracking-wider uppercase">Today's Focus</h2>
        </div>
        
        {tasks.length > 0 && (
          <button
            id="view-all-tasks-btn"
            onClick={() => {
              const el = document.getElementById("active-track-list-header");
              if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "start" });
              }
            }}
            className="px-3 py-1.5 rounded-full border border-border-custom hover:bg-bg-hover text-xs text-text-primary flex items-center gap-1.5 transition-all cursor-pointer font-bold"
          >
            View All Tasks <ArrowRight className="w-3.5 h-3.5 text-accent-primary" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-bg-primary rounded-xl w-fit">
        {(["all", "overdue", "today", "upcoming"] as const).map((tab) => {
          const isActive = activeTab === tab;
          const label = {
            all: "All",
            overdue: "Overdue",
            today: "Today",
            upcoming: "Upcoming",
          }[tab];

          const count = {
            all: allFocusTasks.length,
            overdue: overdueTasks.length,
            today: todayOnlyTasks.length,
            upcoming: upcomingTasks.length,
          }[tab];

          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                isActive
                  ? "bg-bg-surface text-accent-primary shadow-sm ring-1 ring-border-custom"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              {label} <span className="opacity-50 ml-0.5">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Focus Messages */}
      {overdueTasks.length > 0 ? (
        <div className="p-3 bg-status-danger/10 border border-status-danger/20 rounded-xl text-status-danger text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p className="font-medium">You have pending tasks that should have been completed. Please complete them at the earliest.</p>
        </div>
      ) : tasks.filter(t => t.status !== 'completed').length === 0 ? (
        <div className="p-3 bg-status-success/10 border border-status-success/20 rounded-xl text-status-success text-xs flex items-center gap-3">
          <Sparkles className="w-4 h-4 shrink-0" />
          <p className="font-medium">No tasks for today. Awesome job!</p>
        </div>
      ) : null}

      {/* List / Empty State */}
      <div className="flex-1 flex flex-col justify-between">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center bg-bg-primary/50 rounded-xl border border-dashed border-border-custom p-6 my-auto">
            <p className="text-sm text-text-secondary leading-relaxed max-w-xs">
              You're all caught up! Add a task so that we can build your personalized plan.
            </p>
            <button
              onClick={onCreateTaskClick}
              className="mt-4 px-4 py-2 bg-accent-primary hover:bg-accent-primary/90 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Plus className="w-3.5 h-3.5" /> Create Task
            </button>
          </div>
        ) : sortedTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center bg-bg-primary/30 rounded-xl border border-dashed border-border-custom p-6 my-auto">
            <div className="p-2.5 bg-status-success/10 text-status-success rounded-full mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm text-text-primary font-bold leading-relaxed max-w-xs">
              You're all caught up! Add a task so that we can build your personalized plan.
            </p>
            <button
              onClick={onCreateTaskClick}
              className="mt-4 px-4 py-2 bg-bg-surface hover:bg-bg-hover text-text-primary text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer border border-border-custom shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> Create Task
            </button>
          </div>
        ) : (
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
            {sortedTasks.map((task) => {
              const overdue = isOverdue(task);

              return (
                <div
                  key={task.id}
                  onClick={() => onSelectTask(task)}
                  className="group flex items-center justify-between p-3.5 bg-bg-surface hover:bg-bg-primary/40 border border-border-custom rounded-[20px] transition-all cursor-pointer shadow-sm hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleComplete(task.id);
                      }}
                      className="p-1 text-text-muted hover:text-accent-primary transition-colors"
                    >
                      <div className="w-5 h-5 rounded-full border-2 border-border-custom hover:border-accent-primary flex items-center justify-center transition-all bg-bg-surface">
                        <CheckCircle2 className="w-3.5 h-3.5 opacity-0 hover:opacity-100 text-accent-primary" />
                      </div>
                    </button>
                    <div>
                      <span className="text-sm font-bold text-text-primary group-hover:text-accent-primary transition-colors block leading-tight">
                        {task.title}
                      </span>
                      <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                        {task.category && (
                          <span className="text-[10px] text-accent-primary font-bold tracking-wide uppercase">
                            {task.category}
                          </span>
                        )}
                        <span className={`text-[10px] font-bold flex items-center gap-1.5 ${priorityColors[task.priority]}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${priorityDots[task.priority]}`} />
                          {priorityLabels[task.priority]}
                        </span>
                        <span className="text-[10px] text-text-muted font-bold font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3 text-text-muted" /> {formatDuration(task.effortHours)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {overdue ? (
                      <span className="text-[10px] font-black text-status-danger bg-status-danger/10 border border-status-danger/20 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                        <AlertCircle className="w-3 h-3" /> OVERDUE
                      </span>
                    ) : (task.deadline && isToday(task.deadline)) ? (
                      <span className="text-[10px] font-black text-status-warning bg-status-warning/10 border border-status-warning/20 px-2 py-0.5 rounded-full">
                        TODAY
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-text-secondary bg-bg-hover px-2 py-0.5 rounded-full border border-border-custom">
                        {(() => {
                          const d = safeDate(task.deadline);
                          return d ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "No due date";
                        })()}
                      </span>
                    )}
                    {task.breakdownGenerated && (
                      <span className="text-[10px] font-bold text-accent-secondary bg-accent-secondary/10 border border-accent-secondary/20 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                        <Sparkles className="w-2.5 h-2.5" /> AI
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
