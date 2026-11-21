"use client";

import { useActionState, useState } from "react";
import { login, logout, type LoginState } from "@/app/actions/auth";

export function LoginPanel({ isPrivate }: { isPrivate: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<LoginState | undefined, FormData>(
    login,
    undefined,
  );

  if (isPrivate) {
    return (
      <form action={logout} className="auth">
        <span className="auth__badge">Private view</span>
        <button type="submit" className="btn btn--ghost">
          Log out
        </button>
      </form>
    );
  }

  return (
    <div className="auth">
      <button
        type="button"
        className="btn btn--ghost"
        aria-expanded={open}
        aria-controls="login-form"
        onClick={() => setOpen((o) => !o)}
      >
        Owner login
      </button>
      {open && (
        <form id="login-form" action={action} className="auth__form">
          <label htmlFor="password" className="sr-only">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            autoFocus
            required
          />
          <button type="submit" className="btn" disabled={pending}>
            {pending ? "Checking" : "Unlock"}
          </button>
          {state?.error && (
            <p role="alert" className="auth__error">
              {state.error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
