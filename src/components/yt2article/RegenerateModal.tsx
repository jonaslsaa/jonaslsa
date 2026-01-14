import React, { useState, useEffect } from "react";
import type { FC } from "react";

interface AIModel {
  id: string;
  name: string;
  provider: string;
}

type RegenerateModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onRegenerate: (modelId: string) => void;
  models: AIModel[];
  currentModelId: string;
  isLoading: boolean;
};

const RegenerateModal: FC<RegenerateModalProps> = ({
  isOpen,
  onClose,
  onRegenerate,
  models,
  currentModelId,
  isLoading,
}) => {
  const [selectedModel, setSelectedModel] = useState(currentModelId);

  // Reset selected model when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedModel(currentModelId);
    }
  }, [isOpen, currentModelId]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleRegenerate = () => {
    onRegenerate(selectedModel);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="mx-4 w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
        <div className="rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
          {/* Header */}
          <div className="border-b border-slate-700 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Regenerate Article</h2>
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              Choose a different AI model to regenerate this article
            </p>
          </div>

          {/* Content */}
          <div className="px-6 py-5">
            <label className="mb-3 block text-sm font-medium text-slate-300">
              Select Model
            </label>
            <div className="space-y-2">
              {models.map((model) => (
                <button
                  key={model.id}
                  onClick={() => setSelectedModel(model.id)}
                  disabled={isLoading}
                  className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
                    selectedModel === model.id
                      ? "border-sky-500 bg-sky-500/10"
                      : "border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800"
                  } ${isLoading ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-white">{model.name}</div>
                      <div className="text-sm text-slate-400">{model.provider}</div>
                    </div>
                    {selectedModel === model.id && (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-500">
                        <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    {model.id === currentModelId && selectedModel !== model.id && (
                      <span className="rounded-full bg-slate-700 px-2 py-1 text-xs text-slate-300">
                        Current
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 border-t border-slate-700 px-6 py-4">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleRegenerate}
              disabled={isLoading}
              className="flex-1 rounded-xl bg-sky-600 px-4 py-3 font-medium text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-600"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Regenerating...
                </span>
              ) : (
                "Regenerate"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegenerateModal;
