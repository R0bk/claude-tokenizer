"use client";

import { useState, useRef, useEffect } from "react";
import { FooterGravity } from "./components/FooterGravity";
import { FaXTwitter, FaGithub, FaLinkedinIn } from "react-icons/fa6";
import { HiOutlineMail, HiOutlineGlobe } from "react-icons/hi";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const TOKEN_COLORS = [
  "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "bg-purple-500/15 text-purple-400 border-purple-500/30",
  "bg-pink-500/15 text-pink-400 border-pink-500/30",
  "bg-orange-500/15 text-orange-400 border-orange-500/30",
  "bg-teal-500/15 text-teal-400 border-teal-500/30",
  "bg-red-500/15 text-red-400 border-red-500/30",
];

const SPLIT_COLORS = [
  "text-blue-400",
  "text-emerald-400",
  "text-amber-400",
  "text-purple-400",
  "text-pink-400",
  "text-orange-400",
  "text-teal-400",
  "text-red-400",
];

interface TokenEntry {
  text: string;
  hiddenBefore: number;
}

const MODELS = [
  { id: "claude-opus-4-7", label: "Opus 4.7" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6" },
  { id: "claude-opus-4-6", label: "Opus 4.6" },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
  { id: "claude-sonnet-4-5-20250929", label: "Sonnet 4.5" },
  { id: "claude-opus-4-5-20251101", label: "Opus 4.5" },
  { id: "claude-sonnet-4-20250514", label: "Sonnet 4" },
  { id: "claude-opus-4-20250514", label: "Opus 4" },
];

export default function Home() {
  const [text, setText] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("claude-sonnet-4-5-20250929");
  const [showKey, setShowKey] = useState(false);
  const [tokens, setTokens] = useState<TokenEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [totalHidden, setTotalHidden] = useState(0);
  const [trailingHidden, setTrailingHidden] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pendingHiddenRef = useRef(0);
  const pendingStalledRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("anthropic_api_key");
    if (saved) setApiKey(saved);
  }, []);

  function handleKeyChange(key: string) {
    setApiKey(key);
    if (key) {
      localStorage.setItem("anthropic_api_key", key);
    } else {
      localStorage.removeItem("anthropic_api_key");
    }
  }

  function handleTokenize() {
    if (!text.trim()) return;
    if (text.length > 280) {
      setConfirmOpen(true);
      return;
    }
    void runTokenize();
  }

  async function runTokenize() {
    setTokens([]);
    setError("");
    setDone(false);
    setTotalHidden(0);
    setTrailingHidden(0);
    pendingHiddenRef.current = 0;
    pendingStalledRef.current = 0;
    setLoading(true);

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/tokenize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, apiKey: apiKey || undefined, model }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Request failed");
        setLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));

          if (data.error) {
            setError(data.error);
            setLoading(false);
            return;
          }

          if (data.done) {
            setDone(true);
            setLoading(false);
            return;
          }

          if (data.hiddenTokens !== undefined || data.stalledTokens !== undefined) {
            const h = data.hiddenTokens || 0;
            pendingHiddenRef.current += h;
            setTotalHidden((prev) => prev + h);
            if (data.trailing && h > 0) {
              setTrailingHidden(h);
            }
          }

          if (data.token) {
            const hidden = pendingHiddenRef.current;
            pendingHiddenRef.current = 0;
            setTokens((prev) => [...prev, { text: data.token, hiddenBefore: hidden }]);
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err.message);
      }
    }

    setLoading(false);
  }

  function formatToken(t: string) {
    return t
      .replace(/ /g, "\u00B7")
      .replace(/\n/g, "\\n")
      .replace(/\t/g, "\\t");
  }

  return (
    <div className="min-h-screen">
      {/* Top nav */}
      <div className="max-w-4xl mx-auto px-8 pt-8 pb-0">
        <a
          href="https://robkopel.me"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs font-mono tracking-wide text-gray-500 hover:text-white transition-colors"
        >
          <HiOutlineGlobe size={14} />
          robkopel.me
        </a>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-16">
          {/* Header */}
          <div className="mb-16 fade-in-up">
            <h1
              className="text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight mb-4"
              style={{ fontFamily: "'Cormorant Infant', 'Playfair Display', Georgia, serif" }}
            >
              Claude Tokenizer
            </h1>
            <p className="text-gray-400 text-lg max-w-lg">
              See exactly where Claude splits your text into tokens. Understand
              token boundaries to optimize your prompts.
            </p>
          </div>

          {/* Model + API Key */}
          <div className="mb-8 fade-in-up-delay-1">
            <div className="flex gap-4">
              <div>
                <label className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-3 block">
                  Model
                </label>
                <Select value={model} onValueChange={(v) => v && setModel(v)}>
                  <SelectTrigger className="w-48 bg-[#1a1a1a] border-[#2d2d2d] text-gray-100 font-mono text-sm focus:border-blue-500/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-[#2d2d2d]">
                    {MODELS.map((m) => (
                      <SelectItem
                        key={m.id}
                        value={m.id}
                        className="font-mono text-sm text-gray-300 focus:bg-[#2d2d2d] focus:text-white"
                      >
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-3 block">
                  API Key
                </label>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <input
                      type={showKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => handleKeyChange(e.target.value)}
                      placeholder="sk-ant-..."
                      className="w-full bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg px-4 py-3 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors font-mono text-sm"
                    />
                  </div>
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="px-4 py-3 bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors text-sm cursor-pointer"
                  >
                    {showKey ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
            </div>
            <p className="text-gray-600 text-xs mt-2">
              Your key is stored locally in your browser and sent directly to
              the Anthropic API. Never stored on our servers.
            </p>
          </div>

          {/* Input */}
          <div className="mb-8 fade-in-up-delay-2">
            <label className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-3 block">
              Text to tokenize
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your text here..."
              rows={5}
              maxLength={2000}
              className="w-full bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-4 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors font-mono text-sm resize-y"
            />

            <div className="flex items-center gap-4 mt-4">
              <button
                onClick={handleTokenize}
                disabled={loading || !text.trim()}
                className="bg-white text-[#0a0a0a] hover:bg-gray-200 disabled:bg-[#262626] disabled:text-gray-600 px-6 py-2.5 rounded-lg font-medium transition-colors cursor-pointer"
              >
                {loading ? "Tokenizing..." : "Tokenize"}
              </button>

              {loading && (
                <span className="text-gray-500 text-sm">
                  {tokens.length} token{tokens.length !== 1 ? "s" : ""} found
                  {totalHidden > 0 ? ` (+${totalHidden} hidden)` : ""}...
                </span>
              )}

              <span className="text-gray-600 text-sm ml-auto">
                {text.length}/2000
              </span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-8 bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Results */}
          {tokens.length > 0 && (
            <div className="space-y-10 fade-in-up-delay-3">
              <div className="border-t border-[#2d2d2d] pt-10">
                <h2
                  className="text-3xl sm:text-4xl font-normal mb-1"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                >
                  Results
                </h2>
                <p className="text-gray-500 text-sm mb-6">
                  {tokens.length} token{tokens.length !== 1 ? "s" : ""}
                  {totalHidden > 0 && ` + ${totalHidden} hidden`}
                  {done ? "" : " so far..."}
                </p>

                {/* Token chips */}
                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-3 block">
                    Token chips
                  </label>
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {tokens.map((token, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5">
                        {token.hiddenBefore > 0 && (
                          <span
                            className="inline-block px-2 py-1 rounded-md border border-dashed border-yellow-600/50 bg-yellow-500/10 text-xs text-yellow-500 font-mono"
                            title={`${token.hiddenBefore} hidden token${token.hiddenBefore !== 1 ? "s" : ""} — consumed token budget but produced no visible text`}
                          >
                            +{token.hiddenBefore} hidden
                          </span>
                        )}
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md border text-sm font-mono ${TOKEN_COLORS[i % TOKEN_COLORS.length]}`}
                          title={`Token ${i + 1}: ${JSON.stringify(token.text)}`}
                        >
                          {formatToken(token.text)}
                        </span>
                      </span>
                    ))}
                    {done && trailingHidden > 0 && (
                      <span
                        className="inline-block px-2 py-1 rounded-md border border-dashed border-yellow-600/50 bg-yellow-500/10 text-xs text-yellow-500 font-mono"
                        title={`${trailingHidden} hidden token${trailingHidden !== 1 ? "s" : ""} at end of output`}
                      >
                        +{trailingHidden} hidden
                      </span>
                    )}
                    {loading && (
                      <span className="inline-block px-2.5 py-1 rounded-md border border-[#2d2d2d] bg-[#1a1a1a] text-gray-500 text-sm animate-pulse">
                        ...
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Split view */}
              <div>
                <label className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-3 block">
                  Split view
                </label>
                <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-xl p-6 font-mono text-sm leading-relaxed break-all">
                  {tokens.map((token, i) => (
                    <span key={i}>
                      {i > 0 && (
                        <span className="text-gray-700 mx-0.5">|</span>
                      )}
                      {token.hiddenBefore > 0 && (
                        <span className="text-yellow-500/70 text-xs mx-0.5">[+{token.hiddenBefore} hidden]</span>
                      )}
                      <span className={SPLIT_COLORS[i % SPLIT_COLORS.length]}>
                        {token.text}
                      </span>
                    </span>
                  ))}
                  {done && trailingHidden > 0 && (
                    <span className="text-yellow-500/70 text-xs mx-0.5">[+{trailingHidden} hidden]</span>
                  )}
                </div>
              </div>

              {/* Raw */}
              <div>
                <label className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-3 block">
                  Raw tokens
                </label>
                <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-xl p-6 font-mono text-sm text-gray-400 break-all">
                  [{tokens.map((t) => JSON.stringify(t.text)).join(", ")}]
                </div>
              </div>
            </div>
          )}
        </div>

      {/* Footer */}
      <footer className="w-full bg-[#0a0a0a] pt-8 pb-8 overflow-hidden">
        <FooterGravity />

        <div className="max-w-4xl mx-auto px-8">
          <div className="flex justify-center gap-1 py-6">
            <a
              href="https://robkopel.me"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-gray-500 hover:text-white hover:bg-white/[0.08] transition-all duration-150 ease-out text-xs font-mono tracking-wide"
            >
              <HiOutlineGlobe size={14} />
              site
            </a>
            <a
              href="https://twitter.com/rob_kopel"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-gray-500 hover:text-white hover:bg-white/[0.08] transition-all duration-150 ease-out text-xs font-mono tracking-wide"
            >
              <FaXTwitter size={14} />
              twitter
            </a>
            <a
              href="https://github.com/R0bk"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-gray-500 hover:text-white hover:bg-white/[0.08] transition-all duration-150 ease-out text-xs font-mono tracking-wide"
            >
              <FaGithub size={14} />
              github
            </a>
            <a
              href="https://linkedin.com/in/robert-kopel"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-gray-500 hover:text-white hover:bg-white/[0.08] transition-all duration-150 ease-out text-xs font-mono tracking-wide"
            >
              <FaLinkedinIn size={14} />
              linkedin
            </a>
            <a
              href="mailto:rob@robkopel.com"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-gray-500 hover:text-white hover:bg-white/[0.08] transition-all duration-150 ease-out text-xs font-mono tracking-wide"
            >
              <HiOutlineMail size={14} />
              email
            </a>
          </div>
        </div>

        <div className="border-t border-gray-800/50">
          <div className="max-w-4xl mx-auto px-8 py-4">
            <div className="flex justify-between items-center text-xs text-gray-600 font-mono">
              <span>Rob Kopel</span>
              <span>Brisbane · 27°S 153°E</span>
              <span>2025</span>
            </div>
          </div>
        </div>
      </footer>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tokenize {text.length} characters?</AlertDialogTitle>
            <AlertDialogDescription>
              This makes one API call per token, so long inputs take a while
              and use proportional API credits. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                void runTokenize();
              }}
            >
              Tokenize
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
