import express, { json } from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(json());
app.use(express.urlencoded({ extended: true }));

// Initialize Gemini client on the server side
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Helper for calling Gemini and handling errors gracefully with detailed logging and automatic retry/fallback
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function callGeminiJSON(prompt: string, systemInstruction?: string) {
  console.log(`[Gemini API] Request prompt length: ${prompt.length} chars. System instruction: "${systemInstruction || "None"}"`);
  
  const models = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];
  let lastError: any = null;

  for (const model of models) {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`[Gemini API] Attempt ${attempt}/${maxAttempts} using model: ${model}`);
        const response = await ai.models.generateContent({
          model: model,
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            temperature: 0.2,
          },
        });

        if (!response.text) {
          console.error(`[Gemini API] Error: No text returned from model ${model}`);
          throw new Error(`No text returned from Gemini API with model ${model}`);
        }

        const safeJSONParse = (text: string) => {
          try {
            return JSON.parse(text);
          } catch {
            const cleaned = text
              .replace(/```json/g, "")
              .replace(/```/g, "")
              .trim();
            return JSON.parse(cleaned);
          }
        };

        const parsedResult = safeJSONParse(response.text);
        console.log(`[Gemini API] Successfully parsed JSON response keys from ${model}:`, Object.keys(parsedResult));
        return parsedResult;
      } catch (error: any) {
        lastError = error;
        const errMessage = error.message || String(error);
        console.warn(`[Gemini API] Attempt ${attempt} failed on model ${model}. Error:`, errMessage);

        // If it's a terminal client error (like BAD_REQUEST or INVALID_ARGUMENT), don't retry, just try next model
        if (error.status === 400 || errMessage.includes("400") || errMessage.includes("INVALID_ARGUMENT")) {
          console.error(`[Gemini API] Non-retryable error on ${model}, moving to next model.`);
          break;
        }

        if (attempt < maxAttempts) {
          const backoffTime = 500 * Math.pow(2, attempt); // 1000ms, 2000ms
          console.log(`[Gemini API] Retrying in ${backoffTime}ms...`);
          await delay(backoffTime);
        }
      }
    }
  }

  console.error("[Gemini API] All models and retries exhausted. Throwing final error.");
  if (lastError && lastError.message && (lastError.message.toLowerCase().includes("quota") || lastError.message.toLowerCase().includes("exhausted") || lastError.message.toLowerCase().includes("429"))) {
    throw new Error("Gemini API Daily Quota Exceeded (Free limit is 20 requests/day per model). Please wait, retry in a moment, or configure billing / alternative plan.");
  }
  throw lastError || new Error("Gemini API call failed");
}

// ==========================================
// SMART LOCAL ASSISTANT FALLBACK GENERATORS
// ==========================================

function generateLocalBreakdown(title: string, effortHoursInput?: number) {
  const titleLower = title.toLowerCase();
  const effortHours = effortHoursInput || 4;
  const stepTime = Math.max(1, Math.round(effortHours / 4));
  let subtasks = [];

  if (titleLower.includes("deploy") || titleLower.includes("website") || titleLower.includes("web") || titleLower.includes("app")) {
    subtasks = [
      { id: "sub-1", title: "Review codebase and resolve active lint warnings", status: "pending", estimatedHours: stepTime },
      { id: "sub-2", title: "Test production build locally and verify static routes", status: "pending", estimatedHours: stepTime },
      { id: "sub-3", title: "Configure production deployment pipelines and environment variables", status: "pending", estimatedHours: stepTime },
      { id: "sub-4", title: "Launch live deployment and run quick smoke tests", status: "pending", estimatedHours: Math.max(1, effortHours - stepTime * 3) }
    ];
  } else if (titleLower.includes("write") || titleLower.includes("draft") || titleLower.includes("report") || titleLower.includes("document") || titleLower.includes("essay")) {
    subtasks = [
      { id: "sub-1", title: "Research specifications and outline core sections", status: "pending", estimatedHours: stepTime },
      { id: "sub-2", title: "Draft executive summaries and background context", status: "pending", estimatedHours: stepTime },
      { id: "sub-3", title: "Compile data analysis tables and write main body", status: "pending", estimatedHours: stepTime },
      { id: "sub-4", title: "Proofread drafts and coordinate final formatting", status: "pending", estimatedHours: Math.max(1, effortHours - stepTime * 3) }
    ];
  } else if (titleLower.includes("study") || titleLower.includes("learn") || titleLower.includes("exam") || titleLower.includes("course") || titleLower.includes("test")) {
    subtasks = [
      { id: "sub-1", title: "Review central syllabus and high-priority slides", status: "pending", estimatedHours: stepTime },
      { id: "sub-2", title: "Synthesize critical formulas, facts, and write study brief", status: "pending", estimatedHours: stepTime },
      { id: "sub-3", title: "Complete realistic sample problems and review incorrect answers", status: "pending", estimatedHours: stepTime },
      { id: "sub-4", title: "Run final rapid flashcard review of core definitions", status: "pending", estimatedHours: Math.max(1, effortHours - stepTime * 3) }
    ];
  } else {
    subtasks = [
      { id: "sub-1", title: "Define core scope and draft execution steps", status: "pending", estimatedHours: stepTime },
      { id: "sub-2", title: "Gather required information and baseline assets", status: "pending", estimatedHours: stepTime },
      { id: "sub-3", title: "Execute principal elements and test deliverables", status: "pending", estimatedHours: stepTime },
      { id: "sub-4", title: "Audit results against requirements and finalize work", status: "pending", estimatedHours: Math.max(1, effortHours - stepTime * 3) }
    ];
  }

  return {
    subtasks,
    effortHours,
    executionStrategy: `Establish a solid focus block. Break down "${title}" into structured sprints, and handle task objectives sequentially to guarantee high-quality completion.`,
    isFallback: true
  };
}

function generateLocalClassifyAndSummarize(title: string, description?: string) {
  const titleLower = title.toLowerCase();
  let aiPriority = "moderate";
  
  if (titleLower.includes("urgent") || titleLower.includes("asap") || titleLower.includes("critical") || titleLower.includes("important") || titleLower.includes("deploy") || titleLower.includes("pitch")) {
    aiPriority = "high";
  } else if (titleLower.includes("review") || titleLower.includes("clean") || titleLower.includes("archive") || titleLower.includes("read")) {
    aiPriority = "low";
  }

  return {
    aiSummary: description ? `Objective: ${description.slice(0, 100)}${description.length > 100 ? "..." : ""}` : `Objective: Complete execution of "${title}"`,
    aiPriority,
    isFallback: true
  };
}

function generateLocalRankPriority(tasks: any[]) {
  const sorted = [...tasks].sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === "pending" ? -1 : 1;
    }

    const now = Date.now();
    const timeA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
    const timeB = b.deadline ? new Date(b.deadline).getTime() : Infinity;

    const overA = timeA < now;
    const overB = timeB < now;

    if (overA !== overB) {
      return overA ? -1 : 1;
    }

    if (timeA !== timeB) {
      return timeA < timeB ? -1 : 1;
    }

    const pA = a.priority === "urgent" || a.priority === "high" ? 3 : (a.priority === "medium" || a.priority === "moderate" ? 2 : 1);
    const pB = b.priority === "urgent" || b.priority === "high" ? 3 : (b.priority === "medium" || b.priority === "moderate" ? 2 : 1);

    if (pA !== pB) {
      return pB - pA;
    }

    return (b.effortHours || 0) - (a.effortHours || 0);
  });

  const rankedTaskIds = sorted.map(t => t.id);
  const explanations: Record<string, string> = {};

  sorted.forEach((t) => {
    if (t.status === "completed") {
      explanations[t.id] = "• Task is fully completed and archived.";
      return;
    }

    const now = Date.now();
    const deadlineTime = t.deadline ? new Date(t.deadline).getTime() : null;
    const diffMs = deadlineTime ? deadlineTime - now : null;

    if (diffMs !== null && diffMs < 0) {
      explanations[t.id] = `• Critical Overdue: This task was due ${Math.abs(Math.round(diffMs / 3600000))} hours ago. Immediate focus recommended.`;
    } else if (diffMs !== null && diffMs < 24 * 3600000) {
      explanations[t.id] = `• High Urgency: Due in ${(diffMs / 3600000).toFixed(1)} hours. Estimated effort is ${t.effortHours || 1} hours.`;
    } else if (t.priority === "high" || t.priority === "urgent") {
      explanations[t.id] = `• High Priority: User-defined critical task with ample timeline. Best to tackle early.`;
    } else {
      explanations[t.id] = `• Moderate Priority: Maintain progress on subtasks to avoid last-minute rush.`;
    }
  });

  return {
    rankedTaskIds,
    explanations,
    isFallback: true
  };
}

function generateLocalRiskAnalysis(task: any, currentTimeInput?: string) {
  const now = currentTimeInput ? new Date(currentTimeInput).getTime() : Date.now();
  
  if (task.status === "completed") {
    return {
      riskLevel: "low",
      probability: 0,
      reasoning: "This task has already been completed. Risk is zero.",
      isFallback: true
    };
  }

  const deadlineTime = task.deadline ? new Date(task.deadline).getTime() : null;
  if (!deadlineTime) {
    return {
      riskLevel: "low",
      probability: 10,
      reasoning: "No deadline specified. Maintain steady progress.",
      isFallback: true
    };
  }

  const diffMs = deadlineTime - now;
  const hoursLeft = diffMs / (3600 * 1000);
  const effortHours = task.effortHours || 1;

  if (diffMs < 0) {
    return {
      riskLevel: "high",
      probability: 100,
      reasoning: `This task is overdue by ${Math.abs(hoursLeft).toFixed(1)} hours. Completion is at critical failure risk.`,
      isFallback: true
    };
  }

  const subtasks = task.subtasks || [];
  const completedSubtasks = subtasks.filter((s: any) => s.status === "completed").length;
  const totalSubtasks = subtasks.length;
  const progressRatio = totalSubtasks > 0 ? completedSubtasks / totalSubtasks : 0;
  const remainingEffort = effortHours * (1 - progressRatio);

  if (hoursLeft < remainingEffort * 1.5) {
    return {
      riskLevel: "high",
      probability: 90,
      reasoning: `Extremely critical: Only ${hoursLeft.toFixed(1)} hours remaining for an estimated ${remainingEffort.toFixed(1)} hours of pending effort.`,
      isFallback: true
    };
  }

  if (hoursLeft < remainingEffort * 3 || task.priority === "high" || task.priority === "urgent") {
    return {
      riskLevel: "medium",
      probability: 50,
      reasoning: `Moderate risk: ${hoursLeft.toFixed(1)} hours left. Pending effort is ${remainingEffort.toFixed(1)} hours. Tighten focus.`,
      isFallback: true
    };
  }

  return {
    riskLevel: "low",
    probability: 20,
    reasoning: `Low risk: Comfortable buffer of ${hoursLeft.toFixed(1)} hours left vs ${remainingEffort.toFixed(1)} hours estimated effort.`,
    isFallback: true
  };
}

function generateLocalTaskAdvice(task: any, currentTimeInput?: string) {
  const now = currentTimeInput ? new Date(currentTimeInput).getTime() : Date.now();
  
  let summary = `Objective: Execute and finalize the task "${task.title}".`;
  if (task.description) {
    summary = `Objective: ${task.description.length > 80 ? task.description.slice(0, 80) + "..." : task.description}`;
  }

  if (task.status === "completed") {
    return {
      summary,
      priorityExplanation: "• Complete: This track is finished successfully and archived.",
      riskExplanation: "• Closed Risk: Risk levels are zero as the deliverable is published.",
      nextAction: "• Great job! Maintain this high-momentum rhythm on other pending tasks.",
      isFallback: true
    };
  }

  const deadlineTime = task.deadline ? new Date(task.deadline).getTime() : null;
  const effortHours = task.effortHours || 1;

  if (!deadlineTime) {
    return {
      summary,
      priorityExplanation: "• Moderate Priority: No hard schedule constraints set. Keep progress steady.",
      riskExplanation: "• Stable Track: Risk is currently Low. Proceed at your own pace.",
      nextAction: "• Define a draft subtask outline and complete the first setup block.",
      isFallback: true
    };
  }

  const diffMs = deadlineTime - now;
  const hoursLeft = diffMs / (3600 * 1000);
  const deadlineStr = new Date(deadlineTime).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  if (diffMs < 0) {
    return {
      summary,
      priorityExplanation: `• Critical Priority: Overdue. The deadline passed on ${deadlineStr}.`,
      riskExplanation: `• Overdue Alert: High Risk. Task was due ${Math.abs(hoursLeft).toFixed(1)} hours ago.`,
      nextAction: "• EMERGENCY ACTION: Cut decorative fluff, write conclusions directly, and submit what you have now.",
      isFallback: true
    };
  }

  if (hoursLeft < effortHours * 1.5) {
    return {
      summary,
      priorityExplanation: `• Urgent Priority: High urgency with only ${hoursLeft.toFixed(1)} hours remaining for a ${effortHours}-hour task.`,
      riskExplanation: `• High Risk: Low time buffer. Missing the deadline is highly probable without swift execution.`,
      nextAction: "• Switch to rapid focus blocks. Mute Slack/Teams, set a 45-minute sprint timer, and begin immediately.",
      isFallback: true
    };
  }

  if (hoursLeft < effortHours * 3 || task.priority === "high" || task.priority === "urgent") {
    return {
      summary,
      priorityExplanation: `• High Priority: Action required soon. The scheduled deadline is approaching on ${deadlineStr}.`,
      riskExplanation: `• Medium Risk: Moderate schedule buffer. Maintain current velocity to avoid last-minute rushing.`,
      nextAction: "• Block out a dedicated 90-minute slot today to complete the heaviest 2 pending subtasks.",
      isFallback: true
    };
  }

  return {
    summary,
    priorityExplanation: `• Normal Priority: Comfortable buffer with ${hoursLeft.toFixed(0)} hours left before the deadline.`,
    riskExplanation: `• Low Risk: Adequate timeline. You have plenty of leeway to plan and draft carefully.`,
    nextAction: "• Draft a light 3-point outline and spend 10 minutes researching initial assets.",
    isFallback: true
  };
}

function generateLocalRescuePlan(task: any, currentTimeInput?: string) {
  const now = currentTimeInput ? new Date(currentTimeInput).getTime() : Date.now();
  const deadlineTime = task.deadline ? new Date(task.deadline).getTime() : null;
  const hoursLeft = deadlineTime ? (deadlineTime - now) / 3600000 : 24;

  let emergencyPlan = `RAPID FOCUS SPRINT: We are entering high-momentum execution mode. Silence all notifications, commit to single-task focus, and complete "${task.title}" using immediate 25-minute Pomodoros.`;
  let timeBlockedSchedule = [
    { timeSlot: "Next 15 minutes", action: "Setup & Clarity: Close all unrelated browser tabs, silence your phone, and list the exact next sentence or lines you need to write." },
    { timeSlot: "Sprint 1 (45 mins)", action: `Uninterrupted Flow: Draft the core outline of "${task.title}" without self-censoring or editing. Get words on the page.` },
    { timeSlot: "Break (10 mins)", action: "Strategic Recovery: Stand up, stretch, grab water, and rest your eyes. Do not check social media." },
    { timeSlot: "Sprint 2 (45 mins)", action: "Refining & Execution: Finalize remaining sections and review the work against requirements." }
  ];

  if (deadlineTime && hoursLeft < 0) {
    emergencyPlan = `EMERGENCY RECOVERY SPRINT: This task is overdue. We must bypass standard drafting workflows. Cut non-essential details, write raw results directly, and compile a minimum viable draft immediately.`;
    timeBlockedSchedule = [
      { timeSlot: "Next 15 minutes", action: "Triage: Open your existing work, identify the absolute minimum requirements needed to submit, and delete decorative elements." },
      { timeSlot: "Action Sprint (45 mins)", action: "Raw Completion: Write scientific or professional conclusions directly from crude notes. Do not worry about perfection." },
      { timeSlot: "Final Polish (15 mins)", action: "Rapid Proofreading: Check for spelling errors, format neatly, and hit submit immediately." }
    ];
  } else if (task.effortHours > 6) {
    emergencyPlan = `LARGE TASK SCAFFOLDING: With an estimated ${task.effortHours} effort hours, trying to do everything at once will cause analysis paralysis. Build a lightweight skeleton framework first, then flesh out each section iteratively.`;
    timeBlockedSchedule = [
      { timeSlot: "Next 15 minutes", action: "Skeleton Building: Map out the 4 critical subtasks in a rapid check-list. Dedicate 2 minutes to each." },
      { timeSlot: "Sprint 1 (50 mins)", action: "Heaviest Lift: Start with the most difficult or critical subtask while your energy levels are high." },
      { timeSlot: "Break (10 mins)", action: "Unplug: Breathe deeply, walk around the room, and hydrate." },
      { timeSlot: "Sprint 2 (50 mins)", action: "Secondary Blocks: Tackle the remaining subtasks. Keep sections short and precise." }
    ];
  }

  const immediateActions = [
    "Turn off your phone and mute workspace chat channels (Slack/Teams).",
    "Identify the absolute simplest step (e.g., 'open the file' or 'write 2 lines') and do it right now.",
    "Set a physical timer for exactly 5 minutes and commit to working until it rings."
  ];

  return {
    emergencyPlan,
    timeBlockedSchedule,
    immediateActions,
    isFallback: true
  };
}

function generateLocalCoachPlan(tasks: any[], userProgress?: any, currentTimeInput?: string) {
  const now = currentTimeInput ? new Date(currentTimeInput).getTime() : Date.now();
  const pendingTasks = (tasks || []).filter((t: any) => t.status === "pending");

  // Format helper
  const formatTime = (d: Date) => {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };
  const formatDate = (d: Date) => {
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  // 1. Sort tasks:
  // Sort primarily by deadline ascending. If no deadline, default to 24h from now.
  const sortedPending = [...pendingTasks].sort((a, b) => {
    const timeA = a.deadline ? new Date(a.deadline).getTime() : now + 24 * 3600000;
    const timeB = b.deadline ? new Date(b.deadline).getTime() : now + 24 * 3600000;
    if (timeA !== timeB) return timeA - timeB;
    const priorityWeight = { urgent: 4, high: 3, medium: 2, low: 1 };
    const wA = priorityWeight[a.priority as keyof typeof priorityWeight] || 2;
    const wB = priorityWeight[b.priority as keyof typeof priorityWeight] || 2;
    if (wA !== wB) return wB - wA;
    return (b.effortHours || 0) - (a.effortHours || 0);
  });

  const priorities = sortedPending.slice(0, 3).map((t) => t.title);

  // 2. Intelligent Backward Pass Schedule (ends EXACTLY at deadlines, sequential, non-overlapping)
  const suggestedSchedule: any[] = [];
  if (sortedPending.length > 0) {
    // Sort descending for backward pass
    const backwardTasks = [...sortedPending].sort((a, b) => {
      const timeA = a.deadline ? new Date(a.deadline).getTime() : now + 24 * 3600000;
      const timeB = b.deadline ? new Date(b.deadline).getTime() : now + 24 * 3600000;
      return timeB - timeA;
    });

    const blocks: { task: any; startTime: Date; endTime: Date }[] = [];
    let currentAvailableEnd = new Date(Math.max(...backwardTasks.map(t => t.deadline ? new Date(t.deadline).getTime() : now + 48 * 3600000)));

    backwardTasks.forEach((task) => {
      const taskDeadline = task.deadline ? new Date(task.deadline) : new Date(now + 24 * 3600000);
      const endTime = new Date(Math.min(taskDeadline.getTime(), currentAvailableEnd.getTime()));
      const effortMs = (task.effortHours || 1) * 3600 * 1000;
      const startTime = new Date(endTime.getTime() - effortMs);
      
      blocks.push({ task, startTime, endTime });
      currentAvailableEnd = startTime;
    });

    // Chronological sort
    blocks.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    blocks.forEach((block) => {
      const startStr = formatTime(block.startTime);
      const endStr = formatTime(block.endTime);
      const isToday = block.startTime.toDateString() === new Date(now).toDateString();
      const timeLabel = isToday ? `${startStr} - ${endStr}` : `${formatDate(block.startTime)} ${startStr} - ${endStr}`;
      
      const hours = Math.floor(block.task.effortHours || 1);
      const mins = Math.round(((block.task.effortHours || 1) - hours) * 60);
      const durationStr = hours > 0 && mins > 0 ? `${hours}h ${mins}m` : hours > 0 ? `${hours}h` : `${mins}m`;

      suggestedSchedule.push({
        time: timeLabel,
        taskTitle: block.task.title,
        action: `• Sequentially scheduled backwards from deadline. Duration: ${durationStr}. Priority: ${block.task.priority.toUpperCase()}. Plan focus blocks to submit before deadline.`
      });
    });
  } else {
    // Empty state
    suggestedSchedule.push(
      {
        time: "Morning (09:00 AM - 10:00 AM)",
        taskTitle: "Workspace Setup",
        action: "• Organize active goals and define 2 new milestones with clear deadlines."
      },
      {
        time: "Afternoon (01:00 PM - 03:00 PM)",
        taskTitle: "Efficiency Sprint",
        action: "• Clear administrative tasks and configure folder structures to streamline future work."
      }
    );
  }

  // Highlights for Coach advice
  const overdueCount = sortedPending.filter((t) => t.deadline && new Date(t.deadline).getTime() < now).length;
  const todayFocus = sortedPending.length > 0 ? sortedPending[0] : null;
  const highPriority = sortedPending.find((t) => t.priority === "urgent" || t.priority === "high") || (sortedPending.length > 1 ? sortedPending[1] : null);

  let riskAlert = "No immediate high-risk tracks. Maintain steady execution block progress.";
  const highRiskTask = sortedPending.find((t) => {
    if (!t.deadline) return false;
    const diff = new Date(t.deadline).getTime() - now;
    return diff > 0 && diff < 12 * 3600000;
  });
  if (overdueCount > 0) {
    riskAlert = `You have ${overdueCount} overdue task(s) requiring immediate rescue.`;
  } else if (highRiskTask) {
    riskAlert = `"${highRiskTask.title}" has become high risk since only a short timeline remains.`;
  }

  const recommendedNext = todayFocus ? `Start working on "${todayFocus.title}" right now to stay on schedule.` : "Add a high-leverage task to launch your day.";

  const dailyCoachMessage = `Today's Focus
• ${todayFocus ? `${todayFocus.title} (Duration: ${todayFocus.effortHours ? (todayFocus.effortHours >= 1 ? `${Math.floor(todayFocus.effortHours)}h` : `${Math.round(todayFocus.effortHours * 60)}m`) : "1h"})` : "Add a task to launch your productivity queue."}

High Priority
• ${highPriority ? `${highPriority.title} (Priority: ${highPriority.priority.toUpperCase()})` : "Workspace setup and organization"}

Risk Alert
• ${riskAlert}

Recommended Next Step
• ${recommendedNext}`;

  return {
    dailyCoachMessage,
    priorities: priorities.length > 0 ? priorities : ["Define Your Goals", "Workspace Setup"],
    suggestedSchedule,
    isFallback: true
  };
}

function generateLocalAnalyzeTask(taskData: any, currentTimeInput?: string) {
  const { title, description, deadline, priority, effortHours, subtasks } = taskData;
  const cs = generateLocalClassifyAndSummarize(title, description);
  const bd = generateLocalBreakdown(title, effortHours);
  const risk = generateLocalRiskAnalysis(taskData, currentTimeInput);
  const advice = generateLocalTaskAdvice(taskData, currentTimeInput);
  const rescue = generateLocalRescuePlan(taskData, currentTimeInput);

  return {
    aiSummary: cs.aiSummary,
    aiPriority: cs.aiPriority as "low" | "moderate" | "high",
    priorityExplanation: advice.priorityExplanation,
    riskAnalysis: {
      riskLevel: risk.riskLevel as "low" | "medium" | "high",
      probability: risk.probability,
      reasoning: risk.reasoning
    },
    rescuePlan: {
      emergencyPlan: rescue.emergencyPlan,
      timeBlockedSchedule: rescue.timeBlockedSchedule,
      immediateActions: rescue.immediateActions,
      suggestedShortBreaks: "Take a strategic 5-minute break: stand up, stretch your body, and take a few deep breaths to restore blood flow.",
      estimatedFinishTime: `${effortHours || 1} hours of active, focused work is estimated to complete this track completely.`
    },
    subtasks: subtasks && subtasks.length > 0 ? subtasks : bd.subtasks,
    executionStrategy: bd.executionStrategy,
    coachAdvice: {
      summary: advice.summary,
      priorityExplanation: advice.priorityExplanation,
      riskExplanation: advice.riskExplanation,
      nextAction: advice.nextAction
    }
  };
}

// 1. AI Task Breakdown Endpoint
app.post("/api/gemini/breakdown", async (req, res) => {
  const { title, description, deadline, priority } = req.body;

  if (!title) {
    return res.status(400).json({ error: "Title is required" });
  }

  const prompt = `
    Analyze the following task:
    Title: "${title}"
    Description: "${description || "None"}"
    Deadline: "${deadline || "None"}"
    Priority: "${priority || "medium"}"

    Perform the following:
    1. Break it down into a list of 3 to 7 actionable, realistic, highly specific subtasks.
       - CRITICAL: Every subtask title must be deeply specific and inferred directly from the task title ("${title}") and description ("${description || "None"}").
       - Strictly avoid generic placeholders or repetitive steps (like "Research", "Draft", "Review", "Submit", "Proofread", "Double check").
       - Create discrete, concrete milestones showing exactly what needs to be written, coded, styled, or researched.
    2. Estimate effort required for each subtask in hours.
    3. Estimate the total effort in hours for the entire task.
    4. Suggest a highly practical, task-specific execution strategy as a concise, motivating paragraph. Avoid generic motivational templates.

    Return the result strictly in this JSON format:
    {
      "subtasks": [
        { "id": "sub-1", "title": "Subtask Title", "status": "pending", "estimatedHours": 1.5 }
      ],
      "effortHours": 5.5,
      "executionStrategy": "Your strategic advice..."
    }
  `;

  const systemInstruction = "You are Now or Never, an elite productivity coach that hates procrastination. Your breakdowns must be highly actionable, crisp, and realistic.";

  try {
    const result = await callGeminiJSON(prompt, systemInstruction);
    res.json(result);
  } catch (error: any) {
    console.warn("[Gemini API] Quota or execution error. Serving high-quality local breakdown fallback:", error.message);
    const fallback = generateLocalBreakdown(title, req.body.effortHours);
    res.json(fallback);
  }
});

// 1b. AI Task Classification and Summary Endpoint
app.post("/api/gemini/classify-and-summarize", async (req, res) => {
  const { title, description, deadline, priority, effortHours } = req.body;

  if (!title) {
    return res.status(400).json({ error: "Title is required" });
  }

  const prompt = `
    Analyze the following task:
    Title: "${title}"
    Description: "${description || "None"}"
    Deadline: "${deadline || "None"}"
    User-specified Importance: "${priority || "medium"}"
    Estimated Effort: ${effortHours || 1} hours
    Current Time/Date: "${new Date().toISOString()}"

    Perform the following:
    1. Categorize this task into one of these smart priorities: "high", "moderate", or "low".
       Determine this based on:
       - Deadline proximity (closer deadlines = higher priority)
       - Estimated effort (higher effort = higher priority, especially if deadline is near)
       - Task importance / user-specified rank
       - Risk of delay (if there is little buffer time)
    2. Write a short, highly cohesive summary of 1 to 2 lines maximum.
       The summary must explain what the task is about and its primary objective. Do not use technical jargon.

    Return the result strictly in this JSON format:
    {
      "aiPriority": "high" | "moderate" | "low",
      "aiSummary": "Your short 1-2 line summary explaining the task and its primary objective."
    }
  `;

  const systemInstruction = "You are Now or Never's Intelligent Productivity Coach. Your classification and summaries must be extremely clear, supportive, direct, and completely free of technical jargon.";

  try {
    const result = await callGeminiJSON(prompt, systemInstruction);
    res.json(result);
  } catch (error: any) {
    console.warn("[Gemini API] Quota or execution error. Serving local task classification fallback:", error.message);
    const fallback = generateLocalClassifyAndSummarize(title, description);
    res.json(fallback);
  }
});

// 2. AI Priority Ranking Endpoint
app.post("/api/gemini/rank-priority", async (req, res) => {
  const { tasks } = req.body;

  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({ error: "Active tasks array is required" });
  }

  const tasksContext = tasks.map((t: any, i: number) => `
    Task #${i + 1}:
    ID: "${t.id}"
    Title: "${t.title}"
    Priority: "${t.priority}"
    Deadline: "${t.deadline || "None"}"
    Effort Hours: ${t.effortHours || 0}
    Status: "${t.status}"
  `).join("\n");

  const prompt = `
    Analyze the following list of active tasks:
    ${tasksContext}

    Rank these tasks from most urgent & critical to least, considering:
    1. Proximity of the deadline.
    2. Effort required vs time remaining.
    3. User-defined importance (priority).
    4. Risk of delay.

    Return the result strictly in this JSON format:
    {
      "rankedTaskIds": ["list of string task IDs in ranked order"],
      "explanations": {
        "taskId_1": "Concise reasoning for why this task is ranked here (e.g. 'Deadline in 2 hours, requires 1.5 hours of focus. Extremely high risk.')",
        "taskId_2": "..."
      }
    }
  `;

  const systemInstruction = "You are a professional strategist coach. Rank tasks with maximum efficiency, making sure the user handles critical, risky, or high-effort tasks first.";

  try {
    const result = await callGeminiJSON(prompt, systemInstruction);
    res.json(result);
  } catch (error: any) {
    console.warn("[Gemini API] Quota or execution error. Serving local priority ranking fallback:", error.message);
    const fallback = generateLocalRankPriority(tasks);
    res.json(fallback);
  }
});

// 3. Deadline Risk Analysis Endpoint
app.post("/api/gemini/risk-analysis", async (req, res) => {
  const { task, currentTime } = req.body;

  if (!task) {
    return res.status(400).json({ error: "Task is required" });
  }

  const prompt = `
    Analyze the risk of missing the deadline for this task:
    Title: "${task.title}"
    Description: "${task.description || "None"}"
    Deadline: "${task.deadline || "None"}"
    Total Effort Hours: ${task.effortHours || 1}
    Status: "${task.status || "pending"}"
    Subtasks: ${JSON.stringify(task.subtasks || [])}
    Current Time/Date: "${currentTime || new Date().toISOString()}"

    Calculate the risk rating and probability dynamically using these exact variables:
    - Time Remaining: The difference between Deadline and Current Time.
    - Effort Required: Total estimated hours required.
    - Progress: Compare completed subtasks to unfinished subtasks.
    - Status: If status is 'completed', risk is 0% and Low.

    Guideline Rules:
    1. If status is 'completed', Risk Level is 'low', probability is 0%, and explanation reflects that the task is finished.
    2. If the deadline has already passed and status is not 'completed', Risk Level must be 'high' and probability 100%.
    3. If Time Remaining is less than 1.5x the remaining effort hours needed, Risk Level must be 'high' and probability >= 80%.
    4. If Time Remaining is less than 3x the remaining effort hours needed or there are many unfinished subtasks, Risk Level should be 'medium' or 'high' depending on progress.
    5. Otherwise, Risk Level is 'low' with a lower probability (10-30%).

    Provide:
    1. Risk Level (strictly "low", "medium", "high").
    2. Probability of missing deadline (integer from 0 to 100).
    3. Expert explanation/reasoning of the risk factors, including why it was scored this way.

    Return the result strictly in this JSON format:
    {
      "riskLevel": "low" | "medium" | "high",
      "probability": number,
      "reasoning": "A concise, clear explanation of the risk score including time remaining, estimated effort, subtask completion, and deadline proximity."
    }
  `;

  const systemInstruction = "You are a realistic risk analyst coach. Do not sugarcoat. Analyze time remaining versus effort hours and unfinished subtasks to assign low, medium, or high risk levels strictly based on logic guidelines.";

  try {
    const result = await callGeminiJSON(prompt, systemInstruction);
    res.json(result);
  } catch (error: any) {
    console.warn("[Gemini API] Quota or execution error. Serving local deadline risk analysis fallback:", error.message);
    const fallback = generateLocalRiskAnalysis(task, currentTime);
    res.json(fallback);
  }
});

// 3b. Coach Aura Task-Level Advice Endpoint
app.post("/api/gemini/task-advice", async (req, res) => {
  const { task, currentTime } = req.body;

  if (!task || !task.title) {
    return res.status(400).json({ error: "Task is required" });
  }

  const prompt = `
    Analyze this task for Coach Aura insights:
    Title: "${task.title}"
    Description: "${task.description || "None"}"
    Deadline: "${task.deadline || "None"}"
    Priority: "${task.priority || "medium"}"
    Effort Hours: ${task.effortHours || 1}
    Status: "${task.status || "pending"}"
    Subtasks: ${JSON.stringify(task.subtasks || [])}
    Current Time/Date: "${currentTime || new Date().toISOString()}"

    Generate:
    1. A short, highly focused task summary (1-2 sentences explaining objective).
    2. Priority explanation: Concise reasoning explaining the task's priority (High, Moderate, Low) based on deadline and importance.
    3. Risk explanation: Concise reasoning explaining the risk rating (High, Medium, Low) based on progress, remaining effort hours, and days/hours left.
    4. Recommended next action: The single most immediate, high-leverage bullet point action.

    CRITICAL INSTRUCTION: All generated parts MUST be returned as brief, clear bullet points or single concise lines. Avoid long paragraphs and verbose prose. Be extremely direct and encouraging.

    Return the result strictly in this JSON format:
    {
      "summary": "Short task summary bullet or concise text",
      "priorityExplanation": "Bullet explaining priority score, e.g., '• Priority is High because it's due in 24 hours.'",
      "riskExplanation": "Bullet explaining risk level, e.g., '• Risk is Medium because you have 3 uncompleted subtasks.'",
      "nextAction": "• Immediate recommended start action"
    }
  `;

  const systemInstruction = "You are Coach Aura, an expert productivity coach. You analyze task properties and output extremely crisp, actionable advice as short bullet points. Do not write full paragraphs. Keep lists direct and easy to scan.";

  try {
    const result = await callGeminiJSON(prompt, systemInstruction);
    res.json(result);
  } catch (error: any) {
    console.warn("[Gemini API] Quota or execution error. Serving local Coach Aura task advice fallback:", error.message);
    const fallback = generateLocalTaskAdvice(task, currentTime);
    res.json(fallback);
  }
});

// 4. AI Rescue Mode Endpoint
app.post("/api/gemini/rescue-plan", async (req, res) => {
  const { task, currentTime } = req.body;

  if (!task) {
    return res.status(400).json({ error: "Task is required" });
  }

  const prompt = `
    EMERGENCY RESCUE MODE ACTIVATED.
    This task is at critical risk of delay:
    Title: "${task.title}"
    Description: "${task.description || "None"}"
    Deadline: "${task.deadline || "None"}"
    Effort Hours: ${task.effortHours || 0}
    Status: "${task.status || "pending"}"
    Subtasks: ${JSON.stringify(task.subtasks || [])}
    Current Time/Date: "${currentTime || new Date().toISOString()}"

    Analyze the deadline, remaining estimated effort, completion progress, and status carefully. Then, formulate a robust, functional Emergency Rescue Plan:
    1. Create an emergency completion strategy (bulleted list of high-leverage steps / recovery plan).
    2. A time-blocked rapid schedule (e.g., 'Next 15 mins', 'Hour 1 - Hour 2') for immediate execution.
    3. Three immediate recommended next actions that take less than 5 minutes to start (Immediate next actions).

    Return the result strictly in this JSON format:
    {
      "emergencyPlan": "Step-by-step rapid actions to cut scope, focus, and complete this task...",
      "timeBlockedSchedule": [
        { "timeSlot": "Next 15 minutes", "action": "Action explanation" },
        { "timeSlot": "Hour 1 - Hour 2", "action": "Action explanation" }
      ],
      "immediateActions": [
        "First 5-min action",
        "Second 5-min action",
        "Third 5-min action"
      ]
    }
  `;

  const systemInstruction = "You are Now or Never's Emergency AI Rescue Coach. Your tone is urgent, supportive, clear, and highly focused. Your schedules must reduce all friction to zero and provide actionable relief.";

  try {
    const result = await callGeminiJSON(prompt, systemInstruction);
    res.json(result);
  } catch (error: any) {
    console.warn("[Gemini API] Quota or execution error. Serving local Emergency Rescue Plan fallback:", error.message);
    const fallback = generateLocalRescuePlan(task, currentTime);
    res.json(fallback);
  }
});

// 4b. Comprehensive Task Analysis Endpoint
app.post("/api/gemini/analyze-task", async (req, res) => {
  const { title, description, deadline, priority, effortHours, subtasks, currentTime } = req.body;

  if (!title) {
    return res.status(400).json({ error: "Title is required" });
  }

  const prompt = `
    Analyze the following task and generate a comprehensive, highly integrated AI productivity package:
    Title: "${title}"
    Description: "${description || "None"}"
    Deadline: "${deadline || "None"}"
    User-specified priority: "${priority || "medium"}"
    Estimated Effort: ${effortHours || 1} hours
    Current Time/Date: "${currentTime || new Date().toISOString()}"
    Current Subtasks (if any): ${JSON.stringify(subtasks || [])}

    You must produce EXACTLY the following JSON response structure. All properties are mandatory and must be fully populated:
    
    1. "aiSummary": A short, highly cohesive summary of 1 to 2 lines maximum. Explain what the task is about and its primary objective without technical jargon.
    2. "aiPriority": Smart priority classification. Value must be "low", "moderate", or "high". Determine this based on deadline proximity and effort.
    3. "priorityExplanation": Clear, user-friendly explanation of why this priority was selected. Format as a direct, brief bullet starting with '•'.
    4. "riskAnalysis": An object containing:
       - "riskLevel": Must be "low", "medium", or "high". Calculate this using logic:
         - If task is completed, riskLevel is "low", probability is 0.
         - If deadline is already passed, riskLevel is "high", probability is 100.
         - If Time Remaining (Deadline minus Current Time) is less than 1.5x the effort hours, riskLevel is "high", probability >= 80%.
         - If Time Remaining is less than 3x the effort hours, riskLevel should be "medium" or "high".
         - Otherwise, riskLevel is "low", probability 10-30%.
       - "probability": An integer from 0 to 100.
       - "reasoning": A clear, user-friendly explanation of the risk factors, showing how deadline proximity, estimated effort, and subtask completion led to this score.
    5. "rescuePlan": An object containing:
       - "emergencyPlan": A detailed, concrete recovery plan explaining how to cut scope, isolate distractions, or handle immediate blocks. Avoid generic alert messages.
       - "timeBlockedSchedule": An array of objects with "timeSlot" and "action" outlining an immediate step-by-step recovery schedule (e.g. "Next 15 minutes", "Hour 1 - Hour 2", "Hour 2 - Hour 3").
       - "immediateActions": Three extremely specific 5-minute fast-start actions the user can do right now to build immediate momentum.
       - "suggestedShortBreaks": Strategic break suggestions to manage energy (e.g. "Take a 5-minute stretch break after Sprint 1").
       - "estimatedFinishTime": An estimated finish time or timeline to complete all remaining work based on effort and deadline.
    6. "subtasks": Break the task down into 3 to 7 actionable, realistic, progressive subtasks. If subtasks are already provided, preserve them unless they need refinement. Each subtask must be an object with "id" (string, e.g., "sub-1"), "title" (string), "status" (string "pending" or "completed"), and "estimatedHours" (number). Every subtask title must be deeply specific and inferred directly from the task title and description, strictly avoiding generic placeholders like "Research", "Draft", "Review", "Submit".
    7. "executionStrategy": Suggest a highly practical, task-specific execution strategy paragraph explaining how to tackle the subtasks. Avoid generic templates.
    8. "coachAdvice": An object containing:
       - "summary": Cohesive task summary.
       - "priorityExplanation": A short bullet explaining why this priority was selected, e.g., "• Priority is High because it's due in 24 hours." (Explain the decision!).
       - "riskExplanation": A short bullet explaining why this risk was calculated, e.g., "• Risk is High because only 4 hours remain for 5 hours of work." (Explain the decision!).
       - "nextAction": A short bullet indicating the single immediate recommended starter action.

    Return the result strictly in this JSON format (no other text, no markdown block wrappers except standard JSON):
    {
      "aiSummary": "...",
      "aiPriority": "low" | "moderate" | "high",
      "priorityExplanation": "...",
      "riskAnalysis": {
        "riskLevel": "low" | "medium" | "high",
        "probability": number,
        "reasoning": "..."
      },
      "rescuePlan": {
        "emergencyPlan": "...",
        "timeBlockedSchedule": [
          { "timeSlot": "...", "action": "..." }
        ],
        "immediateActions": ["...", "...", "..."],
        "suggestedShortBreaks": "...",
        "estimatedFinishTime": "..."
      },
      "subtasks": [
        { "id": "sub-1", "title": "...", "status": "pending", "estimatedHours": number }
      ],
      "executionStrategy": "...",
      "coachAdvice": {
        "summary": "...",
        "priorityExplanation": "...",
        "riskExplanation": "...",
        "nextAction": "..."
      }
    }
  `;

  const systemInstruction = "You are Coach Aura, an expert full-stack AI productivity coach. You analyze task properties and output extremely crisp, integrated, actionable advice and plans strictly formatted as JSON. Keep explanations clear, scan-friendly, and simple. Explain all of your priority and risk decisions.";

  try {
    const result = await callGeminiJSON(prompt, systemInstruction);
    res.json(result);
  } catch (error: any) {
    console.warn("[Gemini API] Quota or execution error in analyze-task, serving local fallback:", error.message);
    const fallback = generateLocalAnalyzeTask({ title, description, deadline, priority, effortHours, subtasks }, currentTime);
    res.json(fallback);
  }
});

// 5. Daily AI Coach Endpoint
app.post("/api/gemini/coach-plan", async (req, res) => {
  const { tasks, userProgress, currentTime } = req.body;

  const tasksContext = (tasks || []).map((t: any, i: number) => `
    Task #${i + 1}:
    Title: "${t.title}"
    Priority: "${t.priority}"
    Deadline: "${t.deadline || "None"}"
    Effort Hours: ${t.effortHours || 0}
    Status: "${t.status}"
  `).join("\n");

  const prompt = `
    Formulate a highly personalized, daily coaching plan for the user.
    Active Tasks:
    ${tasksContext || "No active tasks."}

    User's Recent Progress Metrics:
    - Tasks completed recently: ${userProgress?.completedCount || 0}
    - Total pending tasks: ${userProgress?.pendingCount || 0}
    - Deadline success rate: ${userProgress?.successRate || "100"}%
    - Current Time/Date: "${currentTime || new Date().toISOString()}"

    Produce:
    1. A daily, direct coach message. This MUST be formatted EXACTLY into these four sections with bullet points:
       Today's Focus
       • [Core focus task with estimated duration]

       High Priority
       • [High priority actionable item]

       Risk Alert
       • [Risk warnings on tight deadlines or overdue items]

       Recommended Next Step
       • [Immediate, single specific starter step]

       Keep it extremely concise (max 4-5 bullet points total across the whole message). No filler text, no intro, no outro, no paragraphs.
    2. The absolute top 2 or 3 priorities for today.
    3. An intelligent time-blocked schedule calculated BACKWARDS from each task's deadline:
       - Sort active pending tasks by deadline descending (latest first).
       - Allocate time slots backward from the deadline so that each task block ends exactly at its deadline (or earlier if blocked by a subsequent task).
       - Ensure task schedule blocks are sequential, chronological, and non-overlapping.
       - The start time for a task must equal the end time minus the estimated effortHours.
       - Format the "time" property beautifully (e.g., "03:00 PM - 05:00 PM" if today, or include a short date "Jun 28, 03:00 PM - 05:00 PM" if on a different day).

    Return the result strictly in this JSON format:
    {
      "dailyCoachMessage": "Today's Focus\n• Finish React Assignment (Duration: 2h 30m)\n\nHigh Priority\n• Complete Resume Review before 5 PM\n\nRisk Alert\n• DBMS Assignment has become High Risk because only 8 hours remain.\n\nRecommended Next Step\n• Start the React Assignment now to stay on schedule.",
      "priorities": ["taskId or Task Title 1", "TaskId or Task Title 2"],
      "suggestedSchedule": [
        { "time": "03:00 PM - 05:00 PM", "taskTitle": "Task/Activity Title", "action": "Specific focal point, ending exactly at deadline" }
      ]
    }
  `;

  const systemInstruction = "You are Coach Aura, the elite productivity coach. Your dailyCoachMessage MUST be returned strictly matching the four scannable sections: Today's Focus, High Priority, Risk Alert, and Recommended Next Step. Avoid long paragraph prose and maintain simple, human, user-friendly wording. You calculate all suggestedSchedule blocks BACKWARDS from their deadlines, ensuring a sequential, non-overlapping, chronological timeline.";

  try {
    const result = await callGeminiJSON(prompt, systemInstruction);
    res.json(result);
  } catch (error: any) {
    console.warn("[Gemini API] Quota or execution error. Serving local Daily Coach Plan fallback:", error.message);
    const fallback = generateLocalCoachPlan(tasks, userProgress, currentTime);
    res.json(fallback);
  }
});

// Serve frontend assets in production or Vite server in dev
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Now or Never full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
