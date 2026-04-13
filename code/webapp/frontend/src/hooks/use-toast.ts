import { useState, useCallback } from "react";
import { Toast, ToastType } from "@/components/ui/toast";

export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (message: string, type: ToastType = "info", duration?: number) => {
      const id = Math.random().toString(36).substr(2, 9);
      const newToast: Toast = {
        id,
        message,
        type,
        duration,
      };

      setToasts((prev) => [...prev, newToast]);
      return id;
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const toast = {
    success: (message: string, duration?: number) =>
      addToast(message, "success", duration),
    error: (message: string, duration?: number) =>
      addToast(message, "error", duration),
    warning: (message: string, duration?: number) =>
      addToast(message, "warning", duration),
    info: (message: string, duration?: number) =>
      addToast(message, "info", duration),
  };

  return {
    toasts,
    toast,
    removeToast,
  };
};
