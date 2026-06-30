import React, { useState, useEffect } from "react";
import { Task } from "../types";
import { X, ClipboardList, Clock, Flame, Calendar, Loader, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { safeDate } from "../lib/dateUtils";

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (taskData: {
    title: string;
    description: string;
    deadline?: string;
    priority: "low" | "medium" | "high" | "urgent";
    effortHours: number;
    generateBreakdown?: boolean;
    category?: string;
    notes?: string;
    startTime?: string;
  }) => Promise<void>;
  editTask?: Task | null;
  userCategories?: string[];
}

export const TaskFormModal: React.FC<TaskFormModalProps> = ({ isOpen, onClose, onSubmit, editTask, userCategories = [] }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedOption, setSelectedOption] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [deadline, setDeadline] = useState("");
  const [hasSpecificDeadline, setHasSpecificDeadline] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [durationHours, setDurationHours] = useState(3);
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [generateBreakdown, setGenerateBreakdown] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Custom Date/Time picker state
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<"deadline" | "startTime">("deadline");
  const [pickerDate, setPickerDate] = useState<Date>(new Date());
  const [pickerHour, setPickerHour] = useState<number>(5);
  const [pickerMinute, setPickerMinute] = useState<number>(0);
  const [pickerAmpm, setPickerAmpm] = useState<"AM" | "PM">("PM");

  // Sync picker details from selected target (deadline or startTime)
  useEffect(() => {
    if (isPickerOpen) {
      const val = pickerTarget === "deadline" ? deadline : startTime;
      const d = safeDate(val);
      if (d) {
        setPickerDate(d);
        const h = d.getHours();
        const ampm = h >= 12 ? "PM" : "AM";
        let h12 = h % 12;
        if (h12 === 0) h12 = 12;
        setPickerHour(h12);
        setPickerMinute(d.getMinutes());
        setPickerAmpm(ampm);
      }
    }
  }, [pickerTarget, isPickerOpen, deadline, startTime]);

  // Escape key handler for both modals
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isPickerOpen) {
          setIsPickerOpen(false);
        } else if (isOpen) {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isPickerOpen, isOpen, onClose]);

  const getMonthName = (date: Date) => {
    return date.toLocaleString(undefined, { month: "long" });
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();
    
    const days: { dateObj: Date; isCurrentMonth: boolean; key: string }[] = [];
    
    // Add empty spacer cells for previous month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const prevDate = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({
        dateObj: prevDate,
        isCurrentMonth: false,
        key: `prev-${prevDate.getDate()}`
      });
    }
    
    // Add actual current month days
    for (let i = 1; i <= lastDay; i++) {
      const currDate = new Date(year, month, i);
      days.push({
        dateObj: currDate,
        isCurrentMonth: true,
        key: `curr-${i}`
      });
    }
    
    return days;
  };

  const handleConfirmPicker = () => {
    const finalHour = pickerAmpm === "PM" ? (pickerHour === 12 ? 12 : pickerHour + 12) : (pickerHour === 12 ? 0 : pickerHour);
    const finalDate = new Date(pickerDate);
    finalDate.setHours(finalHour, pickerMinute, 0, 0);
    
    // Format as YYYY-MM-DDTHH:MM local format
    const year = finalDate.getFullYear();
    const month = String(finalDate.getMonth() + 1).padStart(2, '0');
    const day = String(finalDate.getDate()).padStart(2, '0');
    const hh = String(finalDate.getHours()).padStart(2, '0');
    const mm = String(finalDate.getMinutes()).padStart(2, '0');
    
    const formatted = `${year}-${month}-${day}T${hh}:${mm}`;
    if (pickerTarget === "deadline") {
      setDeadline(formatted);
    } else {
      setStartTime(formatted);
    }
    setIsPickerOpen(false);
  };

  useEffect(() => {
    if (editTask) {
      setTitle(editTask.title);
      setDescription(editTask.description || "");
      setSelectedOption(editTask.category || "");
      setCustomCategory("");
      setNotes(editTask.notes || "");
      
      // Convert deadline to string suitable for datetime-local input
      const dateObj = safeDate(editTask.deadline);
      if (dateObj) {
        const tzOffset = dateObj.getTimezoneOffset() * 60000; // offset in milliseconds
        const localISODate = (new Date(dateObj.getTime() - tzOffset)).toISOString().slice(0, 16);
        setDeadline(localISODate);
        setHasSpecificDeadline(true);
      } else {
        setDeadline("");
        setHasSpecificDeadline(false);
      }

      // Convert startTime
      const startObj = safeDate(editTask.startTime);
      if (startObj) {
        const startTzOffset = startObj.getTimezoneOffset() * 60000;
        const localStartISO = (new Date(startObj.getTime() - startTzOffset)).toISOString().slice(0, 16);
        setStartTime(localStartISO);
      } else {
        // Fallback: deadline minus effortHours, or tomorrow 2PM if no deadline
        const baseDateObj = safeDate(editTask.deadline);
        const baseDate = baseDateObj || new Date();
        const effortMs = (editTask.effortHours || 1) * 3600 * 1000;
        const startObjFallback = new Date(baseDate.getTime() - effortMs);
        const startTzOffset = startObjFallback.getTimezoneOffset() * 60000;
        const localStartISO = (new Date(startObjFallback.getTime() - startTzOffset)).toISOString().slice(0, 16);
        setStartTime(localStartISO);
      }

      setPriority(editTask.priority);
      const totalMinutes = Math.round((editTask.effortHours || 0) * 60);
      setDurationHours(Math.floor(totalMinutes / 60));
      setDurationMinutes(totalMinutes % 60);
      setGenerateBreakdown(editTask.breakdownGenerated ?? true);
    } else {
      setTitle("");
      setDescription("");
      setSelectedOption("");
      setCustomCategory("");
      setNotes("");
      
      // Default deadline to tomorrow at 5 PM
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(17, 0, 0, 0);
      const tzOffset = tomorrow.getTimezoneOffset() * 60000;
      const localISO = (new Date(tomorrow.getTime() - tzOffset)).toISOString().slice(0, 16);
      setDeadline(localISO);
      setHasSpecificDeadline(false);

      // Default startTime to tomorrow at 2 PM
      const defaultStart = new Date();
      defaultStart.setDate(defaultStart.getDate() + 1);
      defaultStart.setHours(14, 0, 0, 0);
      const startTzOffset = defaultStart.getTimezoneOffset() * 60000;
      const startLocalISO = (new Date(defaultStart.getTime() - startTzOffset)).toISOString().slice(0, 16);
      setStartTime(startLocalISO);

      setPriority("medium");
      setDurationHours(3);
      setDurationMinutes(0);
      setGenerateBreakdown(true);
    }
    setError(null);
  }, [editTask, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please provide a task title.");
      return;
    }
    if (hasSpecificDeadline && !deadline) {
      setError("Please select a deadline.");
      return;
    }
    if (!startTime) {
      setError("Please select a planned start time.");
      return;
    }
    const totalMinutes = durationHours * 60 + durationMinutes;
    if (totalMinutes <= 0) {
      setError("Please provide a realistic duration estimate.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const calculatedEffortHours = durationHours + durationMinutes / 60;
      
      let finalCategory = "";
      if (selectedOption === "other") {
        finalCategory = customCategory.trim();
      } else {
        finalCategory = selectedOption.trim();
      }

      const parsedDeadline = hasSpecificDeadline ? safeDate(deadline) : null;
      const parsedStartTime = safeDate(startTime);

      await onSubmit({
        title,
        description,
        deadline: parsedDeadline ? parsedDeadline.toISOString() : "",
        priority,
        effortHours: calculatedEffortHours,
        generateBreakdown,
        category: finalCategory,
        notes,
        startTime: parsedStartTime ? parsedStartTime.toISOString() : new Date().toISOString(),
      });
      onClose();
    } catch (err: any) {
      console.error(err);
      setError("Failed to process task. Please verify parameters and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#0c0b17]"
          />

          {/* Dialog Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="relative bg-bg-surface w-full max-w-lg rounded-[28px] border border-border-custom shadow-2xl overflow-hidden max-h-[90vh] flex flex-col z-10"
          >
            {/* Header */}
            <div className="p-6 border-b border-border-custom flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-accent-primary/10 text-accent-primary rounded-xl">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <h2 className="text-sm font-black text-text-primary tracking-tight uppercase">
                  {editTask ? "Edit Task" : "Create Task"}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-text-muted hover:text-text-primary rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
              {error && (
                <div className="p-3 bg-status-danger/10 border border-status-danger/20 text-status-danger rounded-xl text-xs font-bold">
                  {error}
                </div>
              )}

              {/* 1. Title */}
              <div>
                <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-1.5 ml-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g., Finalize Q3 Operating Budget"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={loading}
                  className="w-full px-4 py-3 border border-border-custom rounded-2xl focus:ring-2 focus:ring-accent-primary/10 focus:border-accent-primary text-sm text-text-primary bg-bg-primary placeholder-text-muted/40 focus:outline-none transition-all font-medium"
                  maxLength={100}
                />
              </div>

              {/* 2. Description */}
              <div>
                <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-1.5 ml-1">
                  Description
                </label>
                <textarea
                  placeholder="Outline the critical details, goals, and deliverables..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={loading}
                  className="w-full px-4 py-3 border border-border-custom rounded-2xl focus:ring-2 focus:ring-accent-primary/10 focus:border-accent-primary text-sm text-text-primary bg-bg-primary placeholder-text-muted/40 focus:outline-none h-24 resize-none transition-all font-medium"
                  maxLength={500}
                />
              </div>

              {/* 3. Category */}
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-1.5 ml-1">
                  Category
                </label>
                <select
                  value={selectedOption}
                  onChange={(e) => {
                    setSelectedOption(e.target.value);
                    if (e.target.value !== "other") {
                      setCustomCategory("");
                    }
                  }}
                  disabled={loading}
                  className="w-full px-4 py-3 border border-border-custom rounded-2xl focus:ring-2 focus:ring-accent-primary/10 focus:border-accent-primary text-sm text-text-primary bg-bg-primary focus:outline-none transition-all font-medium cursor-pointer"
                >
                  <option value="">Select a category</option>
                  {/* Default Categories */}
                  <option value="Study">Study</option>
                  <option value="Work">Work</option>
                  <option value="Fitness">Fitness</option>
                  <option value="Personal">Personal</option>
                  
                  {/* Custom Categories sorted alphabetically under default ones */}
                  {(() => {
                    const DEFAULT_CATEGORIES = ["Study", "Work", "Fitness", "Personal"];
                    const customCats = [...(userCategories || [])];
                    if (editTask && editTask.category && !DEFAULT_CATEGORIES.includes(editTask.category) && !customCats.includes(editTask.category)) {
                      customCats.push(editTask.category);
                    }
                    const sortedCustom = [...customCats]
                      .filter(Boolean)
                      .filter(c => !DEFAULT_CATEGORIES.includes(c))
                      .sort((a, b) => a.localeCompare(b));
                    
                    return sortedCustom.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ));
                  })()}
                  
                  <option value="other">Other (Add Your Own)</option>
                </select>

                {selectedOption === "other" && (
                  <div className="mt-2 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                    <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                      Custom Category
                    </label>
                    <input
                      type="text"
                      placeholder="Enter a new category"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      disabled={loading}
                      maxLength={50}
                      className="w-full px-4 py-3 border border-border-custom rounded-2xl focus:ring-2 focus:ring-accent-primary/10 focus:border-accent-primary text-sm text-text-primary bg-bg-primary placeholder-text-muted/40 focus:outline-none transition-all font-medium"
                    />
                    <p className="text-[10px] text-text-muted ml-1 font-medium">
                      Examples: Research, Music, Freelancing, Business, Travel
                    </p>
                  </div>
                )}
              </div>

              {/* 4. Planned Start Time */}
              <div>
                <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-1.5 ml-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-accent-primary" />
                  Date And Time *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setPickerTarget("startTime");
                    setIsPickerOpen(true);
                  }}
                  disabled={loading}
                  className="w-full px-4 py-3 border border-border-custom rounded-2xl text-sm text-text-primary bg-bg-primary focus:outline-none transition-all text-left flex items-center justify-between hover:bg-bg-hover cursor-pointer font-medium"
                >
                  <span className="truncate">
                    {startTime ? new Date(startTime).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }) : "Select Start Time"}
                  </span>
                  <Calendar className="w-4 h-4 text-accent-primary shrink-0" />
                </button>
              </div>

              {/* 5. Estimated Duration */}
              <div>
                <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-1.5 ml-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-accent-primary" />
                  Estimated Duration
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-1.5 border border-border-custom rounded-2xl px-3 bg-bg-primary">
                    <input
                      type="number"
                      min="0"
                      max="99"
                      placeholder="Hours"
                      value={durationHours}
                      onChange={(e) => setDurationHours(Math.max(0, parseInt(e.target.value) || 0))}
                      disabled={loading}
                      className="w-full py-3 text-sm text-text-primary bg-transparent focus:outline-none text-center font-medium"
                    />
                    <span className="text-xs font-black text-text-muted uppercase tracking-wider">hours</span>
                  </div>
                  <div className="flex-1 flex items-center gap-1.5 border border-border-custom rounded-2xl px-3 bg-bg-primary">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      placeholder="Mins"
                      value={durationMinutes}
                      onChange={(e) => {
                        let m = parseInt(e.target.value) || 0;
                        if (m > 59) m = 59;
                        if (m < 0) m = 0;
                        setDurationMinutes(m);
                      }}
                      disabled={loading}
                      className="w-full py-3 text-sm text-text-primary bg-transparent focus:outline-none text-center font-medium"
                    />
                    <span className="text-xs font-black text-text-muted uppercase tracking-wider">minutes</span>
                  </div>
                </div>
                <p className="text-[10px] text-text-muted mt-2 ml-1 font-medium">
                  Examples: 2 hours, 2 hours 30 minutes, 45 minutes, 1 hour 15 minutes
                </p>
              </div>

              {/* 6. Ask about specific completion deadline */}
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest ml-1 leading-normal">
                  Does this task need to be completed before a specific date or time?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setHasSpecificDeadline(false)}
                    className={`py-3 px-4 text-xs font-black uppercase tracking-wider rounded-2xl border transition-all cursor-pointer text-center ${
                      !hasSpecificDeadline
                        ? "bg-accent-primary/10 text-accent-primary border-accent-primary ring-2 ring-accent-primary/10"
                        : "bg-bg-primary text-text-muted border-border-custom hover:bg-bg-hover"
                    }`}
                  >
                    No
                  </button>
                  <button
                    type="button"
                    onClick={() => setHasSpecificDeadline(true)}
                    className={`py-3 px-4 text-xs font-black uppercase tracking-wider rounded-2xl border transition-all cursor-pointer text-center ${
                      hasSpecificDeadline
                        ? "bg-accent-primary/10 text-accent-primary border-accent-primary ring-2 ring-accent-primary/10"
                        : "bg-bg-primary text-text-muted border-border-custom hover:bg-bg-hover"
                    }`}
                  >
                    Yes
                  </button>
                </div>
              </div>

              {hasSpecificDeadline && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-1.5 ml-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-accent-secondary" />
                      Due Date & Time *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setPickerTarget("deadline");
                        setIsPickerOpen(true);
                      }}
                      disabled={loading}
                      className="w-full px-4 py-3 border border-border-custom rounded-2xl text-sm text-text-primary bg-bg-primary focus:outline-none transition-all text-left flex items-center justify-between hover:bg-bg-hover cursor-pointer font-medium"
                    >
                      <span className="truncate">
                        {(() => {
                          const d = safeDate(deadline);
                          return d ? d.toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }) : "Select Date & Time";
                        })()}
                      </span>
                      <Calendar className="w-4 h-4 text-accent-secondary shrink-0" />
                    </button>
                  </div>

                  {/* Scheduling comparison / conflict validation */}
                  {(() => {
                    const startD = safeDate(startTime);
                    const endD = safeDate(deadline);
                    if (!startD || !endD) return null;
                    
                    const calculatedExpectedCompletionDate = new Date(startD.getTime() + (durationHours * 60 + durationMinutes) * 60 * 1000);
                    const isWithinDeadline = calculatedExpectedCompletionDate.getTime() <= endD.getTime();

                    return (
                      <div className="space-y-2 p-3 bg-bg-primary/50 border border-border-custom rounded-2xl">
                        <div className="text-[10px] text-text-muted font-bold">
                          Calculated Completion Time: <span className="text-accent-primary font-mono">{calculatedExpectedCompletionDate.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</span>
                        </div>
                        {isWithinDeadline ? (
                          <div className="text-xs font-bold text-status-success">
                            ✓ This task can be completed before the deadline.
                          </div>
                        ) : (
                          <div className="text-xs font-bold text-status-danger leading-normal">
                            ⚠ Based on your planned start time and estimated duration, this task may not finish before the specified deadline.
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-1.5 ml-1">
                  Notes
                </label>
                <textarea
                  placeholder="Additional thoughts, reference links, draft scribbles..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={loading}
                  className="w-full px-4 py-3 border border-border-custom rounded-2xl focus:ring-2 focus:ring-accent-primary/10 focus:border-accent-primary text-sm text-text-primary bg-bg-primary placeholder-text-muted/40 focus:outline-none h-20 resize-none transition-all font-medium"
                  maxLength={500}
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 ml-1 flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5" />
                  Priority
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(["low", "medium", "high", "urgent"] as const).map((p) => {
                    const activeStyles = {
                      low: "bg-bg-hover text-text-primary border-accent-primary ring-2 ring-accent-primary/10",
                      medium: "bg-accent-primary/10 text-accent-primary border-accent-primary ring-2 ring-accent-primary/10",
                      high: "bg-status-warning/10 text-status-warning border-status-warning ring-2 ring-status-warning/10",
                      urgent: "bg-status-danger/10 text-status-danger border-status-danger ring-2 ring-status-danger/10",
                    }[p];

                    const labels = {
                      low: "Low",
                      medium: "Medium",
                      high: "High",
                      urgent: "Critical",
                    };

                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        disabled={loading}
                        className={`py-2.5 text-[10px] font-black uppercase tracking-wider rounded-2xl border transition-all cursor-pointer text-center ${
                          priority === p
                            ? activeStyles
                            : "bg-bg-primary text-text-muted border-border-custom hover:bg-bg-hover"
                        }`}
                      >
                        {labels[p]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-6 border-t border-border-custom flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-6 py-2.5 text-xs font-black text-text-muted hover:text-text-primary rounded-2xl hover:bg-bg-hover transition-all cursor-pointer uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-accent-primary hover:bg-accent-primary/90 text-white text-xs font-black rounded-2xl transition-all cursor-pointer flex items-center gap-2 min-w-[140px] justify-center shadow-lg shadow-accent-primary/10 uppercase tracking-widest"
                >
                  {loading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : editTask ? (
                    "Save Changes"
                  ) : (
                    "Create Task"
                  )}
                </button>
              </div>
            </form>
          </motion.div>

          {/* Custom Date/Time Picker Modal Overlay */}
          <AnimatePresence>
            {isPickerOpen && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
                {/* Backdrop click to cancel/close */}
                <div className="absolute inset-0" onClick={() => setIsPickerOpen(false)} />
                
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="relative bg-bg-surface border border-border-custom shadow-2xl rounded-[28px] w-full max-w-sm overflow-hidden p-6 space-y-4 z-10"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-border-custom pb-4">
                    <h3 className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-accent-primary" />
                      {pickerTarget === "deadline" ? "Select Due Date & Time" : "Select Planned Start Time"}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsPickerOpen(false)}
                      className="text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Date Selector */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-sm font-bold text-text-primary">
                        {getMonthName(pickerDate)} {pickerDate.getFullYear()}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const newD = new Date(pickerDate);
                            newD.setMonth(newD.getMonth() - 1);
                            setPickerDate(newD);
                          }}
                          className="p-1.5 hover:bg-bg-hover rounded-lg text-text-muted hover:text-text-primary transition-colors cursor-pointer text-xs font-black"
                        >
                          &larr;
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const newD = new Date(pickerDate);
                            newD.setMonth(newD.getMonth() + 1);
                            setPickerDate(newD);
                          }}
                          className="p-1.5 hover:bg-bg-hover rounded-lg text-text-muted hover:text-text-primary transition-colors cursor-pointer text-xs font-black"
                        >
                          &rarr;
                        </button>
                      </div>
                    </div>

                    {/* Day Labels */}
                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black text-text-muted uppercase tracking-widest opacity-50">
                      {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                        <div key={d} className="py-1">{d}</div>
                      ))}
                    </div>

                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 gap-1">
                      {getDaysInMonth(pickerDate).map((day) => {
                        const isSelected =
                          day.isCurrentMonth &&
                          day.dateObj.getDate() === pickerDate.getDate() &&
                          day.dateObj.getMonth() === pickerDate.getMonth() &&
                          day.dateObj.getFullYear() === pickerDate.getFullYear();
                        
                        return (
                          <button
                            key={day.key}
                            type="button"
                            onClick={() => {
                              if (day.isCurrentMonth) {
                                const newD = new Date(pickerDate);
                                newD.setDate(day.dateObj.getDate());
                                newD.setMonth(day.dateObj.getMonth());
                                newD.setFullYear(day.dateObj.getFullYear());
                                setPickerDate(newD);
                              }
                            }}
                            disabled={!day.isCurrentMonth}
                            className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                              !day.isCurrentMonth
                                ? "text-text-muted/10 pointer-events-none"
                                : isSelected
                                ? "bg-accent-primary text-white shadow-md shadow-accent-primary/20"
                                : "text-text-primary hover:bg-bg-hover"
                            }`}
                          >
                            {day.dateObj.getDate()}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Time Selector */}
                  <div className="border-t border-border-custom pt-4 space-y-3">
                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest block mb-1">Time Selection</span>
                    <div className="flex items-center gap-2">
                      {/* Hour Select */}
                      <div className="flex-1 flex flex-col">
                        <select
                          value={pickerHour}
                          onChange={(e) => setPickerHour(parseInt(e.target.value))}
                          className="px-3 py-2 border border-border-custom rounded-xl text-xs bg-bg-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/10 font-bold"
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                            <option key={h} value={h}>{String(h).padStart(2, '0')}</option>
                          ))}
                        </select>
                      </div>
                      <span className="text-text-muted font-bold">:</span>
                      {/* Minute Select */}
                      <div className="flex-1 flex flex-col">
                        <select
                          value={pickerMinute}
                          onChange={(e) => setPickerMinute(parseInt(e.target.value))}
                          className="px-3 py-2 border border-border-custom rounded-xl text-xs bg-bg-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/10 font-bold"
                        >
                          {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                            <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                          ))}
                        </select>
                      </div>
                      {/* AM / PM Select */}
                      <div className="flex-1 flex flex-col">
                        <select
                          value={pickerAmpm}
                          onChange={(e) => setPickerAmpm(e.target.value as "AM" | "PM")}
                          className="px-3 py-2 border border-border-custom rounded-xl text-xs bg-bg-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/10 font-bold"
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="flex items-center justify-end gap-3 border-t border-border-custom pt-4">
                    <button
                      type="button"
                      onClick={() => setIsPickerOpen(false)}
                      className="px-4 py-2 text-xs font-black text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-xl transition-all cursor-pointer uppercase tracking-wider"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmPicker}
                      className="px-5 py-2 bg-accent-primary hover:bg-accent-primary/90 text-white text-xs font-black rounded-xl transition-all cursor-pointer shadow-md uppercase tracking-widest"
                    >
                      Confirm
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}
    </AnimatePresence>
  );
};
