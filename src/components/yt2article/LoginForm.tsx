import React, { useRef } from "react";
import type { FC } from "react";

type LoginFormProps = {
  onLogin: (password: string) => void;
  isLoading: boolean;
  error: string | null;
};

const LoginForm: FC<LoginFormProps> = ({ onLogin, isLoading, error }) => {
  const passwordRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const password = passwordRef.current?.value || "";
    if (password.length > 0) {
      onLogin(password);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-md flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-sm text-gray-400">
          Password
        </label>
        <input
          ref={passwordRef}
          id="password"
          type="password"
          className="rounded-md border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-sky-500 focus:outline-none"
          placeholder="Enter password..."
          disabled={isLoading}
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={isLoading}
        className="rounded-md bg-sky-600 px-6 py-3 text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-600"
      >
        {isLoading ? "Logging in..." : "Login"}
      </button>
    </form>
  );
};

export default LoginForm;
