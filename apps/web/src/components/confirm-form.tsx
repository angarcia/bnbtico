"use client";

/** Formulario que pide confirmación antes de enviar (acciones que cambian algo visible para los clientes). */
export function ConfirmForm({ action, message, children, className }: { action: (fd: FormData) => Promise<void>; message: string; children: React.ReactNode; className?: string }) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </form>
  );
}
