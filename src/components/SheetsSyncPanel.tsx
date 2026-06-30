import React, { useState } from "react";
import { SheetsSyncConfig, Task } from "../types";
import { createSyncSpreadsheet, syncTasksToSheet } from "../googleSync";
import { FileSpreadsheet, RefreshCw, CheckCircle, ExternalLink, ShieldCheck, ToggleLeft, ToggleRight, Sparkles, Loader } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface SheetsSyncPanelProps {
  accessToken: string;
  tasks: Task[];
  syncConfig: SheetsSyncConfig | null;
  onUpdateSyncConfig: (config: SheetsSyncConfig) => void;
  onForceSync: () => Promise<void>;
  isNavbarMode?: boolean;
}

function formatLastSynced(isoString: string | null | undefined): string {
  if (!isoString) return "Never Synced";
  
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "Never Synced";
    
    // Check if Today, Yesterday or older
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const compareDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    
    // Format time: e.g., 4:32 PM
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    };
    const timePart = d.toLocaleTimeString(undefined, timeOptions);
    
    if (compareDate.getTime() === today.getTime()) {
      return `Today • ${timePart}`;
    } else if (compareDate.getTime() === yesterday.getTime()) {
      return `Yesterday • ${timePart}`;
    } else {
      // e.g. 27 Jun 2026 • 10:45 AM
      const dateOptions: Intl.DateTimeFormatOptions = {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      };
      const datePart = d.toLocaleDateString(undefined, dateOptions);
      return `${datePart} • ${timePart}`;
    }
  } catch (err) {
    console.error("Error formatting synced time:", err);
    return "Never Synced";
  }
}

export const SheetsSyncPanel: React.FC<SheetsSyncPanelProps> = ({
  accessToken,
  tasks,
  syncConfig,
  onUpdateSyncConfig,
  onForceSync,
  isNavbarMode = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "success" | "failed">("idle");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleCreateSheet = async () => {
    if (!accessToken) {
      setError("Active login required to connect Google Sheets.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const { spreadsheetId, spreadsheetUrl } = await createSyncSpreadsheet(accessToken);
      
      const newConfig: SheetsSyncConfig = {
        spreadsheetId,
        spreadsheetUrl,
        isEnabled: true,
        lastSyncedAt: new Date().toISOString(),
      };

      onUpdateSyncConfig(newConfig);

      // Perform initial task sync
      await syncTasksToSheet(spreadsheetId, tasks, accessToken);
      setSuccessMsg("Google Sheet generated and initialized! Check your Google Drive.");
    } catch (err: any) {
      console.error(err);
      setError("Failed to create Google Sheet. Please check Google Workspace permissions.");
    } finally {
      setLoading(false);
    }
  };

  const handleSyncNow = async () => {
    if (!syncConfig || !syncConfig.spreadsheetId) return;
    if (syncState === "syncing" || syncState === "success") return;

    setSyncState("syncing");
    setError(null);
    setSuccessMsg(null);

    if (!accessToken) {
      console.error("[SYNC] Synchronization failed: Missing required authentication credential (accessToken is empty).");
      setSyncState("failed");
      const errMsg = "Your Google connection is inactive or expired. Please sign out and reconnect your Google Account.";
      setError(errMsg);
      setToast({
        message: "Authentication expired. Please reconnect Google.",
        type: "error"
      });
      setTimeout(() => {
        setSyncState("idle");
        setToast(null);
      }, 3500);
      return;
    }

    try {
      await syncTasksToSheet(syncConfig.spreadsheetId, tasks, accessToken);
      
      const updatedConfig = {
        ...syncConfig,
        lastSyncedAt: new Date().toISOString(),
      };
      onUpdateSyncConfig(updatedConfig);
      
      setSyncState("success");
      setToast({
        message: "Google Sheets synchronized successfully.",
        type: "success"
      });

      // Maintain success state for 2.5 seconds, then restore
      setTimeout(() => {
        setSyncState("idle");
        setToast(null);
      }, 2500);

    } catch (err: any) {
      console.error("[SYNC] Synchronization failed:", err);
      let friendlyError = err?.message || "Failed to sync to spreadsheet. Make sure file exists in your Google Drive.";
      
      if (
        friendlyError.includes("401") || 
        friendlyError.includes("UNAUTHENTICATED") || 
        friendlyError.includes("missing required authentication credential") ||
        friendlyError.includes("credential")
      ) {
        friendlyError = "Google connection has expired. Please log out and connect your Google Account again.";
      }

      setError(friendlyError);
      setSyncState("failed");
      setToast({
        message: friendlyError,
        type: "error"
      });

      // Restore to idle so they can retry, but let the failed state be visible briefly
      setTimeout(() => {
        setSyncState("idle");
        setToast(null);
      }, 3500);
    }
  };

  const handleToggleAutoSync = () => {
    if (!syncConfig) return;
    const updated = {
      ...syncConfig,
      isEnabled: !syncConfig.isEnabled,
    };
    onUpdateSyncConfig(updated);
  };

  const formattedSyncTime = formatLastSynced(syncConfig?.lastSyncedAt);

  if (isNavbarMode) {
    return (
      <div className="p-3.5 space-y-4">
        {syncConfig?.spreadsheetId ? (
          <div className="space-y-4">
            {/* Status & Actions Card */}
            <div className="bg-bg-primary/50 border border-border-custom p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-[9px] text-text-muted uppercase tracking-widest block">Linked Sheet</span>
                  <span className="text-text-primary font-bold">Task Tracker Sync</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-[9px] text-text-muted uppercase tracking-widest block">Last Synced</span>
                  <span className="text-text-primary font-bold font-mono">{formattedSyncTime}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2.5 border-t border-border-custom/50">
                <a
                  href={syncConfig.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-text-primary bg-bg-surface hover:bg-bg-hover py-1.5 rounded-xl border border-border-custom transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-accent-primary" />
                  Open Sheet
                </a>
                <button
                  onClick={handleSyncNow}
                  disabled={syncState === "syncing" || syncState === "success"}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm select-none ${
                    syncState === "success"
                      ? "bg-status-success hover:bg-status-success/90"
                      : syncState === "failed"
                      ? "bg-status-danger hover:bg-status-danger/90"
                      : syncState === "syncing"
                      ? "bg-accent-primary/50 cursor-not-allowed"
                      : "bg-accent-primary hover:bg-accent-primary/90"
                  }`}
                >
                  {syncState === "syncing" && <Loader className="w-3.5 h-3.5 animate-spin text-white" />}
                  {syncState === "success" && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                  <span>
                    {syncState === "syncing" ? "Syncing..." : syncState === "success" ? "Synced" : "Sync Now"}
                  </span>
                </button>
              </div>
            </div>

            {/* Auto Sync Toggle */}
            <div className="flex items-center justify-between p-3 bg-bg-primary/30 border border-border-custom/60 rounded-xl">
              <span className="text-xs font-bold text-text-secondary">Auto-sync on task edit</span>
              <button
                onClick={handleToggleAutoSync}
                className="flex items-center gap-2 font-bold text-text-secondary hover:text-text-primary transition-all cursor-pointer"
              >
                {syncConfig.isEnabled ? (
                  <ToggleRight className="w-6 h-6 text-accent-primary" />
                ) : (
                  <ToggleLeft className="w-6 h-6 text-text-muted/30" />
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-xs text-text-secondary bg-bg-primary/50 p-4 rounded-xl border border-border-custom">
              <ShieldCheck className="w-5 h-5 text-accent-secondary shrink-0" />
              <span>Creates a dedicated workbook named <strong>"Now or Never - Task Tracker Sync"</strong> in your Google Sheets and logs task updates automatically.</span>
            </div>

            <button
              onClick={handleCreateSheet}
              disabled={loading}
              className="w-full py-2 bg-accent-primary hover:bg-accent-primary/90 disabled:bg-accent-primary/40 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-lg transition-all border border-transparent"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin text-white/50" />
                  Initializing Sheet...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-white/50" />
                  Create Sync Spreadsheet
                </>
              )}
            </button>
          </div>
        )}

        {error && (
          <p className="text-xs font-medium text-status-danger bg-status-danger/10 border border-status-danger/20 p-3 rounded-xl">
            {error}
          </p>
        )}

        {successMsg && (
          <p className="text-xs font-medium text-status-success bg-status-success/10 border border-status-success/20 p-3 rounded-xl flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-status-success" />
            {successMsg}
          </p>
        )}

        {/* Floating Toast Notification Container */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border backdrop-blur-md"
              style={{
                backgroundColor: toast.type === "success" ? "rgba(16, 185, 129, 0.95)" : "rgba(239, 68, 68, 0.95)",
                borderColor: toast.type === "success" ? "rgba(52, 211, 153, 0.4)" : "rgba(248, 113, 113, 0.4)",
                color: "#ffffff"
              }}
            >
              {toast.type === "success" ? (
                <CheckCircle className="w-5 h-5 shrink-0 text-white" />
              ) : (
                <span className="text-sm font-bold">✕</span>
              )}
              <span className="text-xs sm:text-sm font-semibold">{toast.message}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div id="sheets-sync-panel" className="bg-bg-surface border border-border-custom p-4.5 sm:p-6 rounded-2xl md:rounded-[24px] shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 sm:p-2.5 bg-accent-secondary/10 text-accent-secondary rounded-xl border border-accent-secondary/20 shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary tracking-tight flex items-center gap-1.5 uppercase">
              Google Sheets Synchronization
              <span className="text-[10px] bg-accent-secondary/10 text-accent-secondary px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider hidden xs:inline-block">Workspace</span>
            </h3>
            <p className="text-xs text-text-secondary">Log task diagnostics, subtasks, and risks in spreadsheets</p>
          </div>
        </div>

        {syncConfig?.spreadsheetId ? (
          <div className="flex items-center gap-2">
            <a
              href={syncConfig.spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-bold text-text-primary bg-bg-primary hover:bg-bg-hover px-3.5 py-2 rounded-xl border border-border-custom transition-all"
            >
              <ExternalLink className="w-4 h-4 text-accent-primary" />
              Open Sheet
            </a>
            <button
              onClick={handleSyncNow}
              disabled={syncState === "syncing" || syncState === "success"}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm select-none ${
                syncState === "success"
                  ? "bg-status-success hover:bg-status-success/90"
                  : syncState === "failed"
                  ? "bg-status-danger hover:bg-status-danger/90"
                  : syncState === "syncing"
                  ? "bg-accent-primary/50 cursor-not-allowed"
                  : "bg-accent-primary hover:bg-accent-primary/90"
              }`}
            >
              {syncState === "syncing" && (
                <>
                  <Loader className="w-3.5 h-3.5 animate-spin text-white" />
                  Syncing...
                </>
              )}
              {syncState === "success" && (
                <>
                  <CheckCircle className="w-3.5 h-3.5 text-white" />
                  ✓ Synced Successfully
                </>
              )}
              {syncState === "failed" && (
                <>
                  <span className="text-sm">✕</span>
                  Sync Failed
                </>
              )}
              {syncState === "idle" && (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Sync
                </>
              )}
            </button>
          </div>
        ) : (
          <button
            onClick={handleCreateSheet}
            disabled={loading}
            className="px-4 py-2 bg-accent-primary hover:bg-accent-primary/90 disabled:bg-accent-primary/40 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-lg transition-all border border-transparent"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 animate-spin text-white/50" />
                Initializing Sheet...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-white/50" />
                Create Sync Spreadsheet
              </>
            )}
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs font-medium text-status-danger bg-status-danger/10 border border-status-danger/20 p-3 rounded-xl">
          {error}
        </p>
      )}

      {successMsg && (
        <p className="text-xs font-medium text-status-success bg-status-success/10 border border-status-success/20 p-3 rounded-xl flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-status-success" />
          {successMsg}
        </p>
      )}

      {syncConfig?.spreadsheetId ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-text-secondary pt-4 border-t border-border-custom">
          <div className="flex items-center gap-6">
            <div>
              <span className="font-bold text-[9px] text-text-muted uppercase tracking-widest block">Sync Status</span>
              <span className="text-text-primary font-bold">Linked Tracker Sheet</span>
            </div>
            <div>
              <span className="font-bold text-[9px] text-text-muted uppercase tracking-widest block">Last Synced</span>
              <span className="text-text-primary font-bold font-mono">{formattedSyncTime}</span>
            </div>
          </div>

          <button
            onClick={handleToggleAutoSync}
            className="flex items-center gap-2 font-bold text-text-secondary hover:text-text-primary transition-all cursor-pointer"
          >
            {syncConfig.isEnabled ? (
              <>
                <ToggleRight className="w-6 h-6 text-accent-primary" />
                Auto-sync on edit enabled
              </>
            ) : (
              <>
                <ToggleLeft className="w-6 h-6 text-text-muted/30" />
                Auto-sync disabled
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-xs text-text-secondary bg-bg-primary/50 p-4 rounded-xl border border-border-custom">
          <ShieldCheck className="w-5 h-5 text-accent-secondary shrink-0" />
          <span>Creates a dedicated workbook named <strong>"Now or Never - Task Tracker Sync"</strong> in your Google Sheets and logs task updates automatically.</span>
        </div>
      )}

      {/* Floating Toast Notification Container */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border backdrop-blur-md"
            style={{
              backgroundColor: toast.type === "success" ? "rgba(16, 185, 129, 0.95)" : "rgba(239, 68, 68, 0.95)",
              borderColor: toast.type === "success" ? "rgba(52, 211, 153, 0.4)" : "rgba(248, 113, 113, 0.4)",
              color: "#ffffff"
            }}
          >
            {toast.type === "success" ? (
              <CheckCircle className="w-5 h-5 shrink-0 text-white" />
            ) : (
              <span className="text-sm font-bold">✕</span>
            )}
            <span className="text-xs sm:text-sm font-semibold">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
