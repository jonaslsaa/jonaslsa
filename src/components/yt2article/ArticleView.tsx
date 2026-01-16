import React, { useEffect, useState } from "react";
import type { FC } from "react";
import { Streamdown } from "streamdown";

type ArticleViewProps = {
  content: string;
  videoTitle: string;
  channelName: string;
  videoId: string;
  modelUsed: string;
  isStreaming: boolean;
  isCached?: boolean;
  showShareButton?: boolean;
  showRegenerateButton?: boolean;
  onRegenerateClick?: () => void;
  inputTokens?: number | null;
  outputTokens?: number | null;
  cost?: number | null;
};

const ArticleView: FC<ArticleViewProps> = ({
  content,
  videoTitle,
  channelName,
  videoId,
  modelUsed,
  isStreaming,
  isCached,
  showShareButton = true,
  showRegenerateButton = false,
  onRegenerateClick,
  inputTokens,
  outputTokens,
  cost,
}) => {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/yt2article/view/${videoId}`
    : "";

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.style.setProperty("--app-bg", isDarkMode ? "#111827" : "#ffffff");
  }, [isDarkMode]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    return () => {
      document.documentElement.style.removeProperty("--app-bg");
    };
  }, []);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const bgClass = isDarkMode ? "bg-gray-900" : "bg-white";
  const textClass = isDarkMode ? "text-gray-100" : "text-gray-900";
  const mutedClass = isDarkMode ? "text-gray-400" : "text-gray-600";
  const borderClass = isDarkMode ? "border-slate-700" : "border-gray-200";

  return (
    <div className={`min-h-screen ${bgClass} transition-colors duration-300`}>
      {/* Header with controls */}
      <div
        className={`sticky top-0 z-10 w-full border-b bg-opacity-90 backdrop-blur-sm ${borderClass} ${bgClass}`}
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={`https://www.youtube.com/watch?v=${videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`text-sm ${mutedClass} transition-colors hover:text-sky-500`}
            >
              View original video
            </a>
            {isCached && (
              <span className="rounded-full bg-green-600/20 px-2 py-1 text-xs text-green-400">
                Cached
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <span className={`text-xs ${mutedClass} max-w-[10rem] truncate`} title={modelUsed}>
              {modelUsed}
            </span>
            {showRegenerateButton && !isStreaming && onRegenerateClick && (
              <button
                onClick={onRegenerateClick}
                className={`rounded-md px-2 py-1.5 text-xs transition-colors sm:px-3 sm:py-2 sm:text-sm ${
                  isDarkMode
                    ? "bg-slate-800 text-white hover:bg-slate-700"
                    : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                }`}
              >
                🔄 Regenerate
              </button>
            )}
            {showShareButton && !isStreaming && (
              <button
                onClick={handleCopyLink}
                className={`rounded-md px-2 py-1.5 text-xs transition-colors sm:px-3 sm:py-2 sm:text-sm ${
                  isDarkMode
                    ? "bg-slate-800 text-white hover:bg-slate-700"
                    : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                }`}
              >
                {copied ? "✓ Copied!" : "🔗 Share"}
              </button>
            )}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`rounded-md px-2 py-1.5 text-xs transition-colors sm:px-3 sm:py-2 sm:text-sm ${
                isDarkMode
                  ? "bg-slate-800 text-white hover:bg-slate-700"
                  : "bg-gray-200 text-gray-800 hover:bg-gray-300"
              }`}
            >
              {isDarkMode ? "☀️" : "🌙"}
            </button>
          </div>
        </div>
      </div>

      {/* Article content */}
      <article className="mx-auto max-w-3xl px-6 py-12">
        {/* Video info header */}
        <div className={`mb-8 border-b pb-6 ${borderClass}`}>
          <p className={`mb-2 text-sm ${mutedClass}`}>
            Based on video by <span className="font-medium">{channelName}</span>
          </p>
          <p className={`text-sm ${mutedClass}`}>Original: {videoTitle}</p>
        </div>

        {/* Main content */}
        <div className={`prose prose-lg max-w-none ${textClass} ${isDarkMode ? "prose-invert" : ""}`}>
          <Streamdown>{content}</Streamdown>
        </div>

        {/* Streaming indicator */}
        {isStreaming && (
          <div className="mt-4 flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-sky-500" />
            <span className={`text-sm ${mutedClass}`}>Generating...</span>
          </div>
        )}

        {/* Usage info */}
        {!isStreaming && (inputTokens || outputTokens || cost !== null) && (
          <div className={`mt-8 border-t pt-4 ${borderClass}`}>
            <p className={`text-xs ${mutedClass}`}>
              {inputTokens && <span>{inputTokens.toLocaleString()} input</span>}
              {inputTokens && outputTokens && <span> · </span>}
              {outputTokens && <span>{outputTokens.toLocaleString()} output</span>}
              {(inputTokens || outputTokens) && cost !== null && cost !== undefined && <span> · </span>}
              {cost !== null && cost !== undefined && <span>${cost.toFixed(4)}</span>}
            </p>
          </div>
        )}
      </article>
    </div>
  );
};

export default ArticleView;
