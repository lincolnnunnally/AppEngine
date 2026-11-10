import type { ReactNode } from "react";
import type { OwnerTaskDoc } from "@/lib/engine/owner-tasks-core";
import { docReadingTime, parseDocBlocks, parseDocInline } from "@/lib/engine/owner-task-doc";

// What a task asks Lincoln to read, opened on the card itself. He reads the list on his phone and is not
// signed in to GitHub there, so the words travel with the task instead of sitting behind a link. Rendered on
// the server from text only: no HTML from the document is ever trusted.

function Inline({ text }: { text: string }): ReactNode {
  return parseDocInline(text).map((part, index) => {
    if (part.kind === "bold") return <b key={index}>{part.text}</b>;
    if (part.kind === "code") return <code key={index}>{part.text}</code>;
    if (part.kind === "link") {
      return (
        <a key={index} className="account-link" href={part.href} target="_blank" rel="noreferrer">
          {part.text}
        </a>
      );
    }
    return <span key={index}>{part.text}</span>;
  });
}

export function OwnerTaskDocReader({ doc }: { doc: OwnerTaskDoc }) {
  const blocks = parseDocBlocks(doc.text);
  return (
    <details className="owner-task-doc">
      <summary>
        <span className="owner-task-doc-open">Read it here</span>
        <span className="owner-task-doc-title">{doc.title}</span>
        <span className="owner-task-doc-time">{docReadingTime(doc.text)}</span>
      </summary>
      <div className="owner-task-doc-body">
        {blocks.map((block, index) => {
          if (block.kind === "heading") {
            return (
              <p key={index} className={`owner-task-doc-h owner-task-doc-h${block.level}`} role="heading" aria-level={block.level + 3}>
                <Inline text={block.text} />
              </p>
            );
          }
          if (block.kind === "list") {
            const List = block.ordered ? "ol" : "ul";
            return (
              <List key={index}>
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <Inline text={item} />
                  </li>
                ))}
              </List>
            );
          }
          if (block.kind === "code") return <pre key={index}>{block.text}</pre>;
          if (block.kind === "table") {
            return (
              <div key={index} className="owner-task-doc-table">
                <table>
                  <thead>
                    <tr>
                      {block.header.map((cell, cellIndex) => (
                        <th key={cellIndex}>
                          <Inline text={cell} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex}>
                            <Inline text={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          return (
            <p key={index}>
              <Inline text={block.text} />
            </p>
          );
        })}
        {doc.from ? <p className="owner-task-doc-from">Copied for you from {doc.from}. Only you can see this page.</p> : null}
      </div>
    </details>
  );
}
