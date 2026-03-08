"use client";

import React from "react";
import { AlertState } from "@/lib/priceAlerts";
import { Bell, X } from "lucide-react";

interface PriceAlertBannerProps {
  alert: AlertState;
  onDismiss: () => void;
}

function PriceAlertBanner({
  alert,
  onDismiss,
}: PriceAlertBannerProps) {
  const isCheap = alert.type === "cheap";
  const bgClass = isCheap
    ? "from-green-500/15 to-green-600/5 border-green-500/30"
    : "from-red-500/15 to-red-600/5 border-red-500/30";
  const textClass = isCheap ? "text-green-300" : "text-red-300";
  const iconClass = isCheap ? "text-green-400" : "text-red-400";

  return (
    <div
      className={`bg-gradient-to-r ${bgClass} border rounded-2xl px-4 py-3 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300`}
      role="alert"
    >
      <div className="flex items-center gap-3 min-w-0">
        <Bell className={`w-5 h-5 ${iconClass} shrink-0`} />
        <p className={`${textClass} text-sm font-medium truncate`}>
          {alert.message}
        </p>
      </div>
      <button
        onClick={onDismiss}
        className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0 p-1 rounded-lg hover:bg-zinc-800/50"
        aria-label="Dismiss alert"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default React.memo(PriceAlertBanner);
