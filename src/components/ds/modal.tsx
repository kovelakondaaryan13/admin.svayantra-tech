"use client";

import type { ReactNode } from "react";

/** Centered pop-up: backdrop + click-outside-to-close, shared by every popup surface
 *  (command palette, notifications, …) so positioning/close behavior only lives once. */
export function Modal({
  onClose,
  maxWidth = "max-w-md",
  children,
}: {
  onClose: () => void;
  maxWidth?: string;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className={`floating animate-in relative w-full ${maxWidth} overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
