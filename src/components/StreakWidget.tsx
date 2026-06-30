import React, { useState, useEffect } from "react";
import { Task, calculateStreak } from "../types";
import { Flame, Info } from "lucide-react";
import { motion } from "motion/react";

interface StreakWidgetProps {
  tasks: Task[];
}

export const StreakWidget: React.FC<StreakWidgetProps> = ({ tasks }) => {
  const streak = calculateStreak(tasks);
  const [prevStreak, setPrevStreak] = useState(streak);
  const [isPulsing, setIsPulsing] = useState(false);

  useEffect(() => {
    if (streak > prevStreak) {
      setIsPulsing(true);
      const timer = setTimeout(() => setIsPulsing(false), 1000);
      return () => clearTimeout(timer);
    }
    setPrevStreak(streak);
  }, [streak, prevStreak]);

  return (
    <div className="flex items-center justify-between bg-bg-surface border border-border-custom rounded-2xl px-3 sm:px-4 h-[52px] sm:h-[58px] w-full sm:w-[240px] shadow-sm hover:shadow-md transition-shadow relative select-none shrink-0">
      <div className="flex items-center gap-2.5">
        <motion.div
          animate={isPulsing ? { scale: [1, 1.35, 1] } : {}}
          transition={{ duration: 0.5 }}
          className="p-1 sm:p-1.5 bg-accent-primary/10 rounded-lg sm:rounded-xl text-accent-primary flex items-center justify-center border border-accent-primary/25"
        >
          <Flame className="w-4 h-4 sm:w-5 h-5 fill-accent-primary/20" />
        </motion.div>
        <div className="flex flex-col">
          <span className="text-[9px] sm:text-[10px] font-black text-text-muted uppercase tracking-wider leading-none">
            Productivity Streak
          </span>
          <span className="text-xs sm:text-sm font-black text-text-primary mt-1 leading-none font-mono flex items-center gap-1">
            {streak} {streak === 1 ? "Day" : "Days"}
          </span>
        </div>
      </div>
      
      {/* Info Tooltip Icon */}
      <div className="relative group">
        <button className="p-1 text-text-muted hover:text-text-primary rounded-lg transition-colors cursor-help">
          <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>
        
        {/* Tooltip Card */}
        <div className="absolute right-0 top-full mb-2 w-[220px] sm:w-[250px] bg-bg-surface border border-border-custom p-3 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-left">
          <div className="flex items-center gap-1.5 mb-2 border-b border-border-custom pb-1.5">
            <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-accent-primary fill-accent-primary/20 animate-pulse" />
            <span className="text-[9px] sm:text-[10px] font-black text-text-primary uppercase tracking-wider">
              Streak Rules
            </span>
          </div>
          <div className="space-y-1.5 text-[10px] font-bold text-text-muted leading-relaxed">
            <p>• Complete at least one task every calendar day to keep your streak alive.</p>
            <p>• Missing an entire day without completing any task resets your streak.</p>
            <p>• Only one completed task per day contributes to your streak.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
