import React, { useState } from "react";
import type { FC } from "react";

type ArticleViewProps = {
  content: string;
  videoTitle: string;
  channelName: string;
  videoId: string;
  modelUsed: string;
  isStreaming: boolean;
  isCached?: boolean;
};

const ArticleView: FC<ArticleViewProps> = ({
  content,
  videoTitle,
  channelName,
  videoId,
  modelUsed,
  isStreaming,
  isCached,
}) => {
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Simple markdown to HTML conversion
  const renderMarkdown = (md: string) => {
    return (
      md
        // Code blocks (must be before inline code)
        .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-slate-800 p-4 rounded-md overflow-x-auto my-4"><code>$2</code></pre>')
        // Headers
        .replace(/^### (.*$)/gim, '<h3 class="text-xl font-semibold mt-6 mb-3">$1</h3>')
        .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold mt-8 mb-4">$1</h2>')
        .replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold mt-8 mb-6">$1</h1>')
        // Bold and italic
        .replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        // Inline code
        .replace(/`([^`]+)`/g, '<code class="bg-slate-700 px-1 rounded text-sm">$1</code>')
        // Lists
        .replace(/^\- (.*$)/gim, '<li class="ml-4 list-disc">$1</li>')
        .replace(/^\d+\. (.*$)/gim, '<li class="ml-4 list-decimal">$1</li>')
        // Horizontal rule
        .replace(/^---$/gim, '<hr class="my-8 border-slate-600" />')
        // Paragraphs (double newline)
        .replace(/\n\n/g, '</p><p class="mb-4">')
        // Single newlines
        .replace(/\n/g, "<br />")
    );
  };

  const bgClass = isDarkMode ? "bg-gray-900" : "bg-white";
  const textClass = isDarkMode ? "text-gray-100" : "text-gray-900";
  const mutedClass = isDarkMode ? "text-gray-400" : "text-gray-600";
  const borderClass = isDarkMode ? "border-slate-700" : "border-gray-200";

  return (
    <div className={`min-h-screen ${bgClass} transition-colors duration-300`}>
      {/* Header with controls */}
      <div
        className={`sticky top-0 z-10 border-b bg-opacity-90 backdrop-blur-sm ${borderClass} ${bgClass}`}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
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
          <div className="flex items-center gap-3">
            <span className={`text-xs ${mutedClass}`}>{modelUsed}</span>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`rounded-md px-4 py-2 text-sm transition-colors ${
                isDarkMode
                  ? "bg-slate-800 text-white hover:bg-slate-700"
                  : "bg-gray-200 text-gray-800 hover:bg-gray-300"
              }`}
            >
              {isDarkMode ? "☀️ Light" : "🌙 Dark"}
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
        <div
          className={`prose prose-lg max-w-none ${textClass}`}
          style={{ lineHeight: 1.8 }}
          dangerouslySetInnerHTML={{
            __html: `<p class="mb-4">${renderMarkdown(content)}</p>`,
          }}
        />

        {/* Streaming indicator */}
        {isStreaming && (
          <div className="mt-4 flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-sky-500" />
            <span className={`text-sm ${mutedClass}`}>Generating...</span>
          </div>
        )}
      </article>
    </div>
  );
};

export default ArticleView;
