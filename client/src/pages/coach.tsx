/**
 * CoachPage — ATLAS AI Avatar coach with persistent chat and proactive dashboard insights.
 */
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Send, Trash2, Bot, User as UserIcon, Zap, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeModal } from "@/components/UpgradeModal";
import type { User, AiMessage } from "@shared/schema";

const ATLAS_INTRO = `Hallo! Ich bin **ATLAS**, dein persönlicher GritIQ-Coach. Ich kenne dein Programm, deine Maximalwerte und deine Ziele.

Frag mich alles: Technik-Tipps, Programm-Anpassungen, Ernährungs-Ratschläge oder Erholungsstrategien. Ich antworte basierend auf deinen echten Trainingsdaten.`;

function AtlasAvatar({ size = 36 }: { size?: number }) {
  return (
    <div
      className="rounded-full gradient-orange flex items-center justify-center flex-shrink-0 shadow-md"
      style={{ width: size, height: size }}
    >
      <span className="font-display font-black text-white" style={{ fontSize: size * 0.38 }}>A</span>
    </div>
  );
}

function MessageBubble({ msg }: { msg: AiMessage }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {isUser ? (
        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
          <UserIcon size={14} className="text-muted-foreground" />
        </div>
      ) : (
        <AtlasAvatar size={32} />
      )}
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
        isUser
          ? "bg-primary text-white rounded-tr-sm"
          : "bg-card border border-border text-foreground rounded-tl-sm"
      }`}>
        <MarkdownText text={msg.content} />
        <p className={`text-[10px] mt-1.5 ${isUser ? "text-white/60" : "text-muted-foreground/60"}`}>
          {new Date(msg.createdAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

// Simple markdown-lite: **bold**, newlines
function MarkdownText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part.split("\n").map((line, j, arr) =>
          j < arr.length - 1 ? <span key={j}>{line}<br /></span> : <span key={j}>{line}</span>
        )}</span>;
      })}
    </>
  );
}

const QUICK_PROMPTS = [
  "Wie soll ich mich für den heutigen Deload erholen?",
  "Tipps für mehr Kniebeuge-Tiefe?",
  "Welche Supplements empfiehlst du für mein Ziel?",
  "Wie berechne ich meine Trainingsmaximums neu?",
];

export default function CoachPage() {
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const { data: sub } = useSubscription();
  const [insightsOpen, setInsightsOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: user } = useQuery<User>({
    queryKey: ["/api/user"],
    queryFn: async () => { const r = await fetch("/api/user"); if (r.status === 404) return null; return r.json(); },
    placeholderData: (prev) => prev,
  });

  const { data: messages = [], isLoading: msgsLoading } = useQuery<AiMessage[]>({
    queryKey: ["/api/coach/messages"],
    queryFn: async () => (await apiRequest("GET", "/api/coach/messages")).json(),
    staleTime: 0,
    placeholderData: (prev) => prev,
  });

  const { data: insightsData, isLoading: insightsLoading } = useQuery<{ insights: string[] }>({
    queryKey: ["/api/coach/insights"],
    queryFn: async () => (await apiRequest("POST", "/api/coach/insights")).json(),
    staleTime: 1000 * 60 * 10, // cache 10 min
  });

  const clearMutation = useMutation({
    mutationFn: async () => apiRequest("DELETE", "/api/coach/messages"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coach/messages"] });
      toast({ title: "Chat geleert" });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function sendMessage(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;

    // Pre-check limit for instant feedback (server enforces it too)
    if (sub && !sub.isPro && sub.atlasLimit !== null && sub.atlasUsed >= sub.atlasLimit) {
      setShowUpgrade(true);
      return;
    }

    setInput("");
    setSending(true);
    try {
      const res = await apiRequest("POST", "/api/coach/chat", { message: msg });
      if (res.status === 402) {
        setShowUpgrade(true);
        setSending(false);
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      await queryClient.invalidateQueries({ queryKey: ["/api/coach/messages"] });
      // Refresh subscription counter
      await queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
    } catch (err: any) {
      // Parse the error message — server returns JSON with { message, detail }
      let description = err.message ?? "Coach nicht erreichbar";
      try {
        const parsed = JSON.parse(description.replace(/^\d+:\s*/, ""));
        if (parsed.message === "atlas_key_invalid") {
          description = "ATLAS ist momentan nicht verfügbar (Server-Konfigurationsproblem). Bitte wende dich an den Support.";
        } else if (parsed.message) {
          description = parsed.message;
        }
      } catch { /* raw string — use as-is */ }
      toast({ title: "ATLAS nicht erreichbar", description, variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  const insights = insightsData?.insights ?? [];

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-4rem)] md:max-h-screen"
      style={{ maxHeight: 'calc(100dvh - 4rem)' }}>
      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} reason="atlas" />

      {/* Header */}
      <div className="flex-shrink-0 p-4 md:p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AtlasAvatar size={44} />
            <div>
              <h1 className="font-display font-bold text-lg text-foreground leading-none">ATLAS</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <p className="text-xs text-muted-foreground">GritIQ AI Coach · Online</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {sub && !sub.isPro && sub.atlasLimit !== null && (
              <button
                onClick={() => setShowUpgrade(true)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20 transition-colors"
                title="ATLAS Nachrichten diesen Monat"
                data-testid="atlas-limit-badge"
              >
                <Lock className="h-3 w-3 text-orange-400" />
                <span className="text-xs text-orange-400 font-medium">
                  {sub.atlasUsed}/{sub.atlasLimit}
                </span>
              </button>
            )}
            {sub?.isPro && (
              <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs px-2">
                <Zap className="h-3 w-3 mr-1" />Pro
              </Badge>
            )}
            <button
              onClick={() => clearMutation.mutate()}
              className="p-2 -m-2 text-muted-foreground hover:text-destructive transition-colors"
              title="Chat löschen"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Proactive insights */}
        {(insights.length > 0 || insightsLoading) && (
          <div className="mt-3">
            <button
              onClick={() => setInsightsOpen(v => !v)}
              className="flex items-center gap-1.5 text-xs text-primary font-semibold font-display hover:opacity-80 transition-opacity"
            >
              <Zap size={12} />
              {insightsLoading ? "Analysiere Trainingsdata…" : `${insights.length} proaktive Erkenntnisse`}
            </button>
            {insightsOpen && insights.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {insights.map((ins, i) => (
                  <div key={i} className="flex items-start gap-2 bg-primary/8 border border-primary/20 rounded-lg px-3 py-2">
                    <Zap size={12} className="text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-foreground">{ins}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {/* Intro bubble */}
        {messages.length === 0 && !msgsLoading && (
          <div className="flex gap-3">
            <AtlasAvatar size={32} />
            <div className="max-w-[80%] rounded-2xl rounded-tl-sm px-4 py-3 text-sm bg-card border border-border text-foreground leading-relaxed">
              <MarkdownText text={ATLAS_INTRO} />
              {user && (
                <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 gap-1.5 text-xs">
                  <span className="text-muted-foreground">Athlet:</span><span className="font-semibold">{user.name}</span>
                  <span className="text-muted-foreground">Ziel:</span><span className="font-semibold">{user.trainingGoal}</span>
                  <span className="text-muted-foreground">Kniebeuge 1RM:</span><span className="font-semibold text-primary">{user.squatMax}kg</span>
                  <span className="text-muted-foreground">Bankdrücken 1RM:</span><span className="font-semibold text-primary">{user.benchMax}kg</span>
                </div>
              )}
              {/* Quick prompts */}
              <div className="mt-3 flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(p)}
                    disabled={sending}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-primary/30 text-primary hover:bg-primary/10 transition-colors font-display font-medium"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}

        {/* Typing indicator */}
        {sending && (
          <div className="flex gap-3">
            <AtlasAvatar size={32} />
            <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-4">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-4 md:p-6 border-t border-border bg-background">
        {/* Quick prompts (when chat has messages) */}
        {messages.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar mb-3">
            {QUICK_PROMPTS.map((p, i) => (
              <button
                key={i}
                onClick={() => sendMessage(p)}
                disabled={sending}
                className="flex-shrink-0 text-[11px] px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors font-display"
              >
                {p.length > 30 ? p.slice(0, 30) + "…" : p}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            placeholder="Frag ATLAS…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              setTimeout(() => {
                textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
              }, 300);
            }}
            rows={1}
            className="flex-1 resize-none bg-background border-input min-h-[44px] max-h-32 text-base"
          />
          <Button
            onClick={() => sendMessage()}
            disabled={!input.trim() || sending}
            className="gradient-orange text-white border-0 hover:opacity-90 min-h-[44px] min-w-[44px] p-0 flex items-center justify-center flex-shrink-0"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground/60 mt-1.5 text-center">ATLAS · GPT-4o · Basierend auf deinen GritIQ-Daten</p>
      </div>
    </div>
  );
}
