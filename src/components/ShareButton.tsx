"use client";

import { useState } from "react";
import { Share2, Check, Link2 } from "lucide-react";
import {
  buildShareUrl,
  copyToClipboard,
  ShareableState,
} from "@/lib/shareState";

interface ShareButtonProps {
  state: ShareableState;
}

export default function ShareButton({ state }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = buildShareUrl(window.location.origin + window.location.pathname, state);

    // Try native Web Share API first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Electricity Price Dashboard",
          url,
        });
        return;
      } catch {
        // User cancelled or share failed, fall through to clipboard
      }
    }

    // Fallback: copy to clipboard
    const success = await copyToClipboard(url);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      onClick={handleShare}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all border ${
        copied
          ? "bg-emerald-400/20 text-emerald-300 border-emerald-400/50"
          : "bg-zinc-800/50 text-zinc-400 border-zinc-700 hover:bg-zinc-800 hover:text-zinc-200"
      }`}
      title="Share current view"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5" />
          Copied!
        </>
      ) : (
        <>
          <Share2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Share</span>
          <Link2 className="w-3.5 h-3.5 sm:hidden" />
        </>
      )}
    </button>
  );
}
