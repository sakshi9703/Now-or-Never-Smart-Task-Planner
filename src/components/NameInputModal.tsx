import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, User } from "lucide-react";

interface NameInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
  title: string;
  subtitle: string;
}

export const NameInputModal: React.FC<NameInputModalProps> = ({ isOpen, onClose, onSubmit, title, subtitle }) => {
  const [name, setName] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName("");
      setError(false);
      // Focus input
      setTimeout(() => {
        const input = document.getElementById("name-input");
        if (input) input.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(true);
      return;
    }
    onSubmit(name.trim());
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="bg-bg-surface w-full max-w-sm rounded-[28px] border border-border-custom shadow-2xl p-6 space-y-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-text-primary tracking-tight">{title}</h2>
              <button onClick={onClose} className="p-1 text-text-muted hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">{subtitle}</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <input
                  id="name-input"
                  type="text"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError(false);
                  }}
                  className={`w-full px-4 py-3 border ${error ? "border-status-danger" : "border-border-custom"} rounded-2xl focus:ring-2 focus:ring-accent-primary/10 focus:border-accent-primary text-sm text-text-primary bg-bg-primary focus:outline-none transition-all font-medium`}
                />
                {error && <p className="text-[10px] text-status-danger mt-1.5 ml-1 font-bold">Name cannot be empty.</p>}
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-3 bg-bg-hover text-text-secondary text-xs font-bold rounded-2xl hover:bg-border-custom transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-accent-primary text-white text-xs font-black rounded-2xl hover:bg-accent-primary/90 transition-all shadow-md shadow-accent-primary/10"
                >
                  Start
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
