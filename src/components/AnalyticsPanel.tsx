import React, { useState, useEffect, useRef } from "react";
import { Task, calculateProductivityScore, getDerivedStatus } from "../types";
import { 
  Clipboard, 
  AlertTriangle, 
  CheckCircle2, 
  Star, 
  Activity,
  Info,
  Flame,
  TrendingUp,
  TrendingDown,
  Sparkles,
  X,
  Award,
  CheckSquare,
  Clock,
  Calendar,
  Zap
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { safeDate } from "../lib/dateUtils";

interface AnalyticsPanelProps {
  tasks: Task[];
  productivityScore?: number;
  userName?: string;
  onTasksCompletedClick?: () => void;
  onPendingTasksClick?: () => void;
  onPassedDeadlinesClick?: () => void;
}

// FIRST SECTION: Analytics Panel (Four equal-sized cards)
export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({
  tasks,
  userName,
  onTasksCompletedClick,
  onPendingTasksClick,
  onPassedDeadlinesClick,
}) => {
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 15000); // Automatically update every 15 seconds to react to local time changes
    return () => clearInterval(interval);
  }, []);

  const getGreetingAndSubtitle = () => {
    const hour = currentTime.getHours();
    let greeting = "";
    let subtitle = "";

    if (hour >= 5 && hour < 12) {
      greeting = userName ? `Good Morning, ${userName}` : "Good Morning";
      subtitle = "Let's finish today's objectives.";
    } else if (hour >= 12 && hour < 17) {
      greeting = userName ? `Good Afternoon, ${userName}` : "Good Afternoon";
      subtitle = "Keep the momentum going.";
    } else if (hour >= 17 && hour < 21) {
      greeting = userName ? `Good Evening, ${userName}` : "Good Evening";
      subtitle = "Let's wrap up today's goals.";
    } else {
      greeting = userName ? `Good Night, ${userName}` : "Good Night";
      subtitle = "Plan today, conquer tomorrow.";
    }

    return { greeting, subtitle };
  };

  const { greeting: greetingText, subtitle: subtitleText } = getGreetingAndSubtitle();

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

  const completedTasks = tasks.filter((t) => getDerivedStatus(t) === "completed");
  const pendingTasks = tasks.filter((t) => getDerivedStatus(t) === "pending");
  const overdueTasks = tasks.filter((t) => getDerivedStatus(t) === "overdue");

  const completedCount = completedTasks.length;
  const pendingCount = pendingTasks.length;
  const overdueCount = overdueTasks.length;
  const totalCount = tasks.length;

  const dueTodayTasks = tasks.filter((t) => t.status !== "completed" && t.deadline && isToday(t.deadline));
  const dueTodayCount = dueTodayTasks.length;

  // Calculate dynamic productivity score
  const prod = calculateProductivityScore(tasks);

  // States for score change animation
  const [displayScore, setDisplayScore] = useState(prod.score);
  const [scoreDelta, setScoreDelta] = useState<number | null>(null);

  useEffect(() => {
    if (prod.score !== displayScore) {
      const diff = prod.score - displayScore;
      setScoreDelta(diff);
      
      const duration = 800; // ms
      const startTime = performance.now();
      
      let animationFrameId: number;
      
      const animate = (time: number) => {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Easing function: easeOutQuad
        const ease = progress * (2 - progress);
        const current = Math.round(displayScore + diff * ease);
        setDisplayScore(current);
        
        if (progress < 1) {
          animationFrameId = requestAnimationFrame(animate);
        } else {
          setDisplayScore(prod.score);
          setTimeout(() => {
            setScoreDelta(null);
          }, 3000);
        }
      };
      
      animationFrameId = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(animationFrameId);
    }
  }, [prod.score]);

  // Track dynamic change history
  const prevTasksRef = useRef<Task[]>(tasks);
  const [changeHistory, setChangeHistory] = useState<{
    from: number;
    to: number;
    reasons: string[];
  } | null>(null);

  useEffect(() => {
    const prevTasks = prevTasksRef.current;
    if (prevTasks && prevTasks !== tasks && tasks.length > 0 && prevTasks.length > 0) {
      const prevProd = calculateProductivityScore(prevTasks);
      const currProd = calculateProductivityScore(tasks);
      
      if (currProd.score !== prevProd.score) {
        const reasons: string[] = [];
        
        tasks.forEach(task => {
          const prevTask = prevTasks.find(t => t.id === task.id);
          if (task.status === "completed" && (!prevTask || prevTask.status === "pending")) {
            const points = task.priority === "urgent" || task.priority === "high" ? 4 : task.priority === "medium" ? 3 : 2;
            reasons.push(`+${points} Completed "${task.title}"`);
          } else if (task.status === "pending" && prevTask?.status === "completed") {
            const points = task.priority === "urgent" || task.priority === "high" ? 4 : task.priority === "medium" ? 3 : 2;
            reasons.push(`-${points} Reopened "${task.title}"`);
          }
        });
        
        const prevStreak = prevProd.summaryStats.streakCount;
        const currStreak = currProd.summaryStats.streakCount;
        if (currStreak > prevStreak) {
          reasons.push(`+${(currStreak - prevStreak) * 3} Maintained Daily Streak`);
        } else if (currStreak < prevStreak) {
          reasons.push(`-${(prevStreak - currStreak) * 3} Streak Decreased`);
        }
        
        if (reasons.length === 0) {
          const diff = currProd.score - prevProd.score;
          reasons.push(`${diff > 0 ? "+" : ""}${diff} General Productivity Progress`);
        }
        
        setChangeHistory({
          from: prevProd.score,
          to: currProd.score,
          reasons
        });
      }
    }
    prevTasksRef.current = tasks;
  }, [tasks]);

  return (
    <div id="analytics-panel" className="space-y-4 w-full">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-accent-primary shrink-0" />
          <h2 className="text-xl md:text-2xl font-black text-text-primary tracking-tight muted leading-tight">
            {greetingText}
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-text-muted font-medium pl-7">
          {subtitleText}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full">
        {/* Card 1: Productivity Score (Interactive) */}
        <motion.div
          whileHover={{ scale: 1.025, y: -2 }}
          whileTap={{ scale: 0.975 }}
          onClick={() => setIsDetailsModalOpen(true)}
          className="bg-bg-surface p-3 sm:p-4 rounded-2xl border border-border-custom flex items-center justify-between h-[112px] sm:h-[130px] shadow-sm hover:border-accent-primary/45 hover:shadow-lg hover:shadow-accent-primary/5 transition-colors group duration-300 cursor-pointer relative overflow-hidden select-none"
        >
          {/* Circular Progress Ring on Left */}
          <div className="relative w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center shrink-0">
            <svg className="w-full h-full transform -rotate-90">
              {/* Background ring */}
              <circle
                cx="50%"
                cy="50%"
                r="35%"
                className="stroke-border-custom"
                strokeWidth="5"
                fill="transparent"
              />
              {/* Animated Foreground ring */}
              <circle
                cx="50%"
                cy="50%"
                r="35%"
                className="stroke-accent-primary transition-all duration-700 ease-out"
                strokeWidth="5"
                fill="transparent"
                strokeDasharray="154"
                strokeDashoffset={154 - (displayScore / 100) * 154}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xs sm:text-sm font-black text-text-primary font-mono leading-none">
                {displayScore}%
              </span>
            </div>
            
            {/* Smooth Delta badge (+X or -X) overlay */}
            <AnimatePresence>
              {scoreDelta !== null && scoreDelta !== 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.8 }}
                  className={`absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-[8px] sm:text-[9px] font-black font-mono shadow-sm z-10 border ${
                    scoreDelta > 0
                      ? "bg-status-success/15 text-status-success border-status-success/25"
                      : "bg-status-danger/15 text-status-danger border-status-danger/25"
                  }`}
                >
                  {scoreDelta > 0 ? `+${scoreDelta}` : scoreDelta}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Information Details */}
          <div className="flex-1 min-w-0 h-full flex flex-col justify-between pl-3 sm:pl-3.5">
            <div className="flex items-start justify-between min-w-0">
              <div className="min-w-0">
                <span className="text-[9px] sm:text-[10px] font-bold text-text-muted block uppercase tracking-wider leading-tight">
                  Productivity Score
                </span>
                <span className={`text-[11px] sm:text-xs font-black block mt-0.5 sm:mt-1 truncate ${
                  prod.score >= 85 ? "text-accent-primary" : prod.score >= 50 ? "text-text-primary" : "text-text-secondary"
                }`}>
                  {prod.performance} {prod.rating}
                </span>
              </div>
              <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-text-muted group-hover:text-accent-primary transition-colors shrink-0 ml-1 mt-0.5" />
            </div>

            <div className="flex items-center justify-between mt-1 sm:mt-1.5">
              <span className={`inline-flex items-center gap-1 text-[8px] sm:text-[10px] font-extrabold px-1.5 sm:px-2 py-0.5 rounded-lg border leading-tight ${
                prod.weeklyTrend.diff > 0
                  ? "bg-status-success/10 text-status-success border-status-success/15"
                  : prod.weeklyTrend.diff < 0
                  ? "bg-status-danger/10 text-status-danger border-status-danger/15"
                  : "bg-bg-primary text-text-muted border-border-custom"
              }`}>
                {prod.weeklyTrend.text}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Card 2: Tasks Completed */}
        <motion.div
          whileHover={{ scale: 1.025, y: -2 }}
          whileTap={{ scale: 0.975 }}
          onClick={onTasksCompletedClick}
          className="bg-bg-surface p-3.5 sm:p-5 rounded-2xl border border-border-custom flex flex-col justify-between h-[112px] sm:h-[130px] shadow-sm hover:border-status-success/45 hover:shadow-lg hover:shadow-status-success/5 transition-colors group duration-300 cursor-pointer"
        >
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0">
              <span className="text-xl sm:text-2xl font-black text-text-primary block leading-none font-mono truncate">
                {completedCount}
              </span>
              <span className="text-[9px] sm:text-[10px] font-bold text-text-muted block mt-1.5 uppercase tracking-wider truncate">
                Tasks Completed
              </span>
            </div>
            <div className="p-1.5 sm:p-2.5 bg-status-success/10 rounded-lg sm:rounded-xl text-status-success group-hover:scale-105 transition-transform duration-300 shrink-0">
              <CheckCircle2 className="w-4 h-4 sm:w-5 h-5" />
            </div>
          </div>
          <span className="text-[9px] sm:text-[10px] font-extrabold text-status-success uppercase tracking-wide truncate">
            {totalCount > 0 ? `${Math.round((completedCount / totalCount) * 100)}% Success rate` : "0% completion"}
          </span>
        </motion.div>

        {/* Card 3: Pending Tasks */}
        <motion.div
          whileHover={{ scale: 1.025, y: -2 }}
          whileTap={{ scale: 0.975 }}
          onClick={onPendingTasksClick}
          className="bg-bg-surface p-3.5 sm:p-5 rounded-2xl border border-border-custom flex flex-col justify-between h-[112px] sm:h-[130px] shadow-sm hover:border-accent-secondary/45 hover:shadow-lg hover:shadow-accent-secondary/5 transition-colors group duration-300 cursor-pointer"
        >
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0">
              <span className="text-xl sm:text-2xl font-black text-text-primary block leading-none font-mono truncate">
                {pendingCount}
              </span>
              <span className="text-[9px] sm:text-[10px] font-bold text-text-muted block mt-1.5 uppercase tracking-wider truncate">
                Pending Tasks
              </span>
            </div>
            <div className="p-1.5 sm:p-2.5 bg-accent-secondary/10 rounded-lg sm:rounded-xl text-accent-secondary group-hover:scale-105 transition-transform duration-300 shrink-0">
              <Clipboard className="w-4 h-4 sm:w-5 h-5" />
            </div>
          </div>
          <span className="text-[9px] sm:text-[10px] font-extrabold text-text-muted uppercase tracking-wide truncate">
            {overdueCount > 0 ? `${overdueCount} critical overdue` : "Queue is fully stable"}
          </span>
        </motion.div>

        {/* Card 4: Passed Deadlines */}
        <motion.div
          whileHover={{ scale: 1.025, y: -2 }}
          whileTap={{ scale: 0.975 }}
          onClick={onPassedDeadlinesClick}
          className="bg-bg-surface p-3.5 sm:p-5 rounded-2xl border border-border-custom flex flex-col justify-between h-[112px] sm:h-[130px] shadow-sm hover:border-status-warning/45 hover:shadow-lg hover:shadow-status-warning/5 transition-colors group duration-300 cursor-pointer"
        >
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0">
              <span className="text-xl sm:text-2xl font-black text-text-primary block leading-none font-mono truncate">
                {overdueCount}
              </span>
              <span className="text-[9px] sm:text-[10px] font-bold text-text-muted block mt-1.5 uppercase tracking-wider truncate">
                Passed Deadlines
              </span>
            </div>
            <div className="p-1.5 sm:p-2.5 bg-status-warning/10 rounded-lg sm:rounded-xl text-status-warning group-hover:scale-105 transition-transform duration-300 shrink-0">
              <AlertTriangle className="w-4 h-4 sm:w-5 h-5" />
            </div>
          </div>
          <span className="text-[9px] sm:text-[10px] font-extrabold text-status-warning uppercase tracking-wide truncate">
            {overdueCount > 0 ? "Action required" : "No overdue items"}
          </span>
        </motion.div>
      </div>

      {/* Productivity Score Insights Modal */}
      <AnimatePresence>
        {isDetailsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDetailsModalOpen(false)}
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
                  <Award className="w-5 h-5 text-accent-primary" />
                  <div>
                    <h3 className="text-sm font-black text-text-primary tracking-tight uppercase">
                      Productivity Insights
                    </h3>
                    <p className="text-[10px] text-text-muted font-bold tracking-wide">
                      Real-time weighted performance metrics
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="p-1.5 hover:bg-bg-primary rounded-xl text-text-muted hover:text-text-primary transition-all cursor-pointer border border-transparent hover:border-border-custom"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="overflow-y-auto p-5 sm:p-6 space-y-5">
                {/* Score Summary Display */}
                <div className="flex items-center gap-4 bg-bg-primary/45 p-4 rounded-2xl border border-border-custom/60">
                  {/* Large Circular Ring */}
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center shrink-0">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="50%"
                        cy="50%"
                        r="35%"
                        className="stroke-border-custom/40"
                        strokeWidth="6"
                        fill="transparent"
                      />
                      <circle
                        cx="50%"
                        cy="50%"
                        r="35%"
                        className="stroke-accent-primary transition-all duration-1000 ease-out"
                        strokeWidth="6"
                        fill="transparent"
                        strokeDasharray="176"
                        strokeDashoffset={176 - (prod.score / 100) * 176}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-base sm:text-lg font-black text-text-primary font-mono leading-none">
                        {prod.score}%
                      </span>
                    </div>
                  </div>

                  {/* Rating description */}
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] font-black text-text-muted uppercase tracking-widest block">
                      Productivity Level
                    </span>
                    <h4 className="text-lg sm:text-xl font-black text-text-primary leading-tight mt-0.5">
                      {prod.performance} {prod.rating}
                    </h4>
                    <div className="flex items-center gap-1.5 mt-1">
                      {prod.weeklyTrend.diff > 0 ? (
                        <TrendingUp className="w-3.5 h-3.5 text-status-success" />
                      ) : prod.weeklyTrend.diff < 0 ? (
                        <TrendingDown className="w-3.5 h-3.5 text-status-danger" />
                      ) : (
                        <Zap className="w-3.5 h-3.5 text-text-muted" />
                      )}
                      <span className="text-[10px] font-extrabold text-text-secondary">
                        {prod.weeklyTrend.text}
                      </span>
                    </div>
                  </div>
                </div>

                {/* AI Productivity Coach Section */}
                <div className="bg-accent-primary/5 border border-accent-primary/10 rounded-2xl p-4 flex items-start gap-3">
                  <div className="p-1.5 bg-accent-primary/10 text-accent-primary rounded-xl shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4 text-accent-primary animate-pulse" />
                  </div>
                  <div>
                    <span className="text-[8px] font-black text-accent-primary uppercase tracking-[0.2em] block mb-0.5">
                      AI Coach Recommendation
                    </span>
                    <p className="text-xs text-text-primary leading-relaxed font-bold">
                      {prod.coachMessage}
                    </p>
                  </div>
                </div>

                {/* Weighted Contribution Breakdown */}
                <div className="space-y-3.5">
                  <span className="text-[9px] font-black text-text-muted uppercase tracking-widest block">
                    Weighted Score Contribution
                  </span>
                  
                  <div className="space-y-3 bg-bg-primary/25 p-4 rounded-2xl border border-border-custom/40">
                    {/* Completion rate */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-extrabold text-text-primary">
                        <span>Task Completion Rate</span>
                        <span className="font-mono text-accent-primary">{prod.breakdown.completionRate} <span className="text-text-muted text-[10px]">/ 40 pts</span></span>
                      </div>
                      <div className="h-1.5 w-full bg-border-custom/40 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-accent-primary transition-all duration-1000 ease-out"
                          style={{ width: `${(prod.breakdown.completionRate / 40) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* On-Time Completion */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-extrabold text-text-primary">
                        <span>On-Time Completion</span>
                        <span className="font-mono text-accent-primary">{prod.breakdown.onTimeCompletion} <span className="text-text-muted text-[10px]">/ 25 pts</span></span>
                      </div>
                      <div className="h-1.5 w-full bg-border-custom/40 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-accent-primary transition-all duration-1000 ease-out"
                          style={{ width: `${(prod.breakdown.onTimeCompletion / 25) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Daily Streak */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-extrabold text-text-primary">
                        <span>Daily Streak</span>
                        <span className="font-mono text-accent-primary">{prod.breakdown.streak} <span className="text-text-muted text-[10px]">/ 15 pts</span></span>
                      </div>
                      <div className="h-1.5 w-full bg-border-custom/40 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-accent-primary transition-all duration-1000 ease-out"
                          style={{ width: `${(prod.breakdown.streak / 15) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* High Priority */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-extrabold text-text-primary">
                        <span>High Priority Completed</span>
                        <span className="font-mono text-accent-primary">{prod.breakdown.priorityBonus} <span className="text-text-muted text-[10px]">/ 10 pts</span></span>
                      </div>
                      <div className="h-1.5 w-full bg-border-custom/40 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-accent-primary transition-all duration-1000 ease-out"
                          style={{ width: `${(prod.breakdown.priorityBonus / 10) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Weekly Consistency */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-extrabold text-text-primary">
                        <span>Weekly Consistency</span>
                        <span className="font-mono text-accent-primary">{prod.breakdown.weeklyConsistency} <span className="text-text-muted text-[10px]">/ 10 pts</span></span>
                      </div>
                      <div className="h-1.5 w-full bg-border-custom/40 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-accent-primary transition-all duration-1000 ease-out"
                          style={{ width: `${(prod.breakdown.weeklyConsistency / 10) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Today's Impact */}
                <div className="space-y-2">
                  <span className="text-[9px] font-black text-text-muted uppercase tracking-widest block">
                    Today's Impact
                  </span>
                  <div className="p-4 bg-bg-primary/25 border border-border-custom/40 rounded-2xl">
                    {prod.todayImpact.points > 0 ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-status-success font-mono bg-status-success/10 px-2 py-0.5 rounded-lg">
                            +{prod.todayImpact.points} points
                          </span>
                          <span className="text-[10px] text-text-muted font-bold">earned today</span>
                        </div>
                        <div className="space-y-1 pl-1">
                          <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">Completed Tasks:</span>
                          {prod.todayImpact.completedTitles.map((title, idx) => (
                            <div key={idx} className="flex items-start gap-1.5 text-xs font-semibold text-text-primary">
                              <span className="text-status-success mt-0.5">✓</span>
                              <span>{title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-text-muted font-medium">
                        No completed tasks today. Complete a task to generate points and increase your score!
                      </p>
                    )}
                  </div>
                </div>

                {/* Score Change History */}
                <div className="space-y-2">
                  <span className="text-[9px] font-black text-text-muted uppercase tracking-widest block">
                    Score Event History
                  </span>
                  <div className="p-4 bg-bg-primary/25 border border-border-custom/40 rounded-2xl">
                    {changeHistory ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-[11px] font-black text-text-secondary uppercase tracking-wide">
                          <span>Previous Score {changeHistory.from}%</span>
                          <span>→</span>
                          <span className="text-accent-primary">New Score {changeHistory.to}%</span>
                        </div>
                        <div className="space-y-1.5 pl-1">
                          {changeHistory.reasons.map((reason, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs font-bold text-text-primary">
                              <span className={`w-1.5 h-1.5 rounded-full ${reason.startsWith("-") ? "bg-status-danger" : "bg-status-success"}`} />
                              <span>{reason}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-text-muted font-medium">
                        No recent score adjustment events. Complete tasks or maintain streaks to record new actions!
                      </p>
                    )}
                  </div>
                </div>

                {/* Suggestions List */}
                <div className="space-y-2.5">
                  <span className="text-[9px] font-black text-text-muted uppercase tracking-widest block">
                    Optimization Suggestions
                  </span>
                  <div className="space-y-2 pl-1">
                    {prod.suggestions.map((suggestion, index) => (
                      <div key={index} className="flex items-start gap-2 text-xs font-bold text-text-primary leading-relaxed">
                        <span className="text-accent-primary mt-0.5 shrink-0">•</span>
                        <span>{suggestion.replace(/^\s*•\s*/, "")}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Score Contribution Underneath Stats Grid */}
                <div className="grid grid-cols-2 gap-2 sm:gap-2.5 pt-1.5">
                  <div className="p-3 bg-bg-primary/25 rounded-2xl border border-border-custom/40 text-center">
                    <span className="text-[9px] font-black text-text-muted uppercase tracking-wider block">Completed</span>
                    <span className="text-xs font-black text-text-primary block mt-0.5">✔ {prod.summaryStats.completedCount} Tasks</span>
                  </div>
                  <div className="p-3 bg-bg-primary/25 rounded-2xl border border-border-custom/40 text-center">
                    <span className="text-[9px] font-black text-text-muted uppercase tracking-wider block">Overdue</span>
                    <span className={`text-xs font-black block mt-0.5 ${prod.summaryStats.overdueCount > 0 ? "text-status-danger" : "text-text-primary"}`}>⚠ {prod.summaryStats.overdueCount} Tasks</span>
                  </div>
                  <div className="p-3 bg-bg-primary/25 rounded-2xl border border-border-custom/40 text-center">
                    <span className="text-[9px] font-black text-text-muted uppercase tracking-wider block">Streak</span>
                    <span className="text-xs font-black text-text-primary block mt-0.5">🔥 {prod.summaryStats.streakCount} Days</span>
                  </div>
                  <div className="p-3 bg-bg-primary/25 rounded-2xl border border-border-custom/40 text-center">
                    <span className="text-[9px] font-black text-text-muted uppercase tracking-wider block">On-Time Completion</span>
                    <span className="text-xs font-black text-text-primary block mt-0.5">🎯 {prod.summaryStats.onTimeRate}% Rate</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

