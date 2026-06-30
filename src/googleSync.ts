import { Task } from "./types";
import { safeDate } from "./lib/dateUtils";

/**
 * Creates a new Google Spreadsheet for task sync.
 * Returns the spreadsheet ID and spreadsheet URL.
 */
export async function createSyncSpreadsheet(accessToken: string): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  try {
    const res = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          title: "Now or Never - Task Tracker Sync",
        },
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to create spreadsheet: ${errorText}`);
    }

    const data = await res.json();
    const spreadsheetId = data.spreadsheetId;
    const spreadsheetUrl = data.spreadsheetUrl;

    // Initialize headers
    await initializeSheetHeaders(spreadsheetId, accessToken);

    return { spreadsheetId, spreadsheetUrl };
  } catch (error) {
    console.error("Error creating sync spreadsheet:", error);
    throw error;
  }
}

/**
 * Initializes the header row of the spreadsheet with custom tracking columns.
 */
async function initializeSheetHeaders(spreadsheetId: string, accessToken: string) {
  const headers = [
    [
      "Task ID",
      "Title",
      "Description",
      "Deadline",
      "Priority",
      "Effort Hours",
      "Status",
      "Risk Level",
      "Probability %",
      "Risk Reasoning",
      "Last Synced (UTC)"
    ]
  ];

  const range = "Sheet1!A1:K1";
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      values: headers,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to write sheet headers: ${errorText}`);
  }
}

/**
 * Syncs the list of tasks directly to Sheet1 of the spreadsheet, replacing all rows below the headers.
 */
export async function syncTasksToSheet(spreadsheetId: string, tasks: Task[], accessToken: string): Promise<boolean> {
  try {
    // 1. First, clear the existing data under headers to prevent stale entries
    const clearRange = "Sheet1!A2:K1000";
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${clearRange}:clear`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (tasks.length === 0) {
      return true; // cleared successfully, nothing more to write
    }

    // 2. Prepare task rows
    const rows = tasks.map((task) => {
      const dObj = safeDate(task.deadline);
      const formattedDeadlineVal = dObj ? dObj.toLocaleString() : "No due date";
      return [
        task.id,
        task.title,
        task.description || "",
        formattedDeadlineVal,
        task.priority,
        task.effortHours,
        task.status,
        task.riskAnalysis?.riskLevel || "Pending",
        task.riskAnalysis?.probability !== undefined ? `${task.riskAnalysis.probability}%` : "Pending",
        task.riskAnalysis?.reasoning || "Waiting on AI Coach analysis",
        new Date().toISOString()
      ];
    });

    const writeRange = `Sheet1!A2:K${tasks.length + 1}`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${writeRange}?valueInputOption=USER_ENTERED`;

    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: rows,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to sync task values: ${errorText}`);
    }

    return true;
  } catch (error) {
    console.error("Error syncing tasks to sheet:", error);
    throw error;
  }
}
