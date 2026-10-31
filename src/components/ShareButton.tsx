"use client";

import { useState } from "react";
import { Share2, Check, Link2 } from "lucide-react";
import {
  buildShareUrl,
  copyToClipboard,
  ShareableState,
} from "@/lib/shareState";
import { PILL_BASE } from "@/lib/styles";

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
    <>
    {/* Announce the copy result to screen readers (title/aria-label aren't re-announced);
        kept outside the button so the live region isn't nested in an interactive element */}
    <span role="status" className="sr-only">
      {copied ? "Link copied" : ""}
    </span>
    <button
      onClick={handleShare}
      className={`${PILL_BASE} flex items-center gap-1.5 ${
        copied
          ? "bg-emerald-400/20 text-emerald-300 border-emerald-400/50"
          : "bg-zinc-800/50 text-zinc-400 border-zinc-700 hover:bg-zinc-800 hover:text-zinc-200"
      }`}
      title="Share current view"
      aria-label={copied ? "Link copied" : "Share current view"}
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
    </>
  );
}
