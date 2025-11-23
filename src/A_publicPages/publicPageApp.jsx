import { Route, Routes } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import "highlight.js/styles/github-dark.css";

const toc = [
  { id: "welcome", label: "Welcome" },
  { id: "takeaways", label: "Takeaways" },
  { id: "code", label: "Code path" },
  { id: "notes", label: "Field notes" }
];

const highlights = [
  {
    title: "Stay close to React Router",
    body: "This public page keeps the same routing you use elsewhere, so long-form writing lives beside the app without extra plumbing."
  },
  {
    title: "Server-first, hydrate later",
    body: "Ship HTML quickly from the server, then sprinkle in interactivity with lazy client bundles when you need them."
  },
  {
    title: "Readable by default",
    body: "A blog-like layout with a sticky table of contents makes it easy to scan and link to the parts that matter."
  }
];

const fieldNotes = [
  {
    title: "Draft in markdown, polish in JSX",
    body: "Paste prose directly into sections, then wrap trickier blocks in small components when you need emphasis."
  },
  {
    title: "Prefer small components",
    body: "ListView, HeaderParagraph, and CodeView keep the rhythm consistent without forcing a single template."
  },
  {
    title: "Swap content, keep structure",
    body: "Anchor IDs stay the same so links keep working even as you rewrite the story."
  }
];

const serverSnippet = `import express from 'express';
import { renderToString } from 'react-dom/server';
import PublicPageApp from './src/A_publicPages/publicPageApp.jsx';

const app = express();

app.get('*', (req, res) => {
  const html = renderToString(<PublicPageApp />);

  res.status(200).send(\`
    <!doctype html>
    <html lang="en">
      <body>
        <div id="root">\${html}</div>
        <script type="module" src="/src/main.jsx"></script>
      </body>
    </html>
  \`);
});

app.listen(3000);
`;

const clientSnippet = `import { hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import PublicPageApp from './A_publicPages/publicPageApp.jsx';

hydrateRoot(
  document.getElementById('root'),
  <BrowserRouter>
    <PublicPageApp />
  </BrowserRouter>
);
`;

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("xml", xml);

const HeaderParagraph = ({ kicker, title, description, meta }) => (
  <header className="space-y-3 border-b border-slate-200 pb-6">
    {kicker && <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{kicker}</p>}
    <div className="space-y-2">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
      <p className="text-lg leading-relaxed text-slate-700">{description}</p>
    </div>
    {meta && <p className="text-base text-slate-500">{meta}</p>}
  </header>
);

const ListView = ({ title, items, footnote, ordered = false }) => {
  const ListTag = ordered ? "ol" : "ul";
  const listStyle = ordered ? "list-decimal" : "list-disc";

  return (
    <div className="space-y-4">
      {title && <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>}
      <ListTag className={`space-y-3 ${listStyle} pl-6`}>
        {items.map((item) => (
          <li key={item.title} className="space-y-1 marker:text-slate-600">
            <p className="text-lg font-semibold text-slate-900">{item.title}</p>
            {item.body && <p className="text-base leading-relaxed text-slate-700">{item.body}</p>}
          </li>
        ))}
      </ListTag>
      {footnote && <p className="text-sm text-slate-500">{footnote}</p>}
    </div>
  );
};

const CodeView = ({ title, description, code, language }) => {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef(null);

  const normalizedLang = (() => {
    const raw = (language || "").toLowerCase();
    if (raw.includes("jsx")) return "javascript";
    if (raw.includes("tsx") || raw === "ts") return "typescript";
    if (raw.includes("ts")) return "typescript";
    if (raw.includes("js")) return "javascript";
    return "javascript";
  })();

  useEffect(() => {
    if (codeRef.current) {
      hljs.highlightElement(codeRef.current);
    }
  }, [code, normalizedLang]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (err) {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-base font-semibold text-slate-900">{title}</p>
          {description && <p className="text-base leading-relaxed text-slate-600">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {language && (
            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
              {language}
            </span>
          )}
          <button
            onClick={handleCopy}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            type="button"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <pre className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-950 p-4 text-base leading-relaxed text-slate-100">
        <code
          ref={codeRef}
          className={`hljs language-${normalizedLang}`}
        >
          {code}
        </code>
      </pre>
    </div>
  );
};

const AccordionSection = ({ section, isOpen, onToggle }) => {
  const contentRef = useRef(null);
  const [maxHeight, setMaxHeight] = useState(0);

  useEffect(() => {
    if (!contentRef.current) return;
    if (isOpen) {
      setMaxHeight(contentRef.current.scrollHeight);
    } else {
      setMaxHeight(0);
    }
  }, [isOpen, section.items.length]);

  return (
    <div className="space-y-1">
      <button
        className="flex w-full items-center justify-between py-2 text-left text-base font-semibold text-slate-900"
        onClick={onToggle}
      >
        {section.title}
        <span
          className={`text-lg font-bold text-slate-700 transition-transform ${isOpen ? "rotate-90" : ""}`}
          aria-hidden
        >
          ›
        </span>
      </button>
      <div
        className="overflow-hidden transition-[max-height] duration-300 ease-out"
        style={{ maxHeight }}
      >
        <ul
          ref={contentRef}
          className="space-y-2 border-l border-slate-200/80 pl-4 text-base text-slate-800 transition-opacity duration-200 ease-out"
          style={{ opacity: isOpen ? 1 : 0 }}
        >
          {section.items.map((item) => (
            <li key={item.label}>
              <a className="hover:text-slate-900" href={item.href}>
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

const Accordion = ({ sections }) => {
  const [openIds, setOpenIds] = useState(() => {
    const first = sections[0]?.id;
    return first ? new Set([first]) : new Set();
  });

  return (
    <div className="space-y-2">
      {sections.map((section) => {
        const isOpen = openIds.has(section.id);
        return (
          <AccordionSection
            key={section.id}
            section={section}
            isOpen={isOpen}
            onToggle={() =>
              setOpenIds((prev) => {
                const next = new Set(prev);
                if (next.has(section.id)) {
                  next.delete(section.id);
                } else {
                  next.add(section.id);
                }
                return next;
              })
            }
          />
        );
      })}
    </div>
  );
};

const DocLayout = () => {
  const navSections = [
    {
      id: "toc",
      title: "On this page",
      items: toc.map((item) => ({ label: item.label, href: `#${item.id}` }))
    },
    {
      id: "sections",
      title: "Sections",
      items: [
        { label: "Welcome", href: "#welcome" },
        { label: "Takeaways", href: "#takeaways" },
        { label: "Code path", href: "#code" },
        { label: "Field notes", href: "#notes" }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white text-slate-900 font-['SF_Pro_Display',_Inter,_sans-serif]">
      <div className="mx-auto flex max-w-6xl gap-10 px-6 py-12 lg:py-16">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-10 space-y-5">
            <div className="space-y-1">
              <p className="text-lg font-semibold text-slate-900">Plainly</p>
              <p className="text-base text-slate-500">Engineering log</p>
            </div>

            <Accordion sections={navSections} />
          </div>
        </aside>

        <main className="flex-1 space-y-14">
          <section id="welcome" className="space-y-4">
            <HeaderParagraph
              kicker="Engineering log"
              title="Publishing fast without the heavy framework"
              description="A simple, readable template for long-form posts that live next to your app. Swap in your own story and keep the routing you already use."
              meta="Updated this week — crafted for product and engineering notes"
            />
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
              <p className="text-lg leading-relaxed text-slate-700">
                The goal: keep a blog-like view that is pleasant to read, quick to ship, and easy to edit. This page is
                intentionally neutral so you can plug in release notes, architecture writeups, or onboarding guides
                without rewriting the layout.
              </p>
            </div>
          </section>

          <section id="takeaways" className="space-y-4">
            <ListView
              title="Quick takeaways"
              items={highlights}
              footnote="Replace these with the points you want to highlight; the rhythm stays consistent."
            />
          </section>

          <section id="code" className="space-y-4">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Code path</h2>
              <p className="text-lg leading-relaxed text-slate-700">
                Keep the server in charge, render once, and hydrate only the interactive parts. The snippets below show
                the bare minimum to serve and hydrate this page.
              </p>
            </div>
            <CodeView
              title="Server entry"
              description="Render the public app from your existing server so routing and middleware stay yours."
              language="server.jsx"
              code={serverSnippet}
            />
            <CodeView
              title="Client hydration"
              description="Hand control to the client only after the server has already delivered HTML."
              language="main.jsx"
              code={clientSnippet}
            />
          </section>

          <section id="notes" className="space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Field notes</h2>
            <p className="text-lg leading-relaxed text-slate-700">
              These notes are placeholders; replace them with the lessons from your own launch, migration, or release.
              The idea is to keep a scannable list so readers can skim quickly.
            </p>
            <ListView items={fieldNotes} />
          </section>
        </main>
      </div>
    </div>
  );
};

const PublicPageApp = () => {
  return (
    <Routes>
      <Route path="/" element={<DocLayout />} />
    </Routes>
  );
};

export default PublicPageApp;
