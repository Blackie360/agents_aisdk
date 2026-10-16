import { Fragment } from "react";
function inline(text: string) {
  return text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/g).map((part, i) =>
    part.startsWith("`") && part.endsWith("`") ? (
      <code key={i} className="rounded bg-black/5 px-1 font-mono">
        {part.slice(1, -1)}
      </code>
    ) : part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}
/** Intentionally limited Markdown. HTML is always React-escaped; no external images or links. */
export function Explanation({ text }: { text: string }) {
  return (
    <div role="status" className="mt-4 text-sm leading-6 break-words">
      {text.split(/(```[\s\S]*?```)/g).map((part, i) =>
        part.startsWith("```") ? (
          <pre
            key={i}
            className="whitespace-pre-wrap bg-black/5 rounded p-3 my-2"
          >
            {part.slice(3, -3).replace(/^\w*\n/, "")}
          </pre>
        ) : (
          <div key={i}>
            {part.split("\n").map((line, j) =>
              /^#{1,6} /.test(line) ? (
                <h4 key={j} className="font-semibold mt-3">
                  {inline(line.replace(/^#{1,6} /, ""))}
                </h4>
              ) : (
                <p key={j} className="min-h-3">
                  {inline(line.replace(/^\s*[-*] /, "• "))}
                </p>
              ),
            )}
          </div>
        ),
      )}
    </div>
  );
}
