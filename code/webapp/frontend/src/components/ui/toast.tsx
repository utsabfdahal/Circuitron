import React, { useState, useEffect } from "react";
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, toast.duration || 4000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  const getIcon = () => {
    switch (toast.type) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case "info":
        return <Info className="w-4 h-4 text-blue-600" />;
    }
  };

  const getBackgroundColor = () => {
    switch (toast.type) {
      case "success":
        return "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800";
      case "error":
        return "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800";
      case "warning":
        return "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800";
      case "info":
        return "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800";
    }
  };

  return (
    <div
      className={`flex items-center gap-2 p-3 rounded-lg border ${getBackgroundColor()} shadow-lg animate-in slide-in-from-top-2 duration-300`}
    >
      {getIcon()}
      <span className="text-sm font-medium flex-1">{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        className="p-1 hover:bg-black/10 rounded-md transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onRemove,
}) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
};
