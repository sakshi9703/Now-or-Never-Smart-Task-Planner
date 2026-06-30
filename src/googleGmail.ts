import { Task, DailyPlan } from "./types";
import { safeDate } from "./lib/dateUtils";

/**
 * Sends an email using the Gmail REST API.
 */
export async function sendGmailMessage(
  accessToken: string,
  to: string,
  subject: string,
  body: string
): Promise<boolean> {
  if (!accessToken) {
    console.error("Gmail integration error: No access token provided.");
    return false;
  }

  const emailLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "MIME-Version: 1.0",
    "",
    body,
  ];

  const emailContent = emailLines.join("\r\n");

  // Web-safe base64url encode with support for UTF-8 characters
  const encodedEmail = btoa(
    encodeURIComponent(emailContent).replace(/%([0-9A-F]{2})/g, (_, p1) => {
      return String.fromCharCode(parseInt(p1, 16));
    })
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  try {
    const res = await fetch("https://gmail.googleapis.com/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw: encodedEmail,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Gmail send API returned error status:", res.status, errorText);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Failed to send email via Gmail API:", err);
    return false;
  }
}

/**
 * Formats and sends the Daily Plan / Morning Briefing email.
 */
export async function sendDailyPlanEmail(
  accessToken: string,
  email: string,
  tasks: Task[],
  dailyPlan: DailyPlan
): Promise<boolean> {
  const pendingTasks = tasks.filter((t) => t.status !== "completed");
  const todayStr = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const taskListText = pendingTasks.length > 0
    ? pendingTasks
        .map((t) => `• ${t.title} (${t.effortHours} hour${t.effortHours !== 1 ? "s" : ""}) - Smart Priority: ${t.aiPriority || t.priority}`)
        .join("\n")
    : "No pending tasks scheduled for today. Great job!";

  const coachAdvice = dailyPlan.dailyCoachMessage || "Plan your focus, avoid multitasking, and secure your high-priority items early.";

  const suggestedScheduleText = dailyPlan.suggestedSchedule && dailyPlan.suggestedSchedule.length > 0
    ? dailyPlan.suggestedSchedule
        .map((s) => `[${s.time}] - ${s.taskTitle}: ${s.action}`)
        .join("\n")
    : "No specific time slots blocked. Feel free to structure your hours fluidly today!";

  const totalEffort = pendingTasks.reduce((sum, t) => sum + t.effortHours, 0);

  const subject = `☀️ Morning Coaching Brief: Your Daily Plan for ${todayStr}`;
  const body = `Good Morning!

Here is your smart productivity briefing from Now or Never. Let's make today a masterpiece.

--------------------------------------------------
TODAY'S PLAN & RECOVERY TARGETS
--------------------------------------------------
Pending Focus Tasks:
${taskListText}

Estimated Focus Time Required: ${totalEffort} hours

--------------------------------------------------
RECOMMENDED FOCUS & COACH ADVICE
--------------------------------------------------
${coachAdvice}

--------------------------------------------------
SUGGESTED HOURLY FLOW
--------------------------------------------------
${suggestedScheduleText}

--------------------------------------------------
COACH REMINDER:
Procrastination is the thief of time. Pick the highest priority task first, set a timer, and begin. You've got this!

Best regards,
Coach Aura & Now or Never`;

  return sendGmailMessage(accessToken, email, subject, body);
}

/**
 * Formats and sends an urgent task reminder email.
 */
export async function sendTaskReminderEmail(
  accessToken: string,
  email: string,
  task: Task
): Promise<boolean> {
  const dObj = safeDate(task.deadline);
  if (!dObj) {
    console.error(`Gmail reminder error: Task ${task.id} has no valid deadline.`);
    return false;
  }
  const timeRemainingMs = dObj.getTime() - Date.now();
  const timeRemainingHours = Math.max(0, timeRemainingMs / (1000 * 60 * 60));
  
  // Format hours and minutes remaining
  const hoursLeft = Math.floor(timeRemainingHours);
  const minutesLeft = Math.round((timeRemainingHours - hoursLeft) * 60);
  const timeRemainingStr = hoursLeft > 0
    ? `${hoursLeft} hour${hoursLeft !== 1 ? "s" : ""} and ${minutesLeft} minute${minutesLeft !== 1 ? "s" : ""}`
    : `${minutesLeft} minute${minutesLeft !== 1 ? "s" : ""}`;

  const subject = `🚨 Action Required: ${task.title} (Deadline Approaching)`;
  const body = `Hi!

This is a time-critical reminder from Now or Never.

The deadline for your task is approaching, and it is time to secure the deliverable!

Task Details:
• Title: ${task.title}
• Estimated Focus Required: ${task.effortHours} hour${task.effortHours !== 1 ? "s" : ""}
• Smart Priority Level: ${(task.aiPriority || task.priority).toUpperCase()}
• Time Remaining Before Deadline: ${timeRemainingStr}

COACH STRATEGIC BLUEPRINT:
To comfortably complete this task before the deadline without emergency rushing, you must begin within the next 30 minutes.

${task.executionStrategy ? `Execution Strategy:\n"${task.executionStrategy}"\n` : ""}
Let's remove all friction:
1. Turn off notifications.
2. Open your work files right now.
3. Dedicate your focus.

No excuses. Start now and cross it off!

Best regards,
Your AI Productivity Coach
Now or Never`;

  return sendGmailMessage(accessToken, email, subject, body);
}
