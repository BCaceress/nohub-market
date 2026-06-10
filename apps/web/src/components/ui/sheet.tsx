"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  side?: "right" | "left";
}

export function Sheet({ open, onClose, children, className, side = "right" }: SheetProps) {
  const overlayRef = useRef<HTMLDialogElement>(null);
  const [shouldRender, setShouldRender] = useState(open);

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      return;
    }

    if (!shouldRender) return;

    const timeout = window.setTimeout(() => setShouldRender(false), 300);
    return () => window.clearTimeout(timeout);
  }, [open, shouldRender]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!shouldRender || typeof window === "undefined") return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Fechar painel"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-250",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
      />

      {/* Panel */}
      <dialog
        open
        ref={overlayRef}
        aria-modal="true"
        className={cn(
          "fixed top-0 z-50 m-0 flex h-full flex-col border-0 bg-card text-foreground p-0 shadow-2xl transition-transform duration-300 ease-out",
          side === "right"
            ? "right-0 left-auto border-l border-border/60"
            : "left-0 right-auto border-r border-border/60",
          side === "right"
            ? open
              ? "translate-x-0"
              : "translate-x-full"
            : open
              ? "translate-x-0"
              : "-translate-x-full",
          className,
        )}
      >
        {children}
      </dialog>
    </>,
    document.body,
  );
}

interface SheetHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  onClose: () => void;
  actions?: React.ReactNode;
}

export function SheetHeader({ title, description, onClose, actions }: SheetHeaderProps) {
  return (
    <div className="flex items-start gap-3 border-b border-border bg-card px-5 py-4 shrink-0">
      <div className="flex-1 min-w-0">
        <h2 className="text-sm font-semibold leading-tight text-foreground">{title}</h2>
        {description && (
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0 pt-0.5">{actions}</div>}
      <button
        type="button"
        onClick={onClose}
        className="mt-0.5 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function SheetBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex-1 overflow-y-auto overscroll-contain px-5 py-4", className)}>
      {children}
    </div>
  );
}
