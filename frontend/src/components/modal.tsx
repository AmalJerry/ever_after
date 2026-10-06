"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({
  title,
  children,
  onClose,
  className = "",
}: Readonly<{
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    element?.showModal();
    return () => {
      element?.close();
      previousFocus?.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className={`modal ${className}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="modal-inner">
        <div className="modal-heading">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Close dialog"
            title="Close"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
