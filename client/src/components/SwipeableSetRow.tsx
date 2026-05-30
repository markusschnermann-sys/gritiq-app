/**
 * SwipeableSetRow — Set row with iOS-native gesture layer:
 *
 *   • Swipe RIGHT  → complete set  (green reveal, ✓ icon, haptic: success)
 *   • Swipe LEFT   → skip set      (red reveal, → icon, haptic: warning)
 *   • Long-press weight chip → inline weight quick-edit popover (haptic: heavy)
 *   • Spring-physics drag with rubber-banding past threshold
 *   • Micro-animations: scale pulse on complete, shake on skip
 *
 * Gesture thresholds:
 *   Reveal starts at 16px drag.
 *   Action fires at THRESHOLD_ACTION = 80px.
 *   Max drag capped at MAX_DRAG = 120px with rubber-band beyond threshold.
 */
import {
  useState, useRef, useCallback, useEffect,
} from "react";
import { Check, SkipForward, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useHaptic } from "@/hooks/useHaptic";
import { useLongPress } from "@/hooks/useLongPress";
import { cn } from "@/lib/utils";
import type { Set as WorkoutSet } from "@shared/schema";

// ── Constants ────────────────────────────────────────────────────────────────
const THRESHOLD_START  = 16;   // px before drag becomes intentional
const THRESHOLD_ACTION = 80;   // px that triggers the action on release
const MAX_DRAG         = 120;  // px max visual travel
const RUBBER_FACTOR    = 0.35; // compression factor beyond threshold

// ── Types ────────────────────────────────────────────────────────────────────
interface SetInputState {
  reps: string;
  weight: string;
  rpe: number;
}

interface SwipeableSetRowProps {
  set: WorkoutSet;
  isActive: boolean;
  input: SetInputState;
  onToggleExpand: () => void;
  onComplete: (set: WorkoutSet) => void;
  onSkip: (set: WorkoutSet) => void;
  onInputChange: (id: number, patch: Partial<SetInputState>) => void;
  isPending: boolean;
}

// ── Weight quick-edit popover ─────────────────────────────────────────────────
function WeightPopover({
  value,
  onChange,
  onClose,
}: {
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    // IOS-12: scroll the popover input into view after keyboard appears (~350ms)
    setTimeout(() => {
      inputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 350);
  }, []);

  return (
    <div
      className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 bg-card border border-border rounded-2xl shadow-2xl p-3 w-44 flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150"
      style={{ touchAction: "none" }}
      onClick={e => e.stopPropagation()}
    >
      {/* Arrow */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-2 overflow-hidden">
        <div className="w-3 h-3 bg-card border-r border-b border-border rotate-45 translate-y-[-50%] mx-auto" />
      </div>

      <p className="text-[10px] font-display font-semibold text-muted-foreground uppercase tracking-wider text-center">
        Gewicht (kg)
      </p>

      {/* Stepper + input row */}
      <div className="flex items-center gap-1.5">
        <button
          className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center text-lg font-bold transition-colors active:scale-95"
          onPointerDown={e => { e.preventDefault(); onChange(String(Math.max(0, parseFloat(value || "0") - 2.5))); }}
        >
          −
        </button>
        <input
          ref={inputRef}
          type="number"
          inputMode="decimal"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="flex-1 h-8 text-center text-sm font-bold font-display bg-background border border-border rounded-lg outline-none focus:border-primary/60 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center text-lg font-bold transition-colors active:scale-95"
          onPointerDown={e => { e.preventDefault(); onChange(String(parseFloat(value || "0") + 2.5)); }}
        >
          +
        </button>
      </div>

      <button
        className="h-8 rounded-lg gradient-orange text-white text-xs font-display font-bold active:opacity-80 transition-opacity"
        onPointerDown={e => { e.preventDefault(); onClose(); }}
      >
        Übernehmen
      </button>
    </div>
  );
}

// ── Main SwipeableSetRow ──────────────────────────────────────────────────────
export default function SwipeableSetRow({
  set,
  isActive,
  input,
  onToggleExpand,
  onComplete,
  onSkip,
  onInputChange,
  isPending,
}: SwipeableSetRowProps) {
  const { vibrate } = useHaptic();

  // Drag state
  const [dragX, setDragX]       = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animClass, setAnimClass] = useState<"" | "pulse-complete" | "shake-skip">("");
  const [showWeightPop, setShowWeightPop] = useState(false);

  const startXRef   = useRef(0);
  const startYRef   = useRef(0);
  const currentXRef = useRef(0);
  const isDragging  = useRef(false);
  const hasFired    = useRef(false);
  const wrapperRef  = useRef<HTMLDivElement>(null);

  const isCompleted = set.isCompleted === 1;

  // ── Clamp drag with rubber-banding ─────────────────────────────────────────
  const clampDrag = (raw: number) => {
    const sign = raw > 0 ? 1 : -1;
    const abs  = Math.abs(raw);
    if (abs <= THRESHOLD_ACTION) return raw;
    const overflow = abs - THRESHOLD_ACTION;
    return sign * (THRESHOLD_ACTION + overflow * RUBBER_FACTOR);
  };

  // ── Touch handlers ──────────────────────────────────────────────────────────
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (isCompleted || isPending) return;
    startXRef.current   = e.touches[0].clientX;
    startYRef.current   = e.touches[0].clientY;
    currentXRef.current = e.touches[0].clientX;
    isDragging.current  = false;
    hasFired.current    = false;
  }, [isCompleted, isPending]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (isCompleted || isPending || hasFired.current) return;
    const dx = e.touches[0].clientX - startXRef.current;
    const dy = Math.abs(e.touches[0].clientY - startYRef.current);
    currentXRef.current = e.touches[0].clientX;

    // Don't start horizontal drag if gesture is primarily vertical
    if (!isDragging.current) {
      if (Math.abs(dx) > THRESHOLD_START && dy < 10) {
        isDragging.current = true;
        vibrate("select");
      } else if (dy > 10) {
        // Vertical scroll — let it pass through
        return;
      }
    }

    if (!isDragging.current) return;

    const clamped = clampDrag(dx);
    setDragX(clamped);

    // Haptic tick at threshold
    if (Math.abs(clamped) >= THRESHOLD_ACTION - 5 && Math.abs(dragX) < THRESHOLD_ACTION - 5) {
      vibrate("medium");
    }
  }, [isCompleted, isPending, dragX, vibrate]);

  const onTouchEnd = useCallback(() => {
    if (!isDragging.current || hasFired.current) {
      setDragX(0);
      isDragging.current = false;
      return;
    }
    isDragging.current = false;

    const finalDx = currentXRef.current - startXRef.current;
    if (finalDx >= THRESHOLD_ACTION) {
      // ── Complete ──────────────────────────────────────────────────────────
      hasFired.current = true;
      vibrate("success");
      setIsAnimating(true);
      setAnimClass("pulse-complete");
      // Animate row to the right off-screen, then call onComplete
      setDragX(MAX_DRAG * 1.5);
      setTimeout(() => {
        setDragX(0);
        setIsAnimating(false);
        setAnimClass("");
        onComplete(set);
      }, 300);

    } else if (finalDx <= -THRESHOLD_ACTION) {
      // ── Skip ─────────────────────────────────────────────────────────────
      hasFired.current = true;
      vibrate("warning");
      setIsAnimating(true);
      setAnimClass("shake-skip");
      setDragX(-MAX_DRAG * 1.5);
      setTimeout(() => {
        setDragX(0);
        setIsAnimating(false);
        setAnimClass("");
        onSkip(set);
      }, 300);

    } else {
      // ── Spring back ───────────────────────────────────────────────────────
      setIsAnimating(true);
      setDragX(0);
      setTimeout(() => setIsAnimating(false), 300);
    }
  }, [onComplete, onSkip, set, vibrate]);

  // ── Long-press on weight chip ───────────────────────────────────────────────
  const longPressHandlers = useLongPress(
    () => {
      vibrate("heavy");
      setShowWeightPop(true);
    },
    {
      delay: 450,
      onCancel: () => {},
    }
  );

  // Close popover on outside tap
  useEffect(() => {
    if (!showWeightPop) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowWeightPop(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [showWeightPop]);

  // ── Reveal background colours ───────────────────────────────────────────────
  const revealRight = dragX > THRESHOLD_START;
  const revealLeft  = dragX < -THRESHOLD_START;
  const rightPct    = Math.min(1, (dragX - THRESHOLD_START) / (THRESHOLD_ACTION - THRESHOLD_START));
  const leftPct     = Math.min(1, (-dragX - THRESHOLD_START) / (THRESHOLD_ACTION - THRESHOLD_START));

  // ── Completed row — static, no swipe ───────────────────────────────────────
  if (isCompleted) {
    return (
      <div
        className="set-row completed flex-col gap-2"
        data-testid={`set-row-${set.id}`}
      >
        <div className="flex items-center gap-3 w-full">
          <div className="w-8 h-8 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-sm font-bold font-display flex-shrink-0">
            <Check size={14} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm line-through text-muted-foreground">
                {set.targetReps}{set.isAmrap ? "+" : ""} × {set.targetWeight} kg
              </span>
              {set.isAmrap && (
                <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">AMRAP</Badge>
              )}
            </div>
            {set.actualReps && (
              <p className="text-xs text-green-400">
                ✓ {set.actualReps} × {set.actualWeight} kg
                {set.rpe ? ` · RPE ${set.rpe}` : ""}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Active incomplete row with gesture layer ────────────────────────────────
  const transitionStyle = isAnimating
    ? { transition: "transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)" }
    : {};

  return (
    <div
      ref={wrapperRef}
      className={cn("relative overflow-hidden rounded-2xl", animClass === "shake-skip" && "animate-shake")}
      style={{ transform: 'translateZ(0)', willChange: 'transform' }}
      data-testid={`set-row-${set.id}`}
    >
      {/* ── Reveal: RIGHT (complete) ── */}
      <div
        className="absolute inset-y-0 left-0 w-full flex items-center px-6 rounded-2xl pointer-events-none"
        style={{
          background: `rgba(34, 197, 94, ${Math.min(0.25, rightPct * 0.25)})`,
          opacity: revealRight ? 1 : 0,
          transition: dragX === 0 ? "opacity 0.2s" : "none",
        }}
      >
        <div
          className="flex items-center gap-2 text-green-400 font-display font-bold text-sm"
          style={{ transform: `scale(${0.8 + rightPct * 0.2})`, opacity: rightPct }}
        >
          <Check size={18} strokeWidth={2.5} />
          {dragX >= THRESHOLD_ACTION ? "Loslassen!" : "Abschließen"}
        </div>
      </div>

      {/* ── Reveal: LEFT (skip) ── */}
      <div
        className="absolute inset-y-0 right-0 w-full flex items-center justify-end px-6 rounded-2xl pointer-events-none"
        style={{
          background: `rgba(239, 68, 68, ${Math.min(0.25, leftPct * 0.25)})`,
          opacity: revealLeft ? 1 : 0,
          transition: dragX === 0 ? "opacity 0.2s" : "none",
        }}
      >
        <div
          className="flex items-center gap-2 text-red-400 font-display font-bold text-sm"
          style={{ transform: `scale(${0.8 + leftPct * 0.2})`, opacity: leftPct }}
        >
          {dragX <= -THRESHOLD_ACTION ? "Loslassen!" : "Überspringen"}
          <SkipForward size={18} strokeWidth={2.5} />
        </div>
      </div>

      {/* ── Draggable card ── */}
      <div
        className={cn(
          "set-row flex-col gap-2 relative bg-card will-change-transform",
          set.isAmrap && "amrap",
          animClass === "pulse-complete" && "animate-pulse-complete",
        )}
        style={{
          transform: `translateX(${dragX}px)`,
          touchAction: "pan-y",
          ...transitionStyle,
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="flex items-center gap-3 w-full">
          {/* Set number */}
          <div className="w-8 h-8 rounded-full bg-secondary text-muted-foreground flex items-center justify-center text-sm font-bold font-display flex-shrink-0">
            {set.setNumber}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">
                {set.targetReps}{set.isAmrap ? "+" : ""} ×
              </span>

              {/* Weight chip — long-pressable */}
              <div className="relative inline-block">
                <button
                  {...longPressHandlers}
                  className={cn(
                    "px-2.5 py-0.5 rounded-full text-sm font-bold font-display border transition-all duration-150 select-none",
                    showWeightPop
                      ? "border-primary bg-primary/15 text-primary scale-105"
                      : "border-border bg-secondary/60 text-foreground active:scale-95",
                  )}
                  data-testid={`chip-weight-${set.id}`}
                  aria-label="Gewicht halten zum Bearbeiten"
                >
                  {input.weight || set.targetWeight} kg
                </button>

                {/* Weight popover */}
                {showWeightPop && (
                  <WeightPopover
                    value={input.weight || String(set.targetWeight)}
                    onChange={(v) => onInputChange(set.id, { weight: v })}
                    onClose={() => setShowWeightPop(false)}
                  />
                )}
              </div>

              {set.isAmrap && (
                <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">AMRAP</Badge>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Wischen → fertig · ← skip · Gewicht halten zum Editieren
            </p>
          </div>

          {/* Expand / Complete buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onToggleExpand}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              data-testid={`button-expand-set-${set.id}`}
            >
              {isActive ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <Button
              size="sm"
              onClick={() => {
                vibrate("success");
                onComplete(set);
              }}
              className="gradient-orange text-white border-0 hover:opacity-90 text-xs px-3 active:scale-95 transition-transform"
              disabled={isPending}
              data-testid={`button-complete-set-${set.id}`}
            >
              <Check size={12} className="mr-1" />
              Fertig
            </Button>
          </div>
        </div>

        {/* Expanded input panel */}
        {isActive && (
          <div className="w-full grid grid-cols-3 gap-2 pt-2 border-t border-border mt-1">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Wiederholungen</p>
              <Input
                type="number"
                inputMode="numeric"
                placeholder={set.targetReps.toString()}
                value={input.reps ?? ""}
                onChange={(e) => onInputChange(set.id, { reps: e.target.value })}
                className="h-9 bg-background border-border text-sm"
                data-testid={`input-reps-${set.id}`}
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Gewicht (kg)</p>
              <Input
                type="number"
                inputMode="decimal"
                placeholder={set.targetWeight.toString()}
                value={input.weight ?? ""}
                onChange={(e) => onInputChange(set.id, { weight: e.target.value })}
                className="h-9 bg-background border-border text-sm"
                data-testid={`input-weight-${set.id}`}
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                RPE: <span className="text-primary">{input.rpe ?? 8}</span>
              </p>
              <Slider
                min={5} max={10} step={0.5}
                value={[input.rpe ?? 8]}
                onValueChange={([v]) => onInputChange(set.id, { rpe: v })}
                className="mt-2"
                data-testid={`slider-rpe-${set.id}`}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
