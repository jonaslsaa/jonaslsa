import React, { useRef, useState } from "react";
import type { FC } from "react";

interface AIModel {
  id: string;
  name: string;
  provider: string;
}

type UrlInputProps = {
  onSubmit: (url: string, modelId: string) => void;
  isLoading: boolean;
  models: AIModel[];
  defaultModelId: string;
};

const UrlInput: FC<UrlInputProps> = ({ onSubmit, isLoading, models, defaultModelId }) => {
  const urlRef = useRef<HTMLInputElement>(null);
  const [selectedModel, setSelectedModel] = useState(defaultModelId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const url = urlRef.current?.value.trim() || "";
    if (url.length > 0) {
      onSubmit(url, selectedModel);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (urlRef.current) {
        urlRef.current.value = text.trim();
      }
    } catch (err) {
      console.error("Failed to read clipboard:", err);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-2xl flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="youtube-url" className="text-sm text-gray-400">
          YouTube URL
        </label>
        <input
          ref={urlRef}
          id="youtube-url"
          type="text"
          className="rounded-md border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-sky-500 focus:outline-none"
          placeholder="https://www.youtube.com/watch?v=..."
          disabled={isLoading}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="model-select" className="text-sm text-gray-400">
          AI Model
        </label>
        <select
          id="model-select"
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          disabled={isLoading}
          className="rounded-md border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-sky-500 focus:outline-none"
        >
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name} ({model.provider})
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handlePaste}
          disabled={isLoading}
          className="rounded-md border border-slate-700 bg-slate-800 px-6 py-3 font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
        >
          Paste from clipboard
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 rounded-md bg-sky-600 px-6 py-3 text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-600"
        >
          {isLoading ? "Processing..." : "Generate Article"}
        </button>
      </div>
    </form>
  );
};

export default UrlInput;
