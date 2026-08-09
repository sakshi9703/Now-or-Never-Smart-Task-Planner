import React, { useState, useEffect } from "react";
import {
  Task,
  UserProfile,
  DailyPlan,
  SheetsSyncConfig,
  Subtask,
  getDerivedStatus,
} from "./types";
import { safeDate } from "./utils/dateUtils";
import { initAuth, googleSignIn, logout, db } from "./services/firebase";
import {
  getUserProfile,
  saveUserProfile,
  getUserTasks,
  createNewTask,
  updateExistingTask,
  deleteExistingTask,
} from "./services/dbService";
import { TaskCard } from "./components/tasks/TaskCard";
import { AnalyticsPanel } from "./components/dashboard/AnalyticsPanel";
import { StreakWidget } from "./components/dashboard/StreakWidget";
import { TaskFormModal } from "./components/tasks/TaskFormModal";
import { NameInputModal } from "./components/NameInputModal";
import { SheetsSyncPanel } from "./components/SheetsSyncPanel";
import { RecommendedNextAction } from "./components/dashboard/RecommendedNextAction";
import { TaskInsightsWorkspace } from "./components/tasks/TaskInsightsWorkspace";
import { TimelineModal } from "./components/TimelineModal";
import { syncTasksToSheet } from "./services/googleSync";
import { useTheme } from "./ThemeContext";
import {
  Sparkles,
  Plus,
  Trash2,
  CheckCircle,
  Flame,
  FileSpreadsheet,
  LogOut,
  Calendar,
  AlertTriangle,
  Info,
  Compass,
  ListTodo,
  X,
  Bell,
  Sun,
  Moon,
  CheckSquare,
  ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { User } from "firebase/auth";

function generateFallbackSubtasks(
  taskTitle: string,
  effortHours: number,
): Subtask[] {
  const titleLower = taskTitle.toLowerCase();
  const stepTime = Math.max(1, Math.round(effortHours / 4));

  if (
    titleLower.includes("deploy") ||
    titleLower.includes("website") ||
    titleLower.includes("web") ||
    titleLower.includes("app")
  ) {
    return [
      {
        id: "fb-1",
        title: "Review code and resolve active issues",
        status: "pending",
        estimatedHours: stepTime,
      },
      {
        id: "fb-2",
        title: "Test production build and staging links",
        status: "pending",
        estimatedHours: stepTime,
      },
      {
        id: "fb-3",
        title: "Configure hosting environment and variables",
        status: "pending",
        estimatedHours: stepTime,
      },
      {
        id: "fb-4",
        title: "Deploy application and verify live status",
        status: "pending",
        estimatedHours: Math.max(1, effortHours - stepTime * 3),
      },
    ];
  }

  if (
    titleLower.includes("write") ||
    titleLower.includes("draft") ||
    titleLower.includes("report") ||
    titleLower.includes("document") ||
    titleLower.includes("essay")
  ) {
    return [
      {
        id: "fb-1",
        title: "Research requirements and source citations",
        status: "pending",
        estimatedHours: stepTime,
      },
      {
        id: "fb-2",
        title: "Outline core sections and thesis elements",
        status: "pending",
        estimatedHours: stepTime,
      },
      {
        id: "fb-3",
        title: "Draft main paragraphs and summaries",
        status: "pending",
        estimatedHours: stepTime,
      },
      {
        id: "fb-4",
        title: "Proofread and polish final document",
        status: "pending",
        estimatedHours: Math.max(1, effortHours - stepTime * 3),
      },
    ];
  }

  if (
    titleLower.includes("study") ||
    titleLower.includes("learn") ||
    titleLower.includes("exam") ||
    titleLower.includes("course") ||
    titleLower.includes("test")
  ) {
    return [
      {
        id: "fb-1",
        title: "Review syllabus and critical lecture slides",
        status: "pending",
        estimatedHours: stepTime,
      },
      {
        id: "fb-2",
        title: "Synthesize core concepts and write study guide",
        status: "pending",
        estimatedHours: stepTime,
      },
      {
        id: "fb-3",
        title: "Complete practice questions or exercises",
        status: "pending",
        estimatedHours: stepTime,
      },
      {
        id: "fb-4",
        title: "Do a final active recall test of key terms",
        status: "pending",
        estimatedHours: Math.max(1, effortHours - stepTime * 3),
      },
    ];
  }

  return [
    {
      id: "fb-1",
      title: "Define requirements & structural plan",
      status: "pending",
      estimatedHours: stepTime,
    },
    {
      id: "fb-2",
      title: "Gather required resources & details",
      status: "pending",
      estimatedHours: stepTime,
    },
    {
      id: "fb-3",
      title: "Execute core task steps and deliverables",
      status: "pending",
      estimatedHours: stepTime,
    },
    {
      id: "fb-4",
      title: "Validate outcomes & perform final review",
      status: "pending",
      estimatedHours: Math.max(1, effortHours - stepTime * 3),
    },
  ];
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string>("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const detailsPanelRef = React.useRef<HTMLDivElement>(null);
  const shouldScrollRef = React.useRef(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const { theme, toggleTheme } = useTheme();
  const [localMode, setLocalMode] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSheetsSyncOpen, setIsSheetsSyncOpen] = useState(false);
  const userMenuRef = React.useRef<HTMLDivElement>(null);

  const storedName = localStorage.getItem("user_name");
  const firstName = user?.displayName?.split(" ")[0] || storedName || "User";
  const greeting = `Good Morning, ${firstName} ☀️`; // Simplified greeting for now as requested by user's example

  // Derived notifications
  const notifications = React.useMemo(() => {
    const list = [];
    const now = Date.now();
    const oneHourFromNow = now + 60 * 60 * 1000;

    // Start-based active notifications (Start Date + Start Time)
    let overdueCount = 0;
    let startingSoonCount = 0;

    for (const task of tasks) {
      const status = getDerivedStatus(task);

      if (status === "overdue") {
        overdueCount++;
      }

      if (status === "pending" && task.startTime) {
        const date = safeDate(task.startTime);

        if (date && date.getTime() > now && date.getTime() < oneHourFromNow) {
          startingSoonCount++;
        }
      }
    }

    if (overdueCount > 0) {
      list.push({
        id: "overdue-start",
        message: `You have ${overdueCount} overdue task(s) past their scheduled start time.`,
        type: "danger" as const,
      });
    }

    if (startingSoonCount > 0) {
      list.push({
        id: "starting-soon",
        message: `You have ${startingSoonCount} task(s) starting within the next hour.`,
        type: "success" as const,
      });
    }

    return list;
  }, [tasks]);

  // Interface controls
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [nameModalAction, setNameModalAction] = useState<"local" | null>(null);

  const [highlightSelectedTask, setHighlightSelectedTask] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  useEffect(() => {
    if (!searchQuery.trim()) {
      setDebouncedSearchQuery("");
      return;
    }

    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 400);

    return () => {
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const [priorityFilter, setPriorityFilter] = useState<
    "all" | "urgent" | "high" | "medium" | "low"
  >("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "completed" | "overdue"
  >("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"default" | "deadline">("default");
  const [highlightTasks, setHighlightTasks] = useState(false);

  const scrollToAllTasksAndHighlight = () => {
    const el = document.getElementById("all-tasks-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setHighlightTasks(true);
    setTimeout(() => {
      setHighlightTasks(false);
    }, 2000);
  };

  const handleSelectTaskFromTimeline = (task: Task) => {
    setIsTimelineOpen(false);
    shouldScrollRef.current = true;
    setSelectedTask(task);
    setHighlightSelectedTask(true);
    setTimeout(() => {
      setHighlightSelectedTask(false);
    }, 2500);
  };

  const handleTasksCompletedClick = () => {
    setStatusFilter("completed");
    setPriorityFilter("all");
    setCategoryFilter("all");
    setSearchQuery("");
    setSortBy("default");
    scrollToAllTasksAndHighlight();
  };

  const handlePendingTasksClick = () => {
    setStatusFilter("pending");
    setPriorityFilter("all");
    setCategoryFilter("all");
    setSearchQuery("");
    setSortBy("default");
    scrollToAllTasksAndHighlight();
  };

  const handlePassedDeadlinesClick = () => {
    setStatusFilter("overdue");
    setPriorityFilter("all");
    setCategoryFilter("all");
    setSearchQuery("");
    setSortBy("default");
    scrollToAllTasksAndHighlight();
  };

  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [rankingExplanations, setRankingExplanations] = useState<
    Record<string, string>
  >({});
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleteDropdownOpen, setIsDeleteDropdownOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState<
    "options" | "confirm-all" | "confirm-completed"
  >("options");
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState<string | null>(null);
  const [adviceLoading, setAdviceLoading] = useState<string | null>(null);
  const [refreshingTaskId, setRefreshingTaskId] = useState<string | null>(null);
  const [completedTaskCelebration, setCompletedTaskCelebration] = useState<
    string | null
  >(null);

  // Listen for Escape to close active task details panel
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!isFormOpen && selectedTask) {
          setSelectedTask(null);
        }
        if (isDeleteDropdownOpen) {
          setIsDeleteDropdownOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isFormOpen, selectedTask, isDeleteDropdownOpen]);

  // Click outside details panel to close it
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!selectedTask) return;
      if (isFormOpen) return;

      // If clicking inside the details panel itself, don't close
      if (
        detailsPanelRef.current &&
        detailsPanelRef.current.contains(e.target as Node)
      ) {
        return;
      }

      // If clicking a task card, today's focus, form triggers, header controls, or the details workspace itself, don't close
      const target = e.target as HTMLElement;
      if (
        target.closest("#task-details-workspace") ||
        target.closest(".task-card-item") ||
        target.closest("#view-all-tasks-btn") ||
        target.closest("#today-focus-panel") ||
        target.closest(".modal-container") ||
        target.closest("header")
      ) {
        return;
      }

      setSelectedTask(null);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedTask, isFormOpen]);

  // Smoothly scroll to the Selected Task Details panel when selectedTask changes
  useEffect(() => {
    if (!selectedTask) return;
    if (!shouldScrollRef.current) return;

    // Reset scroll trigger to prevent unintended scroll on other state updates/re-renders
    shouldScrollRef.current = false;

    const handleScroll = () => {
      if (detailsPanelRef.current) {
        const rect = detailsPanelRef.current.getBoundingClientRect();
        const viewportHeight =
          window.innerHeight || document.documentElement.clientHeight;

        // Check if the panel is fully visible within the viewport
        const isFullyVisible = rect.top >= 16 && rect.bottom <= viewportHeight;

        if (!isFullyVisible) {
          const scrollTop =
            window.scrollY || document.documentElement.scrollTop;
          const targetY = rect.top + scrollTop - 24; // ~24px spacing from the top of the viewport
          window.scrollTo({
            top: targetY,
            behavior: "smooth",
          });
        }
      }
    };

    // Use requestAnimationFrame to let rendering settle before measuring DOM coordinates
    const frameId = requestAnimationFrame(() => {
      requestAnimationFrame(handleScroll);
    });

    return () => cancelAnimationFrame(frameId);
  }, [selectedTask?.id]);

  const handleFetchCoachAdvice = async (task: Task) => {
    if (!task) return;
    setAdviceLoading(task.id);
    try {
      const res = await fetch("/api/gemini/task-advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, currentTime: new Date().toISOString() }),
      });
      if (res.ok) {
        const advice = await res.json();
        const updatedTask = {
          ...task,
          coachAdvice: advice,
        };

        // Update local tasks state
        setTasks((prevTasks) => {
          const updated = prevTasks.map((t) =>
            t.id === task.id ? updatedTask : t,
          );
          if (!user) {
            localStorage.setItem("local_tasks", JSON.stringify(updated));
          }
          return updated;
        });
        // Update selectedTask
        setSelectedTask(updatedTask);

        // Update database if authenticated
        if (user) {
          await updateExistingTask(user.uid, task.id, { coachAdvice: advice });
        }
      }
    } catch (err) {
      console.error("Failed to fetch task advice:", err);
    } finally {
      setAdviceLoading(null);
    }
  };

  const handleRefreshAI = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    setRefreshingTaskId(taskId);
    try {
      const analyzeRes = await fetch("/api/gemini/analyze-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: task.title,
          description: task.description || "",
          deadline: task.deadline,
          priority: task.priority,
          effortHours: task.effortHours,
          subtasks: task.subtasks || [],
          currentTime: new Date().toISOString(),
        }),
      });

      if (analyzeRes.ok) {
        const data = await analyzeRes.json();

        const updatedTask: Task = {
          ...task,
          aiSummary: data.aiSummary,
          aiPriority: data.aiPriority,
          riskAnalysis: data.riskAnalysis,
          rescuePlan: data.rescuePlan,
          executionStrategy: data.executionStrategy,
          coachAdvice: data.coachAdvice,
          // Preserve task status, etc.
          breakdownGenerated: true,
          updatedAt: new Date().toISOString(),
        };

        setTasks((prevTasks) => {
          const updated = prevTasks.map((t) =>
            t.id === taskId ? updatedTask : t,
          );
          if (!user) {
            localStorage.setItem("local_tasks", JSON.stringify(updated));
          }
          return updated;
        });

        if (selectedTask?.id === taskId) {
          setSelectedTask(updatedTask);
        }

        if (user) {
          await updateExistingTask(user.uid, taskId, {
            aiSummary: data.aiSummary,
            aiPriority: data.aiPriority,
            riskAnalysis: data.riskAnalysis,
            rescuePlan: data.rescuePlan,
            executionStrategy: data.executionStrategy,
            coachAdvice: data.coachAdvice,
            breakdownGenerated: true,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    } catch (err) {
      console.error("Failed to refresh task AI:", err);
    } finally {
      setRefreshingTaskId(null);
    }
  };

  const handleSelectTask = async (task: Task) => {
    if (selectedTask?.id === task.id) {
      setSelectedTask(null);
    } else {
      shouldScrollRef.current = true;
      setSelectedTask(task);
      if (task && !task.coachAdvice && task.status !== "completed") {
        await handleFetchCoachAdvice(task);
      }
    }
  };

  // 1. Setup Auth and configurations
  useEffect(() => {
    const unsubscribe = initAuth(
      async (firebaseUser) => {
        try {
          console.log("AUTH USER:", firebaseUser);

          setUser(firebaseUser);
          setNeedsAuth(false);

          await loadUserData(firebaseUser.uid, firebaseUser.email || "");
        } catch (error) {
          console.error("Failed to initialize user:", error);
        } finally {
          setAuthLoading(false);
        }
      },
      () => {
        setUser(null);
        setNeedsAuth(true);
        setAuthLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  const loadUserData = async (userId: string, email: string) => {
    try {
      const profile = await getUserProfile(userId);
      if (profile) {
        setLocalMode(false);
        setUserProfile(profile);
      } else {
        const defaultProfile: UserProfile = {
          userId,
          email,
          productivityScore: 100,
          sheetsSyncConfig: { isEnabled: false },
          updatedAt: new Date().toISOString(),
          categories: [],
        };
        await saveUserProfile(userId, email, defaultProfile);
        setUserProfile(defaultProfile);
      }

      const userTasks = await getUserTasks(userId);
      setTasks(userTasks);

      // Auto-select first task if none selected
      if (userTasks.length > 0) {
        setSelectedTask(userTasks[0]);
      }
    } catch (err) {
      console.error(
        "Failed to sync cloud Firestore, falling back to local database:",
        err,
      );
      // fallback to local storage on permission error
      const cached = localStorage.getItem(`tasks_${userId}`);
      if (cached) {
        setTasks(JSON.parse(cached));
      }
    }
  };

const handleLogin = async () => {
  try {
    const result = await googleSignIn();

    if (result) {
      setUser(result.user);
      setAccessToken(result.accessToken);

      console.log("Access token stored:", !!result.accessToken);
    }
  } catch (error) {
    console.error("Login failed:", error);
  }
};

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setAccessToken("");
    setUserProfile(null);
    setNeedsAuth(true);
    setSelectedTask(null);
    setIsUserMenuOpen(false);
    localStorage.removeItem("demo_mode");
  };

  const handleLocalStart = (name: string) => {
    // Save name locally
    localStorage.setItem("user_name", name);
    localStorage.setItem("local_mode", "true");
    // Open app normally
    setNeedsAuth(false);
    setLocalMode(true);
  };

  // 2. Task Management Logic
  const handleGenerateBreakdownLater = async (task: Task) => {
    setBreakdownLoading(task.id);
    try {
      const breakdownRes = await fetch("/api/gemini/breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: task.title,
          description: task.description || "",
          deadline: task.deadline,
          priority: task.priority,
          effortHours: task.effortHours,
        }),
      });

      let bdSubtasks = [];
      let bdStrategy = "";
      let isFallbackBd = false;

      if (breakdownRes.ok) {
        const bd = await breakdownRes.json();
        bdSubtasks = bd.subtasks;
        bdStrategy = bd.executionStrategy;
        isFallbackBd = bd.isFallback || false;
      } else {
        bdSubtasks = generateFallbackSubtasks(task.title, task.effortHours);
        bdStrategy =
          "Establish continuous focus. Break down elements and proceed sequentially to guarantee delivery.";
        isFallbackBd = true;
      }

      const updatedTask: Task = {
        ...task,
        subtasks: bdSubtasks,
        executionStrategy: bdStrategy,
        breakdownGenerated: true,
        breakdownIsFallback: isFallbackBd,
        updatedAt: new Date().toISOString(),
      };

      const updatedTasks = tasks.map((t) =>
        t.id === task.id ? updatedTask : t,
      );
      setTasks(updatedTasks);
      setSelectedTask(updatedTask);

      if (user) {
        await updateExistingTask(user.uid, task.id, {
          subtasks: bdSubtasks,
          executionStrategy: bdStrategy,
          breakdownGenerated: true,
        });
        // Update offline cache
        localStorage.setItem(`tasks_${user.uid}`, JSON.stringify(updatedTasks));
      } else {
        localStorage.setItem("local_tasks", JSON.stringify(updatedTasks));
      }

      // Sync updated tasks array to Google Sheets if enabled
      await handleAutoSheetsSync(updatedTasks);
    } catch (err) {
      console.warn(
        "Failed to generate breakdown later, falling back to rule-based subtasks:",
        err,
      );
      // Fallback
      const fallbackSub = generateFallbackSubtasks(
        task.title,
        task.effortHours,
      );
      const fallbackStrategy =
        "Establish continuous focus. Break down elements and proceed sequentially to guarantee delivery.";

      const updatedTask: Task = {
        ...task,
        subtasks: fallbackSub,
        executionStrategy: fallbackStrategy,
        breakdownGenerated: true,
        breakdownIsFallback: true,
        updatedAt: new Date().toISOString(),
      };

      const updatedTasks = tasks.map((t) =>
        t.id === task.id ? updatedTask : t,
      );
      setTasks(updatedTasks);
      setSelectedTask(updatedTask);

      if (user) {
        try {
          await updateExistingTask(user.uid, task.id, {
            subtasks: fallbackSub,
            executionStrategy: fallbackStrategy,
            breakdownGenerated: true,
          });
        } catch (dbErr) {
          console.error("Failed to write fallback to DB:", dbErr);
        }
      } else {
        localStorage.setItem("local_tasks", JSON.stringify(updatedTasks));
      }
    } finally {
      setBreakdownLoading(null);
    }
  };

  const handleTaskSubmit = async (taskData: {
    title: string;
    description: string;
    deadline?: string;
    priority: "low" | "medium" | "high" | "urgent";
    effortHours: number;
    generateBreakdown?: boolean;
    category?: string;
    notes?: string;
    startTime?: string;
  }) => {
    const taskId = editTask ? editTask.id : `task-${Date.now()}`;
    const isNew = !editTask;
    const hasChanged =
      editTask &&
      (editTask.title !== taskData.title ||
        editTask.description !== taskData.description ||
        editTask.deadline !== taskData.deadline ||
        editTask.priority !== taskData.priority ||
        editTask.effortHours !== taskData.effortHours);

    // 1. Initial/optimistic default values (fallback template if new/changed, or existing values if editing)
    let subtasks: Subtask[] = editTask
      ? editTask.subtasks
      : generateFallbackSubtasks(taskData.title, taskData.effortHours);
    let executionStrategy = editTask
      ? editTask.executionStrategy || ""
      : "Establish continuous focus. Break down elements and proceed sequentially to guarantee delivery.";
    let breakdownGenerated = editTask
      ? (editTask.breakdownGenerated ?? false)
      : true;
    let riskAnalysis = editTask
      ? editTask.riskAnalysis || {
          riskLevel: "low" as const,
          probability: 10,
          reasoning: "Local calculation",
        }
      : {
          riskLevel: "medium" as const,
          probability: 50,
          reasoning:
            "Steady execution block active. Track subtask checklist status updates.",
        };
    let aiSummary = editTask
      ? editTask.aiSummary || ""
      : `Action-focused track regarding ${taskData.title}.`;
    let aiPriority: "low" | "moderate" | "high" = editTask
      ? editTask.aiPriority || "moderate"
      : taskData.priority === "urgent" || taskData.priority === "high"
        ? "high"
        : taskData.priority === "low"
          ? "low"
          : "moderate";
    let isFallbackBd = editTask
      ? (editTask.breakdownIsFallback ?? false)
      : true;
    let coachAdvice = editTask ? editTask.coachAdvice : undefined;
    let rescuePlan = editTask ? editTask.rescuePlan : undefined;

    // 2. Handle Custom Category immediately
    let trimmedCategory = taskData.category ? taskData.category.trim() : "";
    const DEFAULT_CATEGORIES = ["Study", "Work", "Fitness", "Personal"];

    if (trimmedCategory) {
      const defaultMatch = DEFAULT_CATEGORIES.find(
        (c) => c.toLowerCase() === trimmedCategory.toLowerCase(),
      );
      const currentCustom = userProfile?.categories || [];
      const customMatch = currentCustom.find(
        (c) => c.toLowerCase() === trimmedCategory.toLowerCase(),
      );

      if (defaultMatch) {
        trimmedCategory = defaultMatch;
      } else if (customMatch) {
        trimmedCategory = customMatch;
      } else {
        const updatedCategories = [...currentCustom, trimmedCategory];

        const updatedProfile = {
          ...(userProfile || {
            userId: user ? user.uid : "demo",
            email: user ? user.email || "" : "demo@nowornever.ai",
            productivityScore: 100,
          }),
          categories: updatedCategories,
          updatedAt: new Date().toISOString(),
        } as UserProfile;

        setUserProfile(updatedProfile);

        if (user) {
          saveUserProfile(user.uid, user.email || "", {
            categories: updatedCategories,
          }).catch((err) => {
            console.error("Failed to save custom category to Firestore:", err);
          });
        } else {
          localStorage.setItem("demo_profile", JSON.stringify(updatedProfile));
        }
      }
    }

    const parsedDeadline = taskData.deadline
      ? safeDate(taskData.deadline)?.toISOString() || ""
      : "";
    const parsedStartTime = taskData.startTime
      ? safeDate(taskData.startTime)?.toISOString() || ""
      : "";

    // 3. Construct optimistic Task object
    const newTask: Task = {
      id: taskId,
      title: taskData.title,
      description: taskData.description,
      deadline: parsedDeadline,
      priority: taskData.priority,
      effortHours: taskData.effortHours,
      status: editTask ? editTask.status : "pending",
      userId: user ? user.uid : "demo",
      subtasks,
      executionStrategy,
      riskAnalysis,
      aiSummary,
      aiPriority,
      breakdownGenerated,
      breakdownIsFallback: isFallbackBd,
      rescuePlan,
      coachAdvice,
      category: trimmedCategory,
      notes: taskData.notes || "",
      startTime: parsedStartTime,
      startDate: parsedStartTime ? parsedStartTime.split("T")[0] : "",
      estimatedDuration: taskData.effortHours,
      expectedCompletion: parsedStartTime
        ? new Date(
            new Date(parsedStartTime).getTime() +
              taskData.effortHours * 3600 * 1000,
          ).toISOString()
        : "",
      dueDate: parsedDeadline,
      createdAt: editTask ? editTask.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    // 4. Update state and CLOSE modal immediately
    let updatedTasks = [];
    if (editTask) {
      updatedTasks = tasks.map((t) => (t.id === editTask.id ? newTask : t));
    } else {
      updatedTasks = [newTask, ...tasks];
    }
    setTasks(updatedTasks);
    shouldScrollRef.current = true;
    setSelectedTask(newTask);
    setEditTask(null);
    setIsFormOpen(false); // Close the Add/Edit Task Modal immediately

    if (!user) {
      localStorage.setItem("local_tasks", JSON.stringify(updatedTasks));
    }

    // 5. Asynchronously execute API analysis and Firestore writes in background
    (async () => {
      let finalTask = { ...newTask };
      let updatedWithAI = false;

      if (isNew || hasChanged) {
        try {
          const analyzeRes = await fetch("/api/gemini/analyze-task", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: taskData.title,
              description: taskData.description,
              deadline: taskData.deadline,
              priority: taskData.priority,
              effortHours: taskData.effortHours,
              subtasks: isNew ? [] : editTask?.subtasks || [],
              currentTime: new Date().toISOString(),
            }),
          });

          if (analyzeRes.ok) {
            const data = await analyzeRes.json();
            finalTask.aiSummary = data.aiSummary;
            finalTask.aiPriority = data.aiPriority;
            finalTask.riskAnalysis = data.riskAnalysis;
            finalTask.rescuePlan = data.rescuePlan;
            if (
              isNew ||
              !editTask?.subtasks ||
              editTask.subtasks.length === 0
            ) {
              finalTask.subtasks = data.subtasks;
            }
            finalTask.executionStrategy = data.executionStrategy;
            finalTask.coachAdvice = data.coachAdvice;
            finalTask.breakdownGenerated = true;
            finalTask.breakdownIsFallback = data.isFallback || false;
            updatedWithAI = true;

            // Merge back into state and local cache
            setTasks((prevTasks) => {
              const updated = prevTasks.map((t) =>
                t.id === taskId ? finalTask : t,
              );
              setSelectedTask((selected) =>
                selected && selected.id === taskId ? finalTask : selected,
              );
              if (user) {
                localStorage.setItem(
                  `tasks_${user.uid}`,
                  JSON.stringify(updated),
                );
              } else {
                localStorage.setItem("local_tasks", JSON.stringify(updated));
              }
              return updated;
            });
          }
        } catch (err) {
          console.warn("AI generation background error.", err);
        }
      }

      // Write to Database in the background
      if (user) {
        try {
          if (editTask) {
            await updateExistingTask(user.uid, editTask.id, finalTask);
          } else {
            await createNewTask(user.uid, taskId, finalTask);
          }

          setTasks((prevTasks) => {
            const updated = prevTasks.map((t) =>
              t.id === taskId ? finalTask : t,
            );
            localStorage.setItem(`tasks_${user.uid}`, JSON.stringify(updated));
            return updated;
          });
        } catch (err) {
          console.error("Firestore write background failed:", err);
        }
      }

      // Sync sheets in the background using final tasks array
      setTasks((latestTasks) => {
        handleAutoSheetsSync(latestTasks).catch((err) => {
          console.error("Sheets background sync failed:", err);
        });
        return latestTasks;
      });
    })();
  };

  const handleToggleSubtask = async (taskId: string, subtaskId: string) => {
    const updatedTasks = tasks.map((task) => {
      if (task.id === taskId) {
        const updatedSubtasks = task.subtasks.map((sub) =>
          sub.id === subtaskId
            ? {
                ...sub,
                status:
                  sub.status === "completed"
                    ? ("pending" as const)
                    : ("completed" as const),
              }
            : sub,
        );
        return {
          ...task,
          subtasks: updatedSubtasks,
          updatedAt: new Date().toISOString(),
        };
      }
      return task;
    });

    setTasks(updatedTasks);
    const updatedSelected = updatedTasks.find((t) => t.id === taskId);
    if (updatedSelected) {
      setSelectedTask(updatedSelected);

      // Dynamic re-analysis of risk & advice on subtask toggle
      try {
        const riskRes = await fetch("/api/gemini/risk-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task: updatedSelected,
            currentTime: new Date().toISOString(),
          }),
        });
        if (riskRes.ok) {
          const riskAnalysis = await riskRes.json();
          const taskWithRisk = { ...updatedSelected, riskAnalysis };

          setTasks((prev) =>
            prev.map((t) => (t.id === taskId ? taskWithRisk : t)),
          );
          setSelectedTask(taskWithRisk);

          if (user) {
            await updateExistingTask(user.uid, taskId, {
              subtasks: updatedSelected.subtasks,
              riskAnalysis,
            });
          } else {
            localStorage.setItem(
              "local_tasks",
              JSON.stringify(
                updatedTasks.map((t) => (t.id === taskId ? taskWithRisk : t)),
              ),
            );
          }

          // Re-fetch Aura advice with updated status/subtasks
          handleFetchCoachAdvice(taskWithRisk);
        } else {
          handleFetchCoachAdvice(updatedSelected);
        }
      } catch (err) {
        console.error("Failed to re-fetch risk dynamic updates:", err);
        handleFetchCoachAdvice(updatedSelected);
      }
    }

    if (user) {
      const taskObj = updatedTasks.find((t) => t.id === taskId);
      if (taskObj) {
        await updateExistingTask(user.uid, taskId, {
          subtasks: taskObj.subtasks,
        });
      }
    } else {
      localStorage.setItem("local_tasks", JSON.stringify(updatedTasks));
    }
  };

  const handleTaskComplete = async (taskId: string) => {
    const taskObj = tasks.find((t) => t.id === taskId);
    if (!taskObj) {
      return;
    }

    const originalTasks = [...tasks];
    const originalUserProfile = userProfile ? { ...userProfile } : null;
    const originalSelectedTask = selectedTask ? { ...selectedTask } : null;

    const nextStatus = taskObj.status === "completed" ? "pending" : "completed";

    const updatedTasks = tasks.map((task) => {
      if (task.id === taskId) {
        return {
          ...task,
          status: nextStatus as "completed" | "pending",
          updatedAt: new Date().toISOString(),
        };
      }
      return task;
    });

    setTasks(updatedTasks);
    const updatedSelected = updatedTasks.find((t) => t.id === taskId);
    if (updatedSelected) {
      setSelectedTask(updatedSelected);
    }

    if (nextStatus === "completed") {
      setCompletedTaskCelebration(taskObj.title);
    }

    let updatedProfile: UserProfile | null = null;
    if (userProfile) {
      const currentScore =
        userProfile.productivityScore !== undefined
          ? userProfile.productivityScore
          : 85;
      const scoreDiff = nextStatus === "completed" ? 15 : -15;
      const newScore = Math.max(0, Math.min(100, currentScore + scoreDiff));

      let updatedDailyPlan = userProfile.dailyPlan;
      if (updatedDailyPlan) {
        const updatedSchedule = updatedDailyPlan.suggestedSchedule.map(
          (item) => {
            if (
              item.taskTitle.toLowerCase() === taskObj.title.toLowerCase() ||
              item.action.toLowerCase().includes(taskObj.title.toLowerCase()) ||
              item.taskTitle.toLowerCase() ===
                `✓ ${taskObj.title.toLowerCase()}`
            ) {
              if (nextStatus === "completed") {
                return {
                  ...item,
                  taskTitle: item.taskTitle.startsWith("✓ ")
                    ? item.taskTitle
                    : `✓ ${item.taskTitle}`,
                  action: item.action.startsWith("✓ ")
                    ? item.action
                    : `✓ Completed successfully! ${item.action.replace(/^•\s*/, "")}`,
                };
              } else {
                return {
                  ...item,
                  taskTitle: item.taskTitle.replace(/^✓\s*/, ""),
                  action: item.action.replace(
                    /^✓\s*Completed successfully!\s*/,
                    "• ",
                  ),
                };
              }
            }
            return item;
          },
        );
        updatedDailyPlan = {
          ...updatedDailyPlan,
          suggestedSchedule: updatedSchedule,
        };
      }

      updatedProfile = {
        ...userProfile,
        productivityScore: newScore,
        dailyPlan: updatedDailyPlan,
        updatedAt: new Date().toISOString(),
      } as UserProfile;

      setUserProfile(updatedProfile);
    }

    try {
      if (user) {
        if (updatedProfile) {
          await saveUserProfile(user.uid, user.email || "", updatedProfile);
        }
        await updateExistingTask(user.uid, taskId, { status: nextStatus });
      } else {
        localStorage.setItem("local_tasks", JSON.stringify(updatedTasks));
        if (updatedProfile) {
          localStorage.setItem("demo_profile", JSON.stringify(updatedProfile));
        }
      }

      // Auto Sheets sync on complete
      await handleAutoSheetsSync(updatedTasks);
    } catch (err) {
      console.error("ERROR inside handleTaskComplete try-catch:", err);
      // Revert local state on error
      setTasks(originalTasks);
      setUserProfile(originalUserProfile);
      setSelectedTask(originalSelectedTask);
      setCompletedTaskCelebration(null);
      throw err;
    }
  };

  const handleTaskDelete = (taskId: string) => {
    setTaskToDelete(taskId);
    setDeleteError(null);
  };

  const executeTaskDelete = async (taskId: string) => {
    // 1. Close confirmation dialog and clear errors immediately
    setTaskToDelete(null);
    setDeleteError(null);

    try {
      const deletedTaskObj = tasks.find((t) => t.id === taskId);
      const deletedTitle = deletedTaskObj?.title;

      const originalTasks = [...tasks];
      const originalSelectedTask = selectedTask;
      const originalUserProfile = userProfile;

      const updatedTasks = tasks.filter((task) => task.id !== taskId);

      // 2. Update local state immediately for instant response
      setTasks(updatedTasks);
      if (selectedTask?.id === taskId) {
        setSelectedTask(updatedTasks.length > 0 ? updatedTasks[0] : null);
      }

      if (!user) {
        localStorage.setItem("local_tasks", JSON.stringify(updatedTasks));
      }

      // 3. Remove the task from the daily plan locally immediately
      let updatedDailyPlan: any = null;
      let newUserProfile: UserProfile | null = null;

      if (userProfile?.dailyPlan) {
        const filteredPriorities = userProfile.dailyPlan.priorities.filter(
          (p) => p !== taskId && (deletedTitle ? p !== deletedTitle : true),
        );

        const filteredSchedule = userProfile.dailyPlan.suggestedSchedule.filter(
          (s) => !deletedTitle || s.taskTitle !== deletedTitle,
        );

        updatedDailyPlan = {
          ...userProfile.dailyPlan,
          priorities: filteredPriorities,
          suggestedSchedule: filteredSchedule,
        };

        newUserProfile = {
          ...userProfile,
          dailyPlan: updatedDailyPlan,
          updatedAt: new Date().toISOString(),
        } as UserProfile;

        setUserProfile(newUserProfile);

        if (!user) {
          localStorage.setItem("demo_profile", JSON.stringify(newUserProfile));
        }
      }

      // 4. Perform actual deletion from database and Sheets sync in background
      (async () => {
        let backendFailed = false;

        if (user) {
          try {
            await deleteExistingTask(user.uid, taskId);
            localStorage.setItem(
              `tasks_${user.uid}`,
              JSON.stringify(updatedTasks),
            );
          } catch (err) {
            console.error("Firestore task delete failed:", err);
            backendFailed = true;
          }

          if (!backendFailed && updatedDailyPlan) {
            try {
              await saveUserProfile(user.uid, user.email || "", {
                dailyPlan: updatedDailyPlan,
              });
            } catch (err) {
              console.error(
                "Firestore user profile dailyPlan update failed:",
                err,
              );
              backendFailed = true;
            }
          }
        }

        if (backendFailed) {
          // Revert states on background save/delete failure
          setTasks(originalTasks);
          setSelectedTask(originalSelectedTask);
          setUserProfile(originalUserProfile);

          if (user) {
            localStorage.setItem(
              `tasks_${user.uid}`,
              JSON.stringify(originalTasks),
            );
            if (originalUserProfile?.dailyPlan) {
              saveUserProfile(user.uid, user.email || "", {
                dailyPlan: originalUserProfile.dailyPlan,
              }).catch((e) => {
                console.error("Failed to restore cloud dailyPlan:", e);
              });
            }
          } else {
            localStorage.setItem("local_tasks", JSON.stringify(originalTasks));
            if (originalUserProfile) {
              localStorage.setItem(
                "demo_profile",
                JSON.stringify(originalUserProfile),
              );
            }
          }

          setToast({
            message:
              "Failed to sync task deletion with database. Task restored.",
            type: "error",
          });
          setTimeout(() => setToast(null), 4000);
        } else {
          setToast({
            message: "Task deleted successfully.",
            type: "success",
          });
          setTimeout(() => setToast(null), 3000);

          // Google Sheets Auto-sync
          try {
            await handleAutoSheetsSync(updatedTasks);
          } catch (err) {
            console.error(
              "Sheets sync background failed during deletion:",
              err,
            );
          }
        }
      })();
    } catch (err) {
      console.error("Task deletion failed:", err);
      setToast({
        message: "An unexpected error occurred during task deletion.",
        type: "error",
      });
      setTimeout(() => setToast(null), 4000);
    }
  };

  const deleteAllTasks = async () => {
    try {
      const originalTasks = [...tasks];
      const originalSelectedTask = selectedTask;
      const originalUserProfile = userProfile;

      // 1. Update local state immediately
      setTasks([]);
      setSelectedTask(null);

      if (!user) {
        localStorage.setItem("local_tasks", JSON.stringify([]));
      }

      // 2. Clear daily plan if exists and update productivity score
      let updatedDailyPlan: any = null;
      let newUserProfile: UserProfile | null = null;

      if (userProfile) {
        if (userProfile.dailyPlan) {
          updatedDailyPlan = {
            ...userProfile.dailyPlan,
            priorities: [],
            suggestedSchedule: [],
          };
        }

        newUserProfile = {
          ...userProfile,
          productivityScore: 100,
          dailyPlan: updatedDailyPlan,
          updatedAt: new Date().toISOString(),
        } as UserProfile;

        setUserProfile(newUserProfile);

        if (!user) {
          localStorage.setItem("demo_profile", JSON.stringify(newUserProfile));
        }
      }

      // 3. Perform backend deletion
      let backendFailed = false;

      if (user) {
        try {
          // Delete all tasks in Firestore
          const deletePromises = originalTasks.map((t) =>
            deleteExistingTask(user.uid, t.id),
          );
          await Promise.all(deletePromises);

          localStorage.setItem(`tasks_${user.uid}`, JSON.stringify([]));
        } catch (err) {
          console.error("Firestore deleteAllTasks failed:", err);
          backendFailed = true;
        }

        if (!backendFailed && newUserProfile) {
          try {
            await saveUserProfile(user.uid, user.email || "", {
              dailyPlan: updatedDailyPlan || undefined,
              productivityScore: 100,
            });
          } catch (err) {
            console.error("Firestore user profile update failed:", err);
            backendFailed = true;
          }
        }
      }

      if (backendFailed) {
        // Revert states on background save/delete failure
        setTasks(originalTasks);
        setSelectedTask(originalSelectedTask);
        setUserProfile(originalUserProfile);

        if (user) {
          localStorage.setItem(
            `tasks_${user.uid}`,
            JSON.stringify(originalTasks),
          );
          if (originalUserProfile?.dailyPlan) {
            saveUserProfile(user.uid, user.email || "", {
              dailyPlan: originalUserProfile.dailyPlan,
              productivityScore: originalUserProfile.productivityScore,
            }).catch((e) => {
              console.error("Failed to restore cloud dailyPlan:", e);
            });
          }
        } else {
          localStorage.setItem("local_tasks", JSON.stringify(originalTasks));
          if (originalUserProfile) {
            localStorage.setItem(
              "demo_profile",
              JSON.stringify(originalUserProfile),
            );
          }
        }

        setToast({
          message: "Failed to delete all tasks. Restored.",
          type: "error",
        });
        setTimeout(() => setToast(null), 4000);
      } else {
        setToast({
          message: "All tasks deleted successfully.",
          type: "success",
        });
        setTimeout(() => setToast(null), 3000);

        // Google Sheets Auto-sync
        try {
          await handleAutoSheetsSync([]);
        } catch (err) {
          console.error("Google Sheets sync failed:", err);
        }
      }
    } catch (error) {
      console.error("Error in deleteAllTasks:", error);
    }
  };

  const deleteCompletedTasks = async () => {
    try {
      const originalTasks = [...tasks];
      const originalSelectedTask = selectedTask;
      const originalUserProfile = userProfile;

      const completedTasks = tasks.filter((t) => t.status === "completed");
      const remainingTasks = tasks.filter((t) => t.status !== "completed");

      if (completedTasks.length === 0) {
        return; // Nothing to delete
      }

      // 1. Update local state immediately
      setTasks(remainingTasks);

      // If the selected task was deleted, clear selectedTask
      if (selectedTask && selectedTask.status === "completed") {
        setSelectedTask(null);
      }

      if (!user) {
        localStorage.setItem("local_tasks", JSON.stringify(remainingTasks));
      }

      // 2. Filter daily plan priorities and suggestedSchedule
      let updatedDailyPlan: any = null;
      let newUserProfile: UserProfile | null = null;

      if (userProfile?.dailyPlan) {
        const completedTitles = completedTasks.map((t) =>
          t.title.toLowerCase(),
        );
        const completedIds = completedTasks.map((t) => t.id);

        const filteredPriorities = userProfile.dailyPlan.priorities.filter(
          (p) =>
            !completedIds.includes(p) &&
            !completedTitles.includes(p.toLowerCase()),
        );

        const filteredSchedule = userProfile.dailyPlan.suggestedSchedule.filter(
          (item) => {
            const itemTitleClean = item.taskTitle
              .replace(/^✓\s*/, "")
              .toLowerCase();
            return !completedTitles.includes(itemTitleClean);
          },
        );

        updatedDailyPlan = {
          ...userProfile.dailyPlan,
          priorities: filteredPriorities,
          suggestedSchedule: filteredSchedule,
        };

        newUserProfile = {
          ...userProfile,
          dailyPlan: updatedDailyPlan,
          updatedAt: new Date().toISOString(),
        } as UserProfile;

        setUserProfile(newUserProfile);

        if (!user) {
          localStorage.setItem("demo_profile", JSON.stringify(newUserProfile));
        }
      }

      // 3. Perform backend deletion
      let backendFailed = false;

      if (user) {
        try {
          // Delete completed tasks from Firestore
          const deletePromises = completedTasks.map((t) =>
            deleteExistingTask(user.uid, t.id),
          );
          await Promise.all(deletePromises);

          localStorage.setItem(
            `tasks_${user.uid}`,
            JSON.stringify(remainingTasks),
          );
        } catch (err) {
          console.error("Firestore deleteCompletedTasks failed:", err);
          backendFailed = true;
        }

        if (!backendFailed && newUserProfile) {
          try {
            await saveUserProfile(user.uid, user.email || "", {
              dailyPlan: updatedDailyPlan || undefined,
            });
          } catch (err) {
            console.error(
              "Firestore user profile dailyPlan update failed:",
              err,
            );
            backendFailed = true;
          }
        }
      }

      if (backendFailed) {
        // Revert states on background save/delete failure
        setTasks(originalTasks);
        setSelectedTask(originalSelectedTask);
        setUserProfile(originalUserProfile);

        if (user) {
          localStorage.setItem(
            `tasks_${user.uid}`,
            JSON.stringify(originalTasks),
          );
          if (originalUserProfile?.dailyPlan) {
            saveUserProfile(user.uid, user.email || "", {
              dailyPlan: originalUserProfile.dailyPlan,
            }).catch((e) => {
              console.error("Failed to restore cloud dailyPlan:", e);
            });
          }
        } else {
          localStorage.setItem("local_tasks", JSON.stringify(originalTasks));
          if (originalUserProfile) {
            localStorage.setItem(
              "demo_profile",
              JSON.stringify(originalUserProfile),
            );
          }
        }

        setToast({
          message: "Failed to delete completed tasks. Restored.",
          type: "error",
        });
        setTimeout(() => setToast(null), 4000);
      } else {
        setToast({
          message: "Completed tasks deleted successfully.",
          type: "success",
        });
        setTimeout(() => setToast(null), 3000);

        // Google Sheets Auto-sync
        try {
          await handleAutoSheetsSync(remainingTasks);
        } catch (err) {
          console.error("Google Sheets sync failed:", err);
        }
      }
    } catch (error) {
      console.error("Error in deleteCompletedTasks:", error);
    }
  };

  const handleRankTasks = async () => {
    const activeTasks = tasks.filter((t) => t.status === "pending");
    if (activeTasks.length <= 1) {
      alert(
        "Please add at least 2 active tasks to perform AI Priority Ranking.",
      );
      return;
    }

    setRankingLoading(true);
    try {
      const res = await fetch("/api/gemini/rank-priority", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: activeTasks }),
      });

      if (!res.ok) throw new Error("Ranking failed");

      const data = await res.json();
      const rankedIds: string[] = data.rankedTaskIds;
      const explanations: Record<string, string> = data.explanations;

      setRankingExplanations(explanations);

      // Sort tasks array so ranked active tasks are ordered as generated, followed by completed tasks
      const completed = tasks.filter((t) => t.status === "completed");
      const sortedActive = [...activeTasks].sort((a, b) => {
        const indexA = rankedIds.indexOf(a.id);
        const indexB = rankedIds.indexOf(b.id);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });

      const fullySorted = [...sortedActive, ...completed];
      setTasks(fullySorted);
      if (sortedActive.length > 0) setSelectedTask(sortedActive[0]);

      alert(
        "AI Coach has prioritized and re-ranked your active task track! Check the ranked order and details.",
      );
    } catch (err) {
      console.error(err);
      alert("Failed to rank tasks. Coach Aura is busy organizing schedules.");
    } finally {
      setRankingLoading(false);
    }
  };

  const handleUpdateSyncConfig = async (config: SheetsSyncConfig) => {
    if (!user) return;
    setUserProfile((prevProfile) => {
      if (!prevProfile) return null;
      return {
        ...prevProfile,
        sheetsSyncConfig: config,
        updatedAt: new Date().toISOString(),
      } as UserProfile;
    });
    await saveUserProfile(user.uid, user.email || "", {
      sheetsSyncConfig: config,
    });
  };

const handleAutoSheetsSync = async (updatedTasks: Task[]) => {
  const config = userProfile?.sheetsSyncConfig;

  if (
    !user ||
    !config?.spreadsheetId ||
    !config.isEnabled ||
    !accessToken
  ) {
    return;
  }

  try {
    await syncTasksToSheet(
      config.spreadsheetId,
      updatedTasks,
      accessToken
    );

    const updatedConfig = {
      ...config,
      lastSyncedAt: new Date().toISOString(),
    };

    setUserProfile((prevProfile) => {
      if (!prevProfile) return null;

      return {
        ...prevProfile,
        sheetsSyncConfig: updatedConfig,
        updatedAt: new Date().toISOString(),
      } as UserProfile;
    });

    await saveUserProfile(user.uid, user.email || "", {
      sheetsSyncConfig: updatedConfig,
    });
  } catch (err) {
    console.error(
      "[SYNC] Automatic synchronization failed:",
      err
    );
  }
};

  const DEFAULT_CATEGORIES = ["Study", "Work", "Fitness", "Personal"];
  const customCategories = userProfile?.categories || [];
  const uniqueCustomCategories = customCategories.filter(
    (cat) =>
      !DEFAULT_CATEGORIES.some((d) => d.toLowerCase() === cat.toLowerCase()),
  );
  const allAvailableCategories = [
    ...DEFAULT_CATEGORIES,
    ...uniqueCustomCategories,
  ];

  // 3. Filter computations
  const filteredTasks = tasks.filter((task) => {
    // Search query match
    if (debouncedSearchQuery) {
      const q = debouncedSearchQuery.toLowerCase().trim();
      const matchTitle = task.title.toLowerCase().includes(q);
      const matchDesc = (task.description || "").toLowerCase().includes(q);
      const matchSummary = (task.aiSummary || "").toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchSummary) return false;
    }

    // Priority filter match
    if (priorityFilter !== "all") {
      if (task.priority !== priorityFilter) return false;
    }

    // Status filter match
    if (statusFilter !== "all") {
      if (getDerivedStatus(task) !== statusFilter) return false;
    }

    // Category filter match
    if (categoryFilter !== "all") {
      if ((task.category || "").toLowerCase() !== categoryFilter.toLowerCase())
        return false;
    }

    return true;
  });

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (sortBy === "deadline") {
      const dateA = safeDate(a.deadline);
      const dateB = safeDate(b.deadline);
      const timeA = dateA ? dateA.getTime() : Infinity;
      const timeB = dateB ? dateB.getTime() : Infinity;
      return timeA - timeB;
    }
    return 0; // retain original order
  });

  const isAnyFilterActive =
    searchQuery.trim() !== "" ||
    priorityFilter !== "all" ||
    statusFilter !== "all" ||
    categoryFilter !== "all" ||
    sortBy !== "default";

  const [profileImageError, setProfileImageError] = useState(false);

  useEffect(() => {
    setProfileImageError(false);
  }, [user?.uid]);


  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold text-text-muted">
            Loading your workspace...
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-surface-secondary text-text-primary font-sans flex flex-col selection:bg-accent-primary/25 selection:text-text-primary">
        {/* 1. Landing Screen (If needs authentication) */}
        <AnimatePresence>
          {needsAuth && !user && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-bg-primary p-4"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-accent-primary/5 to-transparent pointer-events-none" />

              <div className="relative w-full max-w-sm text-center space-y-8">
                {/* Branding */}
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-bg-surface rounded-full border border-border-custom shadow-sm text-accent-primary">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-[10px] font-black tracking-widest uppercase">
                      Smart Task Planner
                    </span>
                  </div>
                  <h1 className="text-4xl font-black text-text-primary tracking-tighter">
                    Now or Never
                  </h1>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    Plan smarter.
                    <br />
                    Beat procrastination.
                    <br />
                    Accomplish more with AI-powered task planning.
                  </p>
                </div>

                {/* Authentication Buttons */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <button
                      onClick={handleLogin}
                      disabled={isLoggingIn}
                      className="w-full bg-accent-secondary text-black font-black py-3.5 rounded-2xl flex items-center justify-center gap-3 shadow-lg hover:bg-gray-100 transition-all cursor-pointer"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path
                          fill="#EA4335"
                          d="M12.5 12.22c0-.66-.06-1.3-.17-1.9H7v3.58h3.21c-.14.75-.56 1.38-1.18 1.8v2.32h2.24c1.31-1.21 2.06-3 2.06-5.12z"
                        />
                        <path
                          fill="#4285F4"
                          d="M7 12.22c0-.66.06-1.3.17-1.9H3.77c-.11.6-.17 1.24-.17 1.9s.06 1.3.17 1.9h3.4c-.11-.6-.17-1.24-.17-1.9z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M12.33 10.32c.11-.6.17-1.24.17-1.9s-.06-1.3-.17-1.9H7v3.58h5.33z"
                        />
                        <path
                          fill="#34A853"
                          d="M12.33 13.82c-.11.6-.17 1.24-.17 1.9s.06 1.3.17 1.9h3.4c.66-.61 1.15-1.36 1.41-2.2-.42-1.32-1.18-2.52-2.24-3.52l-2.57 1.82z"
                        />
                      </svg>
                      Continue with Google
                    </button>
                    <p className="text-[10px] text-text-muted font-bold">
                      Sync your tasks securely across devices.
                    </p>
                  </div>

                  <div className="flex items-center text-[10px] text-text-muted font-bold uppercase tracking-widest">
                    <span className="flex-1 border-t border-border-custom"></span>
                    <span className="px-3">OR</span>
                    <span className="flex-1 border-t border-border-custom"></span>
                  </div>

                  <div className="w-full">
                    <button
                      onClick={() => {
                        setNameModalAction("local");
                        setIsNameModalOpen(true);
                      }}
                      className="w-full px-4 py-3 bg-bg-surface border border-border-custom hover:border-accent-primary/30 rounded-2xl text-xs font-bold text-text-primary transition-all cursor-pointer"
                    >
                      Continue Locally
                      <p className="text-[9px] text-text-muted mt-0.5 font-medium">
                        Tasks stay on device.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Security Footer */}
                <div className="text-[10px] text-text-muted font-bold">
                  Secure Google Authentication • Your data stays private
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <NameInputModal
          isOpen={isNameModalOpen}
          onClose={() => setIsNameModalOpen(false)}
          onSubmit={(name) => {
            if (nameModalAction === "local") handleLocalStart(name);
          }}
          title="Welcome!"
          subtitle="What should we call you?"
        />

        {(!needsAuth || localMode) && (
          <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
            <header className="bg-bg-surface border-b border-border-custom sticky top-0 z-40 px-6 md:px-8 py-3 flex items-center justify-between shadow-sm">
            {/* Logo & Greeting */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent-primary/10 text-accent-primary rounded-xl flex items-center justify-center border border-accent-primary/20">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-sm font-black text-text-primary uppercase tracking-tight">
                  Now or Never
                </h1>
              </div>
              {localMode && (
                <div className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-accent-primary/10 text-accent-primary rounded-md">
                  Local Mode
                </div>
              )}
            </div>

            {/* User Controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className="p-2 text-text-secondary hover:text-text-primary rounded-xl transition-colors"
              >
                {theme === "light" ? (
                  <Moon className="w-4 h-4" />
                ) : (
                  <Sun className="w-4 h-4" />
                )}
              </button>

              {/* Google Sheets Sync (Desktop only) */}
              <div className="hidden md:block relative group">
                <button
                  disabled={tasks.length === 0}
                  onClick={() => setIsSheetsSyncOpen(!isSheetsSyncOpen)}
                  className={`p-2 rounded-xl transition-all relative ${
                    tasks.length === 0
                      ? "text-text-secondary/40 cursor-not-allowed opacity-45"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-hover cursor-pointer"
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                </button>

                {/* Tooltip */}
                <div className="absolute right-0 top-full mt-2 w-max max-w-[220px] bg-bg-surface border border-border-custom px-3 py-1.5 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-left text-[11px] font-bold text-text-primary pointer-events-none">
                  {tasks.length === 0
                    ? "No tasks available to synchronize."
                    : "Google Sheets Synchronization"}
                </div>

                {/* Dropdown Popover */}
                <AnimatePresence>
                  {isSheetsSyncOpen && tasks.length > 0 && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsSheetsSyncOpen(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="absolute right-0 mt-2 w-[320px] sm:w-[480px] bg-bg-surface border border-border-custom rounded-2xl shadow-2xl z-50 p-1 overflow-hidden"
                      >
                        <div className="p-4 border-b border-border-custom flex items-center justify-between bg-bg-surface">
                          <div className="flex items-center gap-2">
                            <FileSpreadsheet className="w-4 h-4 text-accent-secondary" />
                            <h4 className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                              Google Sheets Sync
                            </h4>
                          </div>
                          <button
                            onClick={() => setIsSheetsSyncOpen(false)}
                            className="text-text-muted hover:text-text-primary p-1 rounded-lg hover:bg-bg-hover transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="p-1 max-h-[450px] overflow-y-auto custom-scrollbar bg-bg-primary/30">
                          {!user || localMode ? (
                            <div className="p-6 text-center space-y-4 bg-bg-surface">
                              <div className="w-12 h-12 bg-accent-secondary/10 text-accent-secondary rounded-full flex items-center justify-center mx-auto border border-accent-secondary/20">
                                <FileSpreadsheet className="w-6 h-6" />
                              </div>
                              <div className="space-y-1">
                                <h5 className="text-xs font-bold text-text-primary">
                                  Google Account Required
                                </h5>
                                <p className="text-[11px] text-text-secondary leading-relaxed max-w-xs mx-auto">
                                  Active login is required to connect, create,
                                  and synchronize your tasks to Google Sheets.
                                </p>
                              </div>
                              <button
                                onClick={() => {
                                  setIsSheetsSyncOpen(false);
                                  handleLogin();
                                }}
                                className="px-4 py-2 bg-accent-primary hover:bg-accent-primary/95 text-white text-xs font-bold rounded-xl shadow-md transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
                              >
                                Connect Google Account
                              </button>
                            </div>
                          ) : (
                            <SheetsSyncPanel
                              accessToken={accessToken}
                              tasks={tasks}
                              syncConfig={userProfile?.sheetsSyncConfig || null}
                              onUpdateSyncConfig={handleUpdateSyncConfig}
                              onForceSync={async () => {}}
                              isNavbarMode={true}
                            />
                          )}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              <div className="relative">
                <button
                  onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                  className="p-2 text-text-secondary hover:text-text-primary rounded-xl relative transition-colors"
                >
                  <Bell className="w-4 h-4" />
                  {notifications.length > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-accent-primary text-white text-[9px] font-black flex items-center justify-center rounded-full border-2 border-bg-surface">
                      {notifications.length}
                    </span>
                  )}
                </button>

                {/* Notification Dropdown */}
                <AnimatePresence>
                  {isNotificationOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsNotificationOpen(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="absolute right-0 mt-2 w-72 bg-bg-surface border border-border-custom rounded-2xl shadow-2xl z-50 p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-border-custom">
                          <h4 className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                            Notifications
                          </h4>
                          <button
                            onClick={() => setIsNotificationOpen(false)}
                            className="text-text-muted hover:text-text-primary"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                          {notifications.length > 0 ? (
                            notifications.map((n) => (
                              <div
                                key={n.id}
                                className={`p-3 rounded-xl border flex gap-3 ${
                                  n.type === "danger"
                                    ? "bg-status-danger/10 border-status-danger/20 text-status-danger"
                                    : "bg-status-success/10 border-status-success/20 text-status-success"
                                }`}
                              >
                                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                                <p className="text-xs font-bold leading-relaxed">
                                  {n.message}
                                </p>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-4">
                              <p className="text-xs text-text-muted">
                                No new notifications
                              </p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* User Profile */}
              <div className="flex items-center gap-3 border-l border-border-custom pl-3 ml-1">
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center gap-2 p-1 hover:bg-bg-hover rounded-xl transition-colors group"
                  >
                    {user?.photoURL && !profileImageError ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || "User"}
                        onError={() => setProfileImageError(true)}
                        className="w-8 h-8 rounded-full border border-border-custom object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-accent-primary text-white flex items-center justify-center text-xs font-black">
                        {user?.displayName
                          ?.split(" ")
                          .map((n: string) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2) || "U"}
                      </div>
                    )}
                    <div className="hidden md:block text-left">
                      <p className="text-[11px] font-black text-text-primary leading-none">
                        {user?.displayName ||
                          user?.email?.split("@")[0] ||
                          "User"}
                      </p>

                      <p className="text-[9px] font-bold text-text-muted mt-0.5 leading-none">
                        Account
                      </p>
                    </div>
                  </button>

                  <AnimatePresence>
                    {isUserMenuOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setIsUserMenuOpen(false)}
                        />
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 10 }}
                          className="absolute right-0 mt-2 w-56 bg-bg-surface border border-border-custom rounded-2xl shadow-2xl z-50 p-3"
                        >
                          <div className="px-2 py-2 mb-2 border-b border-border-custom">
                            <p className="text-xs font-bold text-text-primary truncate">
                              {user?.displayName || "User"}
                            </p>
                            <p className="text-[10px] text-text-muted truncate">
                              {user?.email || ""}
                            </p>
                          </div>
                          <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-2 p-2 text-status-danger hover:bg-status-danger/5 rounded-xl transition-colors text-xs font-bold text-left"
                          >
                            <LogOut className="w-4 h-4" />
                            Logout
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </header>

          {/* Mobile Navigation Drawer */}

          {/* Main dashboard container */}
          <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 md:p-8 space-y-6 sm:space-y-8 md:space-y-10">
            {/* ==================================================
            1. TOP SECTION: Analytics Panel
            ================================================== */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <h1 className="text-[9px] sm:text-[10px] font-black text-accent-primary uppercase tracking-[0.3em] mb-1">
                    NOW OR NEVER
                  </h1>
                  <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-text-primary tracking-tighter leading-tight">
                    Focus. Plan. Achieve.
                  </h2>
                </div>
                <StreakWidget tasks={tasks} />
              </div>
              <AnalyticsPanel
                tasks={tasks}
                userName={
                  user?.displayName
                    ? user.displayName.trim().split(/\s+/)[0]
                    : storedName || undefined
                }
                onTasksCompletedClick={handleTasksCompletedClick}
                onPendingTasksClick={handlePendingTasksClick}
                onPassedDeadlinesClick={handlePassedDeadlinesClick}
              />
            </div>

            {/* ==================================================
            QUICK ACTIONS: View All Tasks & Generate Timeline
            ================================================== */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full">
              <button
                onClick={() => {
                  setStatusFilter("all");
                  setPriorityFilter("all");
                  setCategoryFilter("all");
                  setSearchQuery("");
                  setSortBy("default");
                  scrollToAllTasksAndHighlight();
                }}
                className="flex-1 px-5 py-3.5 bg-bg-surface hover:bg-bg-hover text-text-primary hover:text-accent-primary rounded-2xl border border-border-custom hover:border-accent-primary/30 transition-all font-extrabold text-xs tracking-wider uppercase flex items-center justify-center gap-2 shadow-sm cursor-pointer h-12"
              >
                <ListTodo className="w-4 h-4 text-accent-primary" />
                View All Tasks
              </button>

              <button
                onClick={() => setIsTimelineOpen(true)}
                className="flex-1 px-5 py-3.5 bg-accent-primary hover:bg-accent-primary/95 text-white rounded-2xl transition-all font-extrabold text-xs tracking-wider uppercase flex items-center justify-center gap-2 shadow-md shadow-accent-primary/10 cursor-pointer h-12"
              >
                <Calendar className="w-4 h-4" />
                Generate Timeline
              </button>
            </div>

            {/* ==================================================
            2. SECOND SECTION: Recommended Next Action (Hero Card)
            ================================================== */}
            <RecommendedNextAction
              tasks={tasks}
              onSelectTask={handleSelectTask}
              onToggleComplete={handleTaskComplete}
            />

            {/* ==================================================
            3. THIRD SECTION: All Tasks
            ================================================== */}
            <div id="all-tasks-section" className="space-y-4 w-full">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <ListTodo className="w-5 h-5 text-accent-primary" />
                  <h3
                    id="active-track-list-header"
                    className="text-sm font-black text-text-primary uppercase tracking-wider"
                  >
                    All Objectives ({filteredTasks.length})
                  </h3>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="relative">
                    <button
                      disabled={tasks.length === 0}
                      onClick={() =>
                        setIsDeleteDropdownOpen(!isDeleteDropdownOpen)
                      }
                      className={`ml-auto sm:ml-0 px-4 py-2 text-xs font-extrabold tracking-wider uppercase rounded-xl flex items-center justify-center gap-1.5 transition-all h-10 shrink-0 border border-transparent select-none ${
                        tasks.length === 0
                          ? "bg-text-secondary/5 text-text-secondary/35 cursor-not-allowed opacity-45"
                          : isDeleteDropdownOpen
                            ? "bg-status-danger text-white shadow-md shadow-status-danger/10 cursor-pointer"
                            : "bg-status-danger/10 text-status-danger hover:bg-status-danger hover:text-white hover:shadow-md hover:shadow-status-danger/10 cursor-pointer"
                      }`}
                      title={
                        tasks.length === 0 ? "No tasks available." : undefined
                      }
                    >
                      <Trash2 className="w-4 h-4" /> Delete Tasks{" "}
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${isDeleteDropdownOpen ? "rotate-180" : ""}`}
                      />
                    </button>

                    <AnimatePresence>
                      {isDeleteDropdownOpen && tasks.length > 0 && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsDeleteDropdownOpen(false)}
                          />
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="absolute right-0 sm:right-0 left-1/2 sm:left-auto -translate-x-1/2 sm:translate-x-0 mt-2 w-[280px] max-w-[calc(100vw-1rem)] bg-bg-surface border border-border-custom rounded-2xl shadow-2xl z-50 p-1.5 overflow-hidden flex flex-col gap-1"
                          >
                            {/* Delete All Option */}
                            <button
                              onClick={() => {
                                setDeleteStep("confirm-all");
                                setIsDeleteModalOpen(true);
                                setIsDeleteDropdownOpen(false);
                              }}
                              className="w-full text-left p-3 rounded-xl hover:bg-status-danger/5 border border-transparent hover:border-status-danger/10 transition-all group flex items-start gap-3 cursor-pointer"
                            >
                              <div className="p-1.5 bg-status-danger/10 rounded-lg group-hover:bg-status-danger/20 transition-all shrink-0">
                                <Trash2 className="w-3.5 h-3.5 text-status-danger" />
                              </div>
                              <div>
                                <h4 className="text-xs font-extrabold text-text-primary group-hover:text-status-danger transition-colors">
                                  Delete All Tasks
                                </h4>
                                <p className="text-[10px] text-text-muted mt-0.5 leading-relaxed">
                                  Permanently remove every task.
                                </p>
                              </div>
                            </button>

                            {/* Delete Completed Option */}
                            <div className="relative group/tooltip">
                              <button
                                disabled={
                                  !tasks.some((t) => t.status === "completed")
                                }
                                onClick={() => {
                                  setDeleteStep("confirm-completed");
                                  setIsDeleteModalOpen(true);
                                  setIsDeleteDropdownOpen(false);
                                }}
                                className={`w-full text-left p-3 rounded-xl border border-transparent transition-all flex items-start gap-3 ${
                                  tasks.some((t) => t.status === "completed")
                                    ? "hover:bg-status-danger/5 hover:border-status-danger/10 cursor-pointer group"
                                    : "opacity-45 cursor-not-allowed"
                                }`}
                              >
                                <div
                                  className={`p-1.5 rounded-lg shrink-0 ${
                                    tasks.some((t) => t.status === "completed")
                                      ? "bg-status-danger/10 group-hover:bg-status-danger/20"
                                      : "bg-text-secondary/10"
                                  }`}
                                >
                                  <CheckSquare className="w-3.5 h-3.5 text-status-danger" />
                                </div>
                                <div>
                                  <h4
                                    className={`text-xs font-extrabold ${
                                      tasks.some(
                                        (t) => t.status === "completed",
                                      )
                                        ? "text-text-primary group-hover:text-status-danger transition-colors"
                                        : "text-text-secondary/60"
                                    }`}
                                  >
                                    Delete Completed Tasks
                                  </h4>
                                  <p className="text-[10px] text-text-muted mt-0.5 leading-relaxed">
                                    Remove only completed tasks.
                                  </p>
                                </div>
                              </button>
                              {!tasks.some((t) => t.status === "completed") && (
                                <div className="absolute right-2 sm:right-0 bottom-full mb-2 w-max max-w-[240px] bg-bg-surface border border-border-custom px-3 py-1.5 rounded-xl shadow-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-50 text-center text-[10px] font-bold text-text-primary pointer-events-none">
                                  There are no completed tasks to delete.
                                </div>
                              )}
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>

                  <button
                    onClick={() => {
                      setEditTask(null);
                      setIsFormOpen(true);
                    }}
                    className="px-4 py-2 bg-accent-primary hover:bg-accent-primary/95 text-white text-xs font-extrabold tracking-wider uppercase rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-accent-primary/10 transition-all cursor-pointer h-10 shrink-0"
                  >
                    <Plus className="w-4 h-4" /> Add Objective
                  </button>
                </div>
              </div>

              {/* Filters Bar */}
              <div className="flex flex-col lg:flex-row gap-3 bg-bg-surface p-3 rounded-2xl border border-border-custom shadow-sm text-xs w-full">
                {/* Search Input - grows dynamically on desktop */}
                <div className="relative flex-1 min-w-[200px] w-full">
                  <input
                    type="text"
                    placeholder="Search objectives..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full h-10 bg-bg-primary border ${searchQuery ? "border-accent-primary" : "border-border-custom"} hover:border-accent-primary/30 focus:border-accent-primary focus:ring-1 focus:ring-accent-primary rounded-xl px-3.5 py-2 outline-none transition-all placeholder:text-text-muted font-bold text-text-primary text-xs`}
                  />
                </div>

                {/* Filters Controls Group */}
                <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full lg:w-auto justify-start">
                  {/* Priority Filter */}
                  <div className="flex items-center gap-1.5 flex-1 sm:flex-initial min-w-[110px] sm:min-w-0">
                    <span className="text-[10px] font-black text-text-muted uppercase tracking-wider shrink-0 hidden sm:inline">
                      Priority:
                    </span>
                    <select
                      value={priorityFilter}
                      onChange={(e: any) => setPriorityFilter(e.target.value)}
                      className={`w-full sm:w-auto h-10 bg-bg-primary border ${priorityFilter !== "all" ? "border-accent-primary" : "border-border-custom"} hover:border-accent-primary/30 focus:border-accent-primary focus:ring-1 focus:ring-accent-primary rounded-xl px-2.5 py-2 outline-none font-bold text-text-primary transition-all cursor-pointer text-xs`}
                    >
                      <option value="all">All Priorities</option>
                      <option value="urgent">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>

                  {/* Status Filter */}
                  <div className="flex items-center gap-1.5 flex-1 sm:flex-initial min-w-[110px] sm:min-w-0">
                    <span className="text-[10px] font-black text-text-muted uppercase tracking-wider shrink-0 hidden sm:inline">
                      Status:
                    </span>
                    <select
                      value={statusFilter}
                      onChange={(e: any) => setStatusFilter(e.target.value)}
                      className={`w-full sm:w-auto h-10 bg-bg-primary border ${statusFilter !== "all" ? "border-accent-primary" : "border-border-custom"} hover:border-accent-primary/30 focus:border-accent-primary focus:ring-1 focus:ring-accent-primary rounded-xl px-2.5 py-2 outline-none font-bold text-text-primary transition-all cursor-pointer text-xs`}
                    >
                      <option value="all">All Statuses</option>
                      <option value="pending">Pending</option>
                      <option value="completed">Done</option>
                      <option value="overdue">Overdue</option>
                    </select>
                  </div>

                  {/* Category Filter */}
                  <div className="flex items-center gap-1.5 flex-1 sm:flex-initial min-w-[110px] sm:min-w-0">
                    <span className="text-[10px] font-black text-text-muted uppercase tracking-wider shrink-0 hidden sm:inline">
                      Category:
                    </span>
                    <select
                      value={categoryFilter}
                      onChange={(e: any) => setCategoryFilter(e.target.value)}
                      className={`w-full sm:w-auto h-10 bg-bg-primary border ${categoryFilter !== "all" ? "border-accent-primary" : "border-border-custom"} hover:border-accent-primary/30 focus:border-accent-primary focus:ring-1 focus:ring-accent-primary rounded-xl px-2.5 py-2 outline-none font-bold text-text-primary transition-all cursor-pointer text-xs`}
                    >
                      <option value="all">All Categories</option>
                      {allAvailableCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Sort Filter */}
                  <div className="flex items-center gap-1.5 flex-1 sm:flex-initial min-w-[110px] sm:min-w-0">
                    <span className="text-[10px] font-black text-text-muted uppercase tracking-wider shrink-0 hidden sm:inline">
                      Sort By:
                    </span>
                    <select
                      value={sortBy}
                      onChange={(e: any) => setSortBy(e.target.value)}
                      className={`w-full sm:w-auto h-10 bg-bg-primary border ${sortBy !== "default" ? "border-accent-primary" : "border-border-custom"} hover:border-accent-primary/30 focus:border-accent-primary focus:ring-1 focus:ring-accent-primary rounded-xl px-2.5 py-2 outline-none font-bold text-text-primary transition-all cursor-pointer text-xs`}
                    >
                      <option value="default">Default Order</option>
                      <option value="deadline">Nearest Deadline</option>
                    </select>
                  </div>

                  {/* Permanent Clear All Filters Button */}
                  <button
                    onClick={() => {
                      setStatusFilter("all");
                      setPriorityFilter("all");
                      setCategoryFilter("all");
                      setSearchQuery("");
                      setSortBy("default");
                    }}
                    disabled={!isAnyFilterActive}
                    className={`flex-1 sm:flex-initial h-10 px-3 font-bold text-[11px] rounded-xl transition-all flex items-center justify-center gap-1.5 border shrink-0 ${
                      isAnyFilterActive
                        ? "bg-transparent hover:bg-bg-primary text-text-secondary hover:text-text-primary border-border-custom hover:border-text-muted/40 cursor-pointer"
                        : "bg-transparent text-text-muted/40 border-border-custom/40 cursor-not-allowed opacity-40"
                    }`}
                  >
                    <X className="w-3.5 h-3.5 shrink-0" />
                    <span className="uppercase tracking-wider font-black">
                      Clear Filters
                    </span>
                  </button>
                </div>
              </div>

              {/* Active Filter Info Banner */}
              {(statusFilter !== "all" ||
                priorityFilter !== "all" ||
                categoryFilter !== "all" ||
                sortBy !== "default") && (
                <div className="flex items-center justify-between bg-accent-primary/5 border border-accent-primary/15 rounded-xl px-4 py-3 text-xs">
                  <div className="flex items-center gap-2 text-text-secondary">
                    <Sparkles className="w-4 h-4 text-accent-primary animate-pulse" />
                    <span className="font-bold">
                      {statusFilter === "completed" &&
                        "Showing Completed Tasks"}
                      {statusFilter === "pending" &&
                        sortBy !== "deadline" &&
                        "Showing Pending Tasks"}
                      {statusFilter === "overdue" && "Showing Overdue Tasks"}
                      {sortBy === "deadline" && "Sorted by Upcoming Deadlines"}
                      {statusFilter === "all" &&
                      priorityFilter === "all" &&
                      categoryFilter === "all" &&
                      sortBy === "default"
                        ? ""
                        : " "}
                      {priorityFilter !== "all" &&
                        ` [Priority: ${priorityFilter.toUpperCase()}]`}
                      {categoryFilter !== "all" &&
                        ` [Category: ${categoryFilter}]`}
                    </span>
                  </div>
                </div>
              )}

              {/* Cards Grid */}
              <motion.div
                animate={
                  highlightTasks
                    ? { boxShadow: "0 0 24px 4px rgba(99, 102, 241, 0.2)" }
                    : {}
                }
                transition={{ duration: 0.3 }}
                className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 rounded-[28px] p-1.5 transition-all ${highlightTasks ? "ring-2 ring-accent-primary/40 bg-accent-primary/5" : ""}`}
              >
                {sortedTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isSelected={selectedTask?.id === task.id}
                    onSelect={() => handleSelectTask(task)}
                  />
                ))}
                {sortedTasks.length === 0 && (
                  <div className="col-span-full text-center py-16 bg-bg-surface rounded-2xl border border-dashed border-border-custom text-text-muted text-xs">
                    <Compass className="w-10 h-10 mx-auto text-accent-primary/20 mb-3 animate-pulse" />
                    {searchQuery ? (
                      <div className="space-y-3">
                        <p className="font-bold text-text-secondary">
                          No tasks match your search.
                        </p>
                        <button
                          onClick={() => setSearchQuery("")}
                          className="px-4 py-2 bg-accent-primary/15 hover:bg-accent-primary text-accent-primary hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer border border-accent-primary/25"
                        >
                          Clear Search
                        </button>
                      </div>
                    ) : categoryFilter !== "all" ? (
                      <div className="space-y-3">
                        <p className="font-bold text-text-secondary">
                          No tasks found in this category.
                        </p>
                        <button
                          onClick={() => setCategoryFilter("all")}
                          className="px-4 py-2 bg-accent-primary/15 hover:bg-accent-primary text-accent-primary hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer border border-accent-primary/25"
                        >
                          Clear Category Filter
                        </button>
                      </div>
                    ) : (
                      <p>
                        No matching objectives found. Modify filters or add a
                        new objective.
                      </p>
                    )}
                  </div>
                )}
              </motion.div>
            </div>

            {/* ==================================================
            4. FOURTH SECTION: Task Details + AI Insights
            ================================================== */}
            {tasks.length > 0 && (
              <motion.div
                ref={detailsPanelRef}
                animate={
                  highlightSelectedTask
                    ? {
                        scale: [1, 1.015, 1],
                        boxShadow: "0 0 24px 6px rgba(99, 102, 241, 0.3)",
                      }
                    : {}
                }
                transition={{ duration: 0.8, ease: "easeInOut" }}
                className={`rounded-[28px] transition-all duration-300 ${highlightSelectedTask ? "ring-2 ring-accent-primary/50 bg-accent-primary/5 shadow-2xl" : ""}`}
              >
                <TaskInsightsWorkspace
                  selectedTask={selectedTask}
                  tasks={tasks}
                  onToggleComplete={handleTaskComplete}
                  onEditClick={(task) => {
                    setEditTask(task);
                    setIsFormOpen(true);
                  }}
                  onDeleteClick={setTaskToDelete}
                  onRefreshAI={handleRefreshAI}
                  refreshingTaskId={refreshingTaskId}
                  onToggleSubtask={handleToggleSubtask}
                  onGenerateBreakdown={handleGenerateBreakdownLater}
                  breakdownLoading={breakdownLoading === selectedTask?.id}
                />
              </motion.div>
            )}

            {/* ==================================================
            6. SIXTH SECTION: Google Sheets Synchronization
            ================================================== */}
            {!localMode && user && (
              <div className="md:hidden">
                <SheetsSyncPanel
                  accessToken={accessToken}
                  tasks={tasks}
                  syncConfig={userProfile?.sheetsSyncConfig || null}
                  onUpdateSyncConfig={handleUpdateSyncConfig}
                  onForceSync={async () => {}}
                />
              </div>
            )}
          </main>

          {/* Custom Deletion Confirmation Modal */}
          <AnimatePresence>
            {taskToDelete && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-text-primary/40 backdrop-blur-xs p-4"
              >
                <motion.div
                  initial={{ scale: 0.95, y: 15 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.95, y: 15 }}
                  className="bg-bg-surface rounded-3xl border border-border-custom shadow-2xl p-6 max-w-sm w-full space-y-4"
                >
                  <div className="flex items-center gap-3 text-status-danger">
                    <div className="p-2 bg-status-danger/10 rounded-xl">
                      <Trash2 className="w-5 h-5 text-status-danger" />
                    </div>
                    <h3 className="text-base font-black tracking-tight text-text-primary">
                      Delete Task
                    </h3>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-text-secondary leading-relaxed">
                      Are you sure you want to delete this task? This action
                      cannot be undone.
                    </p>
                    {deleteError && (
                      <div className="p-2.5 bg-status-danger/10 text-status-danger text-[11px] rounded-xl border border-status-danger/20 flex items-start gap-1.5 font-medium leading-normal">
                        <span className="font-bold">Error:</span>
                        <span>{deleteError}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 pt-2">
                    <button
                      onClick={() => {
                        setTaskToDelete(null);
                        setDeleteError(null);
                      }}
                      className="flex-1 px-4 py-2.5 bg-bg-hover hover:bg-border-custom text-text-secondary text-xs font-bold rounded-2xl transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (taskToDelete) {
                          executeTaskDelete(taskToDelete);
                        }
                      }}
                      className="flex-1 px-4 py-2.5 bg-status-danger hover:bg-status-danger/90 text-white text-xs font-bold rounded-2xl transition-colors cursor-pointer shadow-md shadow-status-danger/10"
                    >
                      Delete
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Task creator / editor modal */}
          <TaskFormModal
            isOpen={isFormOpen}
            onClose={() => {
              setIsFormOpen(false);
              setEditTask(null);
            }}
            onSubmit={handleTaskSubmit}
            editTask={editTask}
            userCategories={userProfile?.categories || []}
          />

          {/* Timeline Modal */}
          <TimelineModal
            isOpen={isTimelineOpen}
            onClose={() => setIsTimelineOpen(false)}
            tasks={tasks}
            onSelectTask={handleSelectTaskFromTimeline}
          />

          {/* Task Completion Celebration Overlay */}
          <AnimatePresence>
            {completedTaskCelebration && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md p-6"
              >
                {/* Ambient sparks */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  {[...Array(20)].map((_, i) => {
                    const angle = (i / 20) * 2 * Math.PI;
                    const distance = Math.random() * 200 + 100;
                    return (
                      <motion.div
                        key={i}
                        initial={{
                          x: "50vw",
                          y: "50vh",
                          scale: Math.random() * 0.5 + 0.5,
                          opacity: 1,
                        }}
                        animate={{
                          x: `calc(50vw + ${Math.cos(angle) * distance}px)`,
                          y: `calc(50vh + ${Math.sin(angle) * distance}px)`,
                          opacity: 0,
                        }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        className="absolute w-2 h-2 rounded-full bg-accent-primary"
                      />
                    );
                  })}
                </div>

                <motion.div
                  initial={{ scale: 0.8, y: 50 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.8, y: 50 }}
                  transition={{ type: "spring", damping: 15 }}
                  className="bg-bg-surface border border-border-custom rounded-[32px] p-8 max-w-md w-full text-center space-y-6 shadow-2xl relative"
                >
                  <div className="mx-auto w-16 h-16 bg-status-success/15 border border-status-success/20 rounded-2xl flex items-center justify-center text-status-success">
                    <CheckCircle className="w-8 h-8 text-status-success animate-bounce" />
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-status-success uppercase tracking-[0.2em] block">
                      Sprint Accomplished!
                    </span>
                    <h3 className="text-xl font-black text-text-primary tracking-tight leading-tight">
                      {completedTaskCelebration}
                    </h3>
                    <p className="text-xs text-text-secondary leading-relaxed max-w-xs mx-auto">
                      Outstanding job! You've successfully conquered this task
                      before the deadline. Your productivity score just got
                      updated.
                    </p>
                  </div>

                  {/* Score Display */}
                  {userProfile && (
                    <div className="p-4 bg-bg-primary rounded-2xl border border-border-custom flex items-center justify-between">
                      <span className="text-[10px] font-black text-text-muted uppercase tracking-wider">
                        Productivity Level
                      </span>
                      <div className="flex items-center gap-1.5 text-accent-primary font-black text-sm">
                        <span>+15 Points</span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => setCompletedTaskCelebration(null)}
                    className="w-full py-3 bg-accent-primary hover:bg-accent-primary/90 text-white text-xs font-bold rounded-2xl transition-all cursor-pointer shadow-md shadow-accent-primary/10"
                  >
                    Keep Sprinting
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Floating Toast Notification Container */}
          <AnimatePresence>
            {toast && (
              <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border backdrop-blur-md"
                style={{
                  backgroundColor:
                    toast.type === "success"
                      ? "rgba(16, 185, 129, 0.95)"
                      : "rgba(239, 68, 68, 0.95)",
                  borderColor:
                    toast.type === "success"
                      ? "rgba(52, 211, 153, 0.4)"
                      : "rgba(248, 113, 113, 0.4)",
                  color: "#ffffff",
                }}
              >
                {toast.type === "success" ? (
                  <CheckCircle className="w-5 h-5 shrink-0 text-white" />
                ) : (
                  <AlertTriangle className="w-5 h-5 shrink-0 text-white animate-bounce" />
                )}
                <span className="text-xs sm:text-sm font-semibold">
                  {toast.message}
                </span>
                <button
                  onClick={() => setToast(null)}
                  className="ml-2 hover:opacity-80 p-0.5 rounded-full transition-opacity cursor-pointer text-white"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <footer className="bg-bg-surface border-t border-border-custom py-6 text-center text-[11px] text-text-muted mt-12">
            <p>
              &copy; {new Date().getFullYear()} Now or Never. An intelligent
              full-stack productivity framework.
            </p>
          </footer>
        </div>
      )}
      </div>
    </>
  );
}
