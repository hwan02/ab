"use client";

function TypingIndicator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-1">
      <div className="flex gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
      </div>
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}

export { TypingIndicator };
