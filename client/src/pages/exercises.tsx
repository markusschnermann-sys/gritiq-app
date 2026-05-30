/**
 * ExercisesPage — filter/card UI + Personal Exercise Log & PR Tracker.
 * Each exercise card links to a log drawer that shows:
 *   - A mini Recharts line chart (best weight per session over time)
 *   - A PR badge (auto-surfaced when a new best is hit)
 *   - A log entry form (sets × reps × weight per set)
 *   - Full session history table
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Search, Plus, Dumbbell, Trash2, ChevronDown, ChevronUp,
  ExternalLink, X, SlidersHorizontal, ArrowUpDown, Trophy,
  ClipboardList, Minus, BarChart2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { Exercise } from "@shared/schema";

// ── Types ────────────────────────────────────────────────────────────────────
interface LogSet { weight: number; reps: number; notes?: string }
interface ExerciseLog { id: number; exerciseId: number; userId: number; date: string; sets: string; createdAt: string }
interface ExercisePr  { id: number; exerciseId: number; userId: number; bestWeight: number; bestReps: number; bestVolume: number; achievedAt: string }

// ── Movement-pattern taxonomy ─────────────────────────────────────────────
const PATTERN_MAP: Record<string, string> = {
  chest: "push", shoulders: "push", triceps: "push",
  back: "pull", biceps: "pull",
  legs: "legs", glutes: "glutes",
  core: "core", fullbody: "fullbody",
};

const PATTERNS = [
  { key: "", label: "Alle" },
  { key: "push", label: "Push", icon: "↑" },
  { key: "pull", label: "Pull", icon: "↓" },
  { key: "legs", label: "Beine", icon: "⊕" },
  { key: "glutes", label: "Gesäß", icon: "□" },
  { key: "core", label: "Core", icon: "◎" },
  { key: "fullbody", label: "Ganzkörper", icon: "⚡" },
];

const MUSCLE_GROUPS = [
  { key: "", label: "Alle" },
  { key: "chest", label: "Brust" },
  { key: "back", label: "Rücken" },
  { key: "legs", label: "Beine" },
  { key: "shoulders", label: "Schultern" },
  { key: "biceps", label: "Bizeps" },
  { key: "triceps", label: "Trizeps" },
  { key: "core", label: "Core" },
  { key: "glutes", label: "Gesäß" },
  { key: "fullbody", label: "Ganzkörper" },
];

const EQUIPMENT_OPTIONS = [
  { key: "", label: "Equipment" },
  { key: "barbell", label: "Langhantel" },
  { key: "dumbbell", label: "Kurzhantel" },
  { key: "bodyweight", label: "Eigengewicht" },
  { key: "machine", label: "Maschine" },
  { key: "cable", label: "Kabel" },
  { key: "kettlebell", label: "Kettlebell" },
];

const GOAL_OPTIONS = [
  { key: "", label: "Ziel" },
  { key: "powerlifting", label: "Powerlifting" },
  { key: "bodybuilding", label: "Bodybuilding" },
  { key: "weightloss", label: "Abnehmen" },
];

const SORT_OPTIONS = [
  { key: "az", label: "A–Z" },
  { key: "za", label: "Z–A" },
  { key: "muscle", label: "Muskelgruppe" },
  { key: "compound", label: "Compound zuerst" },
];

const EQUIPMENT_COLORS: Record<string, string> = {
  barbell:    "bg-orange-500/20 text-orange-400 border-orange-500/30",
  dumbbell:   "bg-blue-500/20 text-blue-400 border-blue-500/30",
  machine:    "bg-purple-500/20 text-purple-400 border-purple-500/30",
  cable:      "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  bodyweight: "bg-green-500/20 text-green-400 border-green-500/30",
  kettlebell: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

const EQUIPMENT_LABELS: Record<string, string> = {
  barbell: "Langhantel", dumbbell: "Kurzhantel", machine: "Maschine",
  cable: "Kabel", bodyweight: "Eigengewicht", kettlebell: "Kettlebell",
};

const GOAL_LABELS: Record<string, string> = {
  powerlifting: "Powerlifting", bodybuilding: "Bodybuilding", weightloss: "Abnehmen",
};

// ── YouTube video map ──────────────────────────────────────────────────────
const VIDEO_MAP: Record<string, string> = {
  // Chest
  "bench press": "https://www.youtube.com/watch?v=vcBig73ojpE",
  "incline bench press": "https://www.youtube.com/watch?v=8iPEnn-ltC8",
  "dumbbell bench press": "https://www.youtube.com/watch?v=VmB1G1K7v94",
  "incline dumbbell press": "https://www.youtube.com/watch?v=8iPEnn-ltC8",
  "chest fly": "https://www.youtube.com/watch?v=eozdVDA78K0",
  "cable fly": "https://www.youtube.com/watch?v=Iwe6AmxVf7o",
  "chest dips": "https://www.youtube.com/watch?v=yN6Q1UI_xkE",
  "decline bench press": "https://www.youtube.com/watch?v=LfyQBUKR8SE",
  "push-up": "https://www.youtube.com/watch?v=IODxDxX7oi4",
  "pec deck machine": "https://www.youtube.com/watch?v=Z57CtFmRMxA",
  // Back
  "deadlift": "https://www.youtube.com/watch?v=MBbyAqvTNkU",
  "romanian deadlift": "https://www.youtube.com/watch?v=JCXUYuzwNrM",
  "pull-up": "https://www.youtube.com/watch?v=eGo4IYlbE5g",
  "lat pulldown": "https://www.youtube.com/watch?v=CAwf7n6Luuc",
  "barbell row": "https://www.youtube.com/watch?v=FWJR5Ve8bnQ",
  "dumbbell row": "https://www.youtube.com/watch?v=pYcpY20QaE8",
  "cable row": "https://www.youtube.com/watch?v=GZbfZ033f74",
  "t-bar row": "https://www.youtube.com/watch?v=j3ZaKBKqQIM",
  "sumo deadlift": "https://www.youtube.com/watch?v=RF8SZmFERSA",
  "rack pull": "https://www.youtube.com/watch?v=jHBrVsGQ4nk",
  "back extension": "https://www.youtube.com/watch?v=ph3pddpKzzw",
  // Legs
  "squat": "https://www.youtube.com/watch?v=ultWZbUMPL8",
  "front squat": "https://www.youtube.com/watch?v=m4ytaCJZpl0",
  "hack squat": "https://www.youtube.com/watch?v=0tn5K9NlCfo",
  "leg press": "https://www.youtube.com/watch?v=IZxyjW7MPJQ",
  "lunge": "https://www.youtube.com/watch?v=QOVaHwm-Q6U",
  "bulgarian split squat": "https://www.youtube.com/watch?v=2C-uNgKwPLE",
  "leg extension": "https://www.youtube.com/watch?v=YyvSfVjQeL0",
  "lying leg curl": "https://www.youtube.com/watch?v=ELOCsoDSmrg",
  "seated leg curl": "https://www.youtube.com/watch?v=1Tq3QdYUuHs",
  "standing calf raise": "https://www.youtube.com/watch?v=-M4-G8p1fCI",
  "seated calf raise": "https://www.youtube.com/watch?v=JbyjNymZOt0",
  "goblet squat": "https://www.youtube.com/watch?v=MeIiIdhvXT4",
  "box squat": "https://www.youtube.com/watch?v=DCRckMsRq5A",
  // Shoulders
  "overhead press": "https://www.youtube.com/watch?v=nNMR9fRGRjQ",
  "dumbbell shoulder press": "https://www.youtube.com/watch?v=qEwKCR5JCog",
  "lateral raise": "https://www.youtube.com/watch?v=XPPfnSEATJA",
  "front raise": "https://www.youtube.com/watch?v=sOoBnVxA0go",
  "cable lateral raise": "https://www.youtube.com/watch?v=PPdLMb-UtLQ",
  "arnold press": "https://www.youtube.com/watch?v=3ml7BH7mNwQ",
  "reverse fly": "https://www.youtube.com/watch?v=ttvAjHVNHCg",
  "face pull": "https://www.youtube.com/watch?v=rep-qVOkqgk",
  "push press": "https://www.youtube.com/watch?v=iaBVSJm78ko",
  // Biceps
  "dumbbell curl": "https://www.youtube.com/watch?v=ykJmrZ5v0Oo",
  "barbell curl": "https://www.youtube.com/watch?v=kwG2ipFRgfo",
  "hammer curl": "https://www.youtube.com/watch?v=zC3nLlEvin4",
  "cable curl": "https://www.youtube.com/watch?v=NFzTWp2qpiE",
  "concentration curl": "https://www.youtube.com/watch?v=0AUGkch3tzc",
  "preacher curl": "https://www.youtube.com/watch?v=fIWP-FRFNU0",
  // Triceps
  "triceps dips": "https://www.youtube.com/watch?v=6kALZikXxLc",
  "triceps pushdown": "https://www.youtube.com/watch?v=2-LAMcpzODU",
  "skull crusher": "https://www.youtube.com/watch?v=d_KZxkY_0cM",
  "close-grip bench press": "https://www.youtube.com/watch?v=nEF0bv2FW94",
  "overhead triceps extension": "https://www.youtube.com/watch?v=_gsUck-7M74",
  "triceps kickback": "https://www.youtube.com/watch?v=6SS6K3lAwZ8",
  // Core
  "plank": "https://www.youtube.com/watch?v=pSHjTRCQxIw",
  "crunches": "https://www.youtube.com/watch?v=Xyd_fa5zoEU",
  "hanging leg raise": "https://www.youtube.com/watch?v=hdng3Nm1x_E",
  "ab wheel rollout": "https://www.youtube.com/watch?v=pgOZSMtF3h4",
  "russian twist": "https://www.youtube.com/watch?v=wkD8rjkodUI",
  "pallof press": "https://www.youtube.com/watch?v=AH_QZLm_0-s",
  "side plank": "https://www.youtube.com/watch?v=_rdfjFSFKMY",
  "dragon flag": "https://www.youtube.com/watch?v=pvz7k5gO-DE",
  "cable crunch": "https://www.youtube.com/watch?v=AKG0OULknC8",
  // Glutes
  "hip thrust": "https://www.youtube.com/watch?v=SEdqd1n0cvg",
  "glute bridge": "https://www.youtube.com/watch?v=wPM8icPu6H8",
  "cable kickback": "https://www.youtube.com/watch?v=3K9AutCS3f4",
  "sumo squat": "https://www.youtube.com/watch?v=qv1EZYmxh-s",
  "good morning": "https://www.youtube.com/watch?v=YA-h3n9L4YU",
  // Full body
  "kettlebell swing": "https://www.youtube.com/watch?v=sSESeQAir2M",
  "burpee": "https://www.youtube.com/watch?v=dZgVxmf6jkA",
  "thruster": "https://www.youtube.com/watch?v=L8fvypPrzzs",
  "db romanian deadlift": "https://www.youtube.com/watch?v=JCXUYuzwNrM",
  "clean and press": "https://www.youtube.com/watch?v=72AOGNI9LpE",
  "trap bar deadlift": "https://www.youtube.com/watch?v=wVbJaGBvnPQ",
};

function getVideoUrl(ex: Exercise): string | null {
  const key = (ex.nameEn ?? ex.name).toLowerCase().trim();
  return VIDEO_MAP[key] ?? null;
}

// ── Muscle silhouette thumbnails (SVG) ────────────────────────────────────
// Anatomy-accurate front-view body silhouette (viewBox 0 0 80 120)
// Grey = body base, colored = target muscle group
function MuscleThumbnail({ muscleGroup }: { muscleGroup: string }) {
  const BODY = `
    <!-- head -->
    <ellipse cx="40" cy="8" rx="7" ry="8" fill="#2e2e2e"/>
    <!-- neck -->
    <rect x="36" y="14" width="8" height="5" rx="2" fill="#2e2e2e"/>
    <!-- torso -->
    <path d="M22 19 Q18 22 18 30 L20 60 Q20 64 40 64 Q60 64 60 60 L62 30 Q62 22 58 19 Z" fill="#2e2e2e"/>
    <!-- left upper arm -->
    <path d="M22 21 Q12 24 10 36 Q10 42 14 44 Q18 46 20 42 L22 34 Z" fill="#2e2e2e"/>
    <!-- right upper arm -->
    <path d="M58 21 Q68 24 70 36 Q70 42 66 44 Q62 46 60 42 L58 34 Z" fill="#2e2e2e"/>
    <!-- left forearm -->
    <path d="M14 44 Q10 52 11 60 Q12 64 15 64 Q18 64 19 60 L20 50 Z" fill="#262626"/>
    <!-- right forearm -->
    <path d="M66 44 Q70 52 69 60 Q68 64 65 64 Q62 64 61 60 L60 50 Z" fill="#262626"/>
    <!-- left thigh -->
    <path d="M25 64 Q22 70 22 84 Q22 94 27 96 Q32 98 34 90 L35 64 Z" fill="#2e2e2e"/>
    <!-- right thigh -->
    <path d="M55 64 Q58 70 58 84 Q58 94 53 96 Q48 98 46 90 L45 64 Z" fill="#2e2e2e"/>
    <!-- left calf -->
    <path d="M27 96 Q24 104 25 112 Q26 116 29 116 Q33 116 34 112 L34 96 Z" fill="#262626"/>
    <!-- right calf -->
    <path d="M53 96 Q56 104 55 112 Q54 116 51 116 Q47 116 46 112 L46 96 Z" fill="#262626"/>
  `;

  const highlights: Record<string, { color: string; svg: string }> = {
    chest: {
      color: "#FF6B1A",
      svg: `
        <!-- pec major left -->
        <path d="M24 22 Q22 28 23 34 Q28 38 34 36 L36 26 Q31 20 24 22 Z" fill="#FF6B1A" opacity="0.92"/>
        <!-- pec major right -->
        <path d="M56 22 Q58 28 57 34 Q52 38 46 36 L44 26 Q49 20 56 22 Z" fill="#FF6B1A" opacity="0.92"/>
        <!-- sternal notch line -->
        <line x1="40" y1="20" x2="40" y2="36" stroke="#1a1a1a" stroke-width="0.8" opacity="0.4"/>
      `,
    },
    back: {
      color: "#3B82F6",
      svg: `
        <!-- upper traps -->
        <path d="M26 19 Q22 21 22 26 Q28 28 34 26 L36 20 Z" fill="#3B82F6" opacity="0.75"/>
        <path d="M54 19 Q58 21 58 26 Q52 28 46 26 L44 20 Z" fill="#3B82F6" opacity="0.75"/>
        <!-- lats left -->
        <path d="M22 28 Q19 36 20 46 Q24 50 30 48 L34 36 Q28 30 22 28 Z" fill="#3B82F6" opacity="0.88"/>
        <!-- lats right -->
        <path d="M58 28 Q61 36 60 46 Q56 50 50 48 L46 36 Q52 30 58 28 Z" fill="#3B82F6" opacity="0.88"/>
        <!-- lower back -->
        <path d="M32 48 Q28 54 30 60 Q35 62 40 62 Q45 62 50 60 Q52 54 48 48 Z" fill="#3B82F6" opacity="0.7"/>
      `,
    },
    legs: {
      color: "#10B981",
      svg: `
        <!-- left quad -->
        <path d="M25 65 Q22 72 22 84 Q22 93 27 95 Q32 97 34 89 L35 65 Z" fill="#10B981" opacity="0.92"/>
        <!-- right quad -->
        <path d="M55 65 Q58 72 58 84 Q58 93 53 95 Q48 97 46 89 L45 65 Z" fill="#10B981" opacity="0.92"/>
        <!-- left calf -->
        <path d="M27 96 Q24 104 25 112 Q26 115 29 115 Q33 115 34 111 L34 97 Z" fill="#10B981" opacity="0.75"/>
        <!-- right calf -->
        <path d="M53 96 Q56 104 55 112 Q54 115 51 115 Q47 115 46 111 L46 97 Z" fill="#10B981" opacity="0.75"/>
        <!-- VMO inner left -->
        <ellipse cx="30" cy="92" rx="4" ry="3" fill="#10B981" opacity="0.6"/>
        <!-- VMO inner right -->
        <ellipse cx="50" cy="92" rx="4" ry="3" fill="#10B981" opacity="0.6"/>
      `,
    },
    shoulders: {
      color: "#8B5CF6",
      svg: `
        <!-- left deltoid -->
        <path d="M22 20 Q13 23 11 32 Q12 38 16 40 Q20 42 22 36 L23 24 Z" fill="#8B5CF6" opacity="0.92"/>
        <!-- right deltoid -->
        <path d="M58 20 Q67 23 69 32 Q68 38 64 40 Q60 42 58 36 L57 24 Z" fill="#8B5CF6" opacity="0.92"/>
        <!-- lateral cap left -->
        <ellipse cx="16" cy="30" rx="5" ry="7" fill="#8B5CF6" opacity="0.5"/>
        <!-- lateral cap right -->
        <ellipse cx="64" cy="30" rx="5" ry="7" fill="#8B5CF6" opacity="0.5"/>
      `,
    },
    biceps: {
      color: "#06B6D4",
      svg: `
        <!-- left bicep peak -->
        <path d="M13 30 Q11 36 12 42 Q14 46 18 46 Q20 44 20 40 L20 32 Q17 28 13 30 Z" fill="#06B6D4" opacity="0.92"/>
        <!-- right bicep peak -->
        <path d="M67 30 Q69 36 68 42 Q66 46 62 46 Q60 44 60 40 L60 32 Q63 28 67 30 Z" fill="#06B6D4" opacity="0.92"/>
        <!-- bicep short head bulge -->
        <ellipse cx="16" cy="38" rx="3.5" ry="5" fill="#06B6D4" opacity="0.55"/>
        <ellipse cx="64" cy="38" rx="3.5" ry="5" fill="#06B6D4" opacity="0.55"/>
      `,
    },
    triceps: {
      color: "#F59E0B",
      svg: `
        <!-- left tricep (posterior upper arm) -->
        <path d="M22 24 Q12 26 10 36 Q10 43 14 45 Q17 44 18 40 L20 30 Z" fill="#F59E0B" opacity="0.88"/>
        <!-- right tricep -->
        <path d="M58 24 Q68 26 70 36 Q70 43 66 45 Q63 44 62 40 L60 30 Z" fill="#F59E0B" opacity="0.88"/>
        <!-- horseshoe detail -->
        <path d="M12 36 Q11 40 13 43" stroke="#F59E0B" stroke-width="1.5" fill="none" opacity="0.6"/>
        <path d="M68 36 Q69 40 67 43" stroke="#F59E0B" stroke-width="1.5" fill="none" opacity="0.6"/>
      `,
    },
    core: {
      color: "#EF4444",
      svg: `
        <!-- rectus abdominis blocks -->
        <rect x="33" y="38" width="6" height="5" rx="1.5" fill="#EF4444" opacity="0.9"/>
        <rect x="41" y="38" width="6" height="5" rx="1.5" fill="#EF4444" opacity="0.9"/>
        <rect x="33" y="45" width="6" height="5" rx="1.5" fill="#EF4444" opacity="0.9"/>
        <rect x="41" y="45" width="6" height="5" rx="1.5" fill="#EF4444" opacity="0.9"/>
        <rect x="33" y="52" width="6" height="5" rx="1.5" fill="#EF4444" opacity="0.85"/>
        <rect x="41" y="52" width="6" height="5" rx="1.5" fill="#EF4444" opacity="0.85"/>
        <!-- linea alba -->
        <line x1="40" y1="36" x2="40" y2="60" stroke="#1a1a1a" stroke-width="0.8" opacity="0.5"/>
        <!-- obliques -->
        <path d="M26 40 Q24 50 26 58 Q30 56 32 50 L32 40 Z" fill="#EF4444" opacity="0.6"/>
        <path d="M54 40 Q56 50 54 58 Q50 56 48 50 L48 40 Z" fill="#EF4444" opacity="0.6"/>
      `,
    },
    glutes: {
      color: "#EC4899",
      svg: `
        <!-- gluteus maximus left -->
        <path d="M24 60 Q21 68 22 78 Q24 86 30 88 Q36 88 36 80 L36 62 Q30 58 24 60 Z" fill="#EC4899" opacity="0.9"/>
        <!-- gluteus maximus right -->
        <path d="M56 60 Q59 68 58 78 Q56 86 50 88 Q44 88 44 80 L44 62 Q50 58 56 60 Z" fill="#EC4899" opacity="0.9"/>
        <!-- gluteal crease -->
        <path d="M36 80 Q38 84 40 84 Q42 84 44 80" stroke="#1a1a1a" stroke-width="0.8" fill="none" opacity="0.4"/>
        <!-- upper glute highlight -->
        <ellipse cx="29" cy="68" rx="5" ry="4" fill="#EC4899" opacity="0.4"/>
        <ellipse cx="51" cy="68" rx="5" ry="4" fill="#EC4899" opacity="0.4"/>
      `,
    },
    fullbody: {
      color: "#FF6B1A",
      svg: `
        <!-- shoulders -->
        <path d="M22 20 Q14 23 12 32 Q14 38 18 40 L20 34 Z" fill="#FF6B1A" opacity="0.7"/>
        <path d="M58 20 Q66 23 68 32 Q66 38 62 40 L60 34 Z" fill="#FF6B1A" opacity="0.7"/>
        <!-- chest -->
        <path d="M25 23 Q23 30 24 35 Q30 38 35 36 L36 26 Z" fill="#FF6B1A" opacity="0.8"/>
        <path d="M55 23 Q57 30 56 35 Q50 38 45 36 L44 26 Z" fill="#FF6B1A" opacity="0.8"/>
        <!-- abs -->
        <rect x="34" y="40" width="5" height="4" rx="1" fill="#FF6B1A" opacity="0.75"/>
        <rect x="41" y="40" width="5" height="4" rx="1" fill="#FF6B1A" opacity="0.75"/>
        <rect x="34" y="46" width="5" height="4" rx="1" fill="#FF6B1A" opacity="0.75"/>
        <rect x="41" y="46" width="5" height="4" rx="1" fill="#FF6B1A" opacity="0.75"/>
        <!-- quads -->
        <path d="M25 65 Q22 76 23 88 Q27 94 32 92 L34 65 Z" fill="#FF6B1A" opacity="0.7"/>
        <path d="M55 65 Q58 76 57 88 Q53 94 48 92 L46 65 Z" fill="#FF6B1A" opacity="0.7"/>
        <!-- arms -->
        <ellipse cx="15" cy="36" rx="3" ry="8" fill="#FF6B1A" opacity="0.65"/>
        <ellipse cx="65" cy="36" rx="3" ry="8" fill="#FF6B1A" opacity="0.65"/>
      `,
    },
  };

  const h = highlights[muscleGroup] ?? highlights.fullbody;

  return (
    <svg viewBox="0 0 80 120" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <g dangerouslySetInnerHTML={{ __html: BODY }} />
      <g dangerouslySetInnerHTML={{ __html: h.svg }} />
    </svg>
  );
}

// ── Log Drawer ────────────────────────────────────────────────────────────
function LogDrawer({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const { toast } = useToast();

  // Session log rows — starts with 1 empty set
  const [logSets, setLogSets] = useState<{ weight: string; reps: string; notes: string }[]>([
    { weight: "", reps: "", notes: "" },
  ]);
  const [logDate, setLogDate] = useState(() => new Date().toISOString().split("T")[0]);

  const { data: logs = [], isLoading: logsLoading } = useQuery<ExerciseLog[]>({
    queryKey: ["/api/exercises", exercise.id, "logs"],
    queryFn: async () => (await apiRequest("GET", `/api/exercises/${exercise.id}/logs`)).json(),
    staleTime: 0,
  });

  const { data: pr } = useQuery<ExercisePr | null>({
    queryKey: ["/api/exercises", exercise.id, "pr"],
    queryFn: async () => (await apiRequest("GET", `/api/exercises/${exercise.id}/pr`)).json(),
    staleTime: 0,
  });

  const logMutation = useMutation({
    mutationFn: async () => {
      const validSets = logSets
        .filter(s => s.weight !== "" && s.reps !== "")
        .map(s => ({ weight: parseFloat(s.weight), reps: parseInt(s.reps), notes: s.notes || null }));
      if (validSets.length === 0) throw new Error("Kein gültiger Satz eingegeben.");
      return (await apiRequest("POST", `/api/exercises/${exercise.id}/logs`, {
        sets: validSets,
        date: logDate,
      })).json();
    },
    onSuccess: (data: { isNewPr: boolean }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercises", exercise.id, "logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/exercises", exercise.id, "pr"] });
      setLogSets([{ weight: "", reps: "", notes: "" }]);
      if (data.isNewPr) {
        toast({ title: "🏆 Neuer PR!", description: `Persönlicher Rekord für ${exercise.name}!` });
      } else {
        toast({ title: "Einheit gespeichert" });
      }
    },
    onError: (err: Error) =>
      toast({ title: "Fehler", description: err.message, variant: "destructive" }),
  });

  // Build chart data — best weight per session date
  const chartData = useMemo(() => {
    return logs.map(log => {
      const sets: LogSet[] = JSON.parse(log.sets);
      const best = sets.reduce((b, s) => s.weight > b ? s.weight : b, 0);
      return { date: log.date.slice(5), weight: best }; // MM-DD for axis
    });
  }, [logs]);

  const parsedLogs = useMemo(() =>
    logs.map(l => ({ ...l, parsedSets: JSON.parse(l.sets) as LogSet[] }))
  , [logs]);

  const addSet = () => setLogSets(s => [...s, { weight: "", reps: "", notes: "" }]);
  const removeSet = (i: number) => setLogSets(s => s.filter((_, idx) => idx !== i));
  const updateSet = (i: number, field: keyof typeof logSets[0], val: string) =>
    setLogSets(s => s.map((row, idx) => idx === i ? { ...row, [field]: val } : row));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      data-testid="log-drawer-overlay"
    >
      <div
        className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto shadow-2xl flex flex-col"
        style={{ overscrollBehavior: 'contain' }}
        data-testid="log-drawer"
      >
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <ClipboardList size={16} className="text-primary" />
            <div>
              <p className="font-display font-bold text-sm text-foreground leading-tight">{exercise.name}</p>
              {exercise.nameEn && <p className="text-[10px] text-muted-foreground">{exercise.nameEn}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground" data-testid="log-drawer-close">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-5 flex-1">
          {/* PR Banner */}
          {pr && (
            <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-3 py-2.5" data-testid="pr-banner">
              <Trophy size={16} className="text-yellow-400 flex-shrink-0" />
              <div>
                <p className="text-xs font-display font-bold text-yellow-400">Persönlicher Rekord</p>
                <p className="text-[11px] text-muted-foreground">
                  {pr.bestWeight} kg × {pr.bestReps} Wdh — {pr.achievedAt}
                </p>
              </div>
            </div>
          )}

          {/* Progress chart */}
          {chartData.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <BarChart2 size={13} className="text-primary" />
                <p className="text-[11px] font-display font-bold text-muted-foreground uppercase tracking-wider">Fortschritt (bestes Gewicht)</p>
              </div>
              <div className="bg-background/60 border border-border/50 rounded-xl p-3 h-36" data-testid="progress-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 9, fill: "#888" }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: "#888" }}
                      tickLine={false}
                      axisLine={false}
                      width={40}
                      tickFormatter={v => `${v}kg`}
                    />
                    <Tooltip
                      contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, fontSize: 11 }}
                      labelStyle={{ color: "#aaa" }}
                      itemStyle={{ color: "#FF6B1A" }}
                      formatter={(v: number) => [`${v} kg`, "Bestes Gewicht"]}
                    />
                    {pr && (
                      <ReferenceLine
                        y={pr.bestWeight}
                        stroke="#F59E0B"
                        strokeDasharray="3 3"
                        strokeWidth={1}
                        label={{ value: "PR", fill: "#F59E0B", fontSize: 9, position: "right" }}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="weight"
                      stroke="#FF6B1A"
                      strokeWidth={2}
                      dot={{ fill: "#FF6B1A", r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: "#FF6B1A", strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Log form */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-display font-bold text-muted-foreground uppercase tracking-wider">Neue Einheit loggen</p>
              <input
                type="date"
                value={logDate}
                onChange={e => setLogDate(e.target.value)}
                className="text-[11px] bg-background border border-border rounded-lg px-2 py-1 text-muted-foreground"
                data-testid="log-date-input"
              />
            </div>

            {/* Sets table */}
            <div className="space-y-2">
              {/* Header row */}
              <div className="grid grid-cols-[28px_1fr_1fr_1fr_28px] gap-1.5 px-0.5">
                <span className="text-[9px] text-muted-foreground/60 font-semibold text-center">#</span>
                <span className="text-[9px] text-muted-foreground/60 font-semibold">kg</span>
                <span className="text-[9px] text-muted-foreground/60 font-semibold">Wdh</span>
                <span className="text-[9px] text-muted-foreground/60 font-semibold">Notiz</span>
                <span />
              </div>
              {logSets.map((s, i) => (
                <div key={i} className="grid grid-cols-[28px_1fr_1fr_1fr_28px] gap-1.5 items-center" data-testid={`log-set-row-${i}`}>
                  <span className="text-[11px] text-muted-foreground text-center font-semibold">{i + 1}</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="0"
                    value={s.weight}
                    onChange={e => updateSet(i, "weight", e.target.value)}
                    className="h-8 text-sm bg-background text-center px-2"
                    data-testid={`log-weight-${i}`}
                  />
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="0"
                    value={s.reps}
                    onChange={e => updateSet(i, "reps", e.target.value)}
                    className="h-8 text-sm bg-background text-center px-2"
                    data-testid={`log-reps-${i}`}
                  />
                  <Input
                    placeholder="—"
                    value={s.notes}
                    onChange={e => updateSet(i, "notes", e.target.value)}
                    className="h-8 text-xs bg-background px-2"
                  />
                  <button
                    onClick={() => removeSet(i)}
                    disabled={logSets.length === 1}
                    className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 disabled:opacity-30 transition-colors"
                  >
                    <Minus size={12} />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={addSet}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-semibold transition-colors"
                data-testid="button-add-set"
              >
                <Plus size={12} />Satz hinzufügen
              </button>
            </div>

            <Button
              onClick={() => logMutation.mutate()}
              disabled={logMutation.isPending || logSets.every(s => s.weight === "" || s.reps === "")}
              className="w-full gradient-orange text-white border-0 hover:opacity-90 font-display font-semibold h-10"
              data-testid="button-save-log"
            >
              {logMutation.isPending ? "Speichern…" : "Einheit speichern"}
            </Button>
          </div>

          {/* Session history */}
          {logsLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-muted/30 animate-pulse" />
              ))}
            </div>
          ) : parsedLogs.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[11px] font-display font-bold text-muted-foreground uppercase tracking-wider">
                Verlauf ({parsedLogs.length} {parsedLogs.length === 1 ? "Einheit" : "Einheiten"})
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {[...parsedLogs].reverse().map(log => {
                  const bestW = Math.max(...log.parsedSets.map(s => s.weight));
                  const totalVol = log.parsedSets.reduce((s, r) => s + r.weight * r.reps, 0);
                  const isPrDate = pr?.achievedAt === log.date;
                  return (
                    <div
                      key={log.id}
                      className={`rounded-xl border px-3 py-2.5 ${isPrDate ? "border-yellow-500/40 bg-yellow-500/5" : "border-border/60 bg-background/40"}`}
                      data-testid={`log-history-entry-${log.id}`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-foreground">{log.date}</span>
                          {isPrDate && <Trophy size={11} className="text-yellow-400" />}
                        </div>
                        <div className="flex gap-3 text-[10px] text-muted-foreground">
                          <span>Bestes: <strong className="text-foreground">{bestW} kg</strong></span>
                          <span>Vol: <strong className="text-foreground">{totalVol.toFixed(0)} kg</strong></span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {log.parsedSets.map((s, idx) => (
                          <span key={idx} className="text-[10px] bg-muted/40 text-muted-foreground px-2 py-0.5 rounded-full border border-border/40">
                            {s.weight}kg × {s.reps}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground/60">
              <ClipboardList size={28} className="mx-auto mb-2 opacity-40" />
              <p className="text-xs">Noch kein Eintrag — erste Einheit starten!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function ExercisesPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [pattern, setPattern] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [equipment, setEquipment] = useState("");
  const [goal, setGoal] = useState("");
  const [sort, setSort] = useState("muscle");
  const [showFilters, setShowFilters] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [logExercise, setLogExercise] = useState<Exercise | null>(null);
  const [newExercise, setNewExercise] = useState({
    name: "", nameEn: "", muscleGroup: "chest", muscleGroupLabel: "Brust",
    equipment: "barbell", movementType: "compound",
  });

  const { data: allExercises = [], isLoading } = useQuery<Exercise[]>({
    queryKey: ["/api/exercises"],
    staleTime: 0,
    queryFn: async () => (await apiRequest("GET", "/api/exercises")).json(),
  });

  // Fetch PRs for all exercises to show PR badges on cards
  const { data: prMap = {} } = useQuery<Record<number, ExercisePr>>({
    queryKey: ["/api/exercises/prs-all"],
    staleTime: 0,
    queryFn: async () => {
      // Fetch PRs for exercises that have been logged — we'll batch-fetch
      // by requesting each exercise's PR only after we know it exists.
      // For simplicity, we fetch once and build a map from the exercise list.
      // PRs are cheap (single row per exercise), so we just do a lightweight approach:
      // fetch all exercise logs summary from a special endpoint, or lazily load.
      // For card badge display we rely on the individual PR queries loaded lazily.
      return {};
    },
  });

  // Client-side filtering + sorting
  const exercises = useMemo(() => {
    let list = [...allExercises];
    if (pattern) list = list.filter(e => PATTERN_MAP[e.muscleGroup] === pattern);
    if (muscleGroup) list = list.filter(e => e.muscleGroup === muscleGroup);
    if (equipment) list = list.filter(e => e.equipment === equipment);
    if (goal) list = list.filter(e => e.tags.split(",").map(t => t.trim()).includes(goal));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(q) || (e.nameEn ?? "").toLowerCase().includes(q));
    }
    switch (sort) {
      case "az": list.sort((a, b) => a.name.localeCompare(b.name)); break;
      case "za": list.sort((a, b) => b.name.localeCompare(a.name)); break;
      case "compound":
        list.sort((a, b) => {
          if (a.movementType === b.movementType) return a.name.localeCompare(b.name);
          return a.movementType === "compound" ? -1 : 1;
        });
        break;
      case "muscle":
      default:
        list.sort((a, b) => {
          const mg = a.muscleGroup.localeCompare(b.muscleGroup);
          return mg !== 0 ? mg : a.name.localeCompare(b.name);
        });
    }
    return list;
  }, [allExercises, pattern, muscleGroup, equipment, goal, search, sort]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof newExercise) =>
      (await apiRequest("POST", "/api/exercises", data)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercises"] });
      setShowCreate(false);
      setNewExercise({ name: "", nameEn: "", muscleGroup: "chest", muscleGroupLabel: "Brust", equipment: "barbell", movementType: "compound" });
      toast({ title: "Übung hinzugefügt" });
    },
    onError: () => toast({ title: "Fehler", description: "Übung konnte nicht erstellt werden.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/exercises/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercises"] });
      toast({ title: "Übung gelöscht" });
    },
  });

  const activeFilterCount = [pattern, muscleGroup, equipment, goal].filter(Boolean).length;
  const clearAll = () => { setPattern(""); setMuscleGroup(""); setEquipment(""); setGoal(""); setSearch(""); };

  const grouped = useMemo(() => {
    if (muscleGroup || pattern) return null;
    return MUSCLE_GROUPS.slice(1).reduce<Record<string, Exercise[]>>((acc, mg) => {
      const items = exercises.filter(e => e.muscleGroup === mg.key);
      if (items.length > 0) acc[mg.key] = items;
      return acc;
    }, {});
  }, [exercises, muscleGroup, pattern]);

  const totalCount = allExercises.length;
  const customCount = allExercises.filter(e => e.isCustom).length;

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Übungsbibliothek</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {exercises.length !== totalCount
              ? `${exercises.length} von ${totalCount} Übungen`
              : `${totalCount} Übungen · ${customCount} eigene`}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreate(v => !v)}
          className="gradient-orange text-white border-0 hover:opacity-90 font-display font-semibold min-h-[44px]"
          data-testid="button-create-exercise"
        >
          <Plus size={16} className="mr-1" />Eigene
        </Button>
      </div>

      {/* Create custom exercise */}
      {showCreate && (
        <div className="stat-card space-y-3 border-primary/30">
          <p className="font-display font-bold text-sm text-primary">Eigene Übung erstellen</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input
                placeholder="Name (z.B. Pause Squat)"
                value={newExercise.name}
                onChange={e => setNewExercise(p => ({ ...p, name: e.target.value }))}
                className="h-10 bg-background"
                data-testid="input-exercise-name"
              />
            </div>
            <div className="col-span-2 md:col-span-1">
              <Input
                placeholder="English name (optional)"
                value={newExercise.nameEn}
                onChange={e => setNewExercise(p => ({ ...p, nameEn: e.target.value }))}
                className="h-10 bg-background"
              />
            </div>
            <select
              value={newExercise.muscleGroup}
              onChange={e => {
                const mg = MUSCLE_GROUPS.find(m => m.key === e.target.value);
                setNewExercise(p => ({ ...p, muscleGroup: e.target.value, muscleGroupLabel: mg?.label ?? e.target.value }));
              }}
              className="h-10 rounded-md border border-input bg-background px-3 text-base text-foreground"
            >
              {MUSCLE_GROUPS.slice(1).map(mg => <option key={mg.key} value={mg.key}>{mg.label}</option>)}
            </select>
            <select
              value={newExercise.equipment}
              onChange={e => setNewExercise(p => ({ ...p, equipment: e.target.value }))}
              className="h-10 rounded-md border border-input bg-background px-3 text-base text-foreground"
            >
              {Object.entries(EQUIPMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select
              value={newExercise.movementType}
              onChange={e => setNewExercise(p => ({ ...p, movementType: e.target.value }))}
              className="h-10 rounded-md border border-input bg-background px-3 text-base text-foreground"
            >
              <option value="compound">Compound</option>
              <option value="isolation">Isolation</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>Abbrechen</Button>
            <Button
              className="flex-1 gradient-orange text-white border-0 hover:opacity-90"
              disabled={!newExercise.name.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate(newExercise)}
            >
              {createMutation.isPending ? "Speichert…" : "Übung speichern"}
            </Button>
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Übung suchen…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 pr-9 h-10 bg-background"
          data-testid="input-search"
        />
        {search && (
          <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setSearch("")}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* Movement pattern chips — full-bleed scrollable row */}
      <div className="-mx-4 md:mx-0 px-4 md:px-0">
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
        {PATTERNS.map(p => (
          <button
            key={p.key}
            onClick={() => { setPattern(p.key); setMuscleGroup(""); }}
            data-testid={`filter-pattern-${p.key || "all"}`}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold font-display border transition-colors ${
              pattern === p.key
                ? "gradient-orange text-white border-transparent"
                : "border-border text-muted-foreground hover:border-primary/40"
            }`}
          >
            {p.icon && <span className="text-[11px]">{p.icon}</span>}
            {p.label}
          </button>
        ))}
        <div className="w-px h-5 bg-border self-center mx-1 flex-shrink-0" />
        <button
          onClick={() => setShowFilters(v => !v)}
          data-testid="button-filters"
          className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold font-display border transition-colors relative ${
            activeFilterCount > 0 ? "border-primary/50 text-primary bg-primary/10" : "border-border text-muted-foreground hover:border-primary/40"
          }`}
        >
          <SlidersHorizontal size={12} />
          Filter
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white text-[9px] flex items-center justify-center font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>
        <div className="flex-shrink-0 flex items-center gap-1 border border-border rounded-full px-3 py-1.5">
          <ArrowUpDown size={11} className="text-muted-foreground" />
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="text-xs font-semibold font-display bg-transparent text-muted-foreground border-none outline-none cursor-pointer"
            data-testid="select-sort"
          >
            {SORT_OPTIONS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
      </div>

      </div>
      {/* Advanced filter panel */}
      {showFilters && (
        <div className="stat-card border-border/50 space-y-3 py-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Erweiterte Filter</p>
            {activeFilterCount > 0 && (
              <button onClick={clearAll} className="text-xs text-primary hover:underline flex items-center gap-1">
                <X size={11} /> Zurücksetzen
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <p className="text-[10px] font-display font-semibold text-muted-foreground uppercase tracking-wider">Muskelgruppe</p>
              <div className="flex flex-wrap gap-1.5">
                {MUSCLE_GROUPS.map(mg => (
                  <button
                    key={mg.key}
                    onClick={() => { setMuscleGroup(mg.key); setPattern(""); }}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                      muscleGroup === mg.key ? "gradient-orange text-white border-transparent" : "border-border text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    {mg.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-display font-semibold text-muted-foreground uppercase tracking-wider">Equipment</p>
              <div className="flex flex-wrap gap-1.5">
                {EQUIPMENT_OPTIONS.map(eq => (
                  <button
                    key={eq.key}
                    onClick={() => setEquipment(eq.key)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                      equipment === eq.key ? "gradient-orange text-white border-transparent" : "border-border text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    {eq.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-display font-semibold text-muted-foreground uppercase tracking-wider">Trainingsziel</p>
              <div className="flex flex-wrap gap-1.5">
                {GOAL_OPTIONS.map(g => (
                  <button
                    key={g.key}
                    onClick={() => setGoal(g.key)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                      goal === g.key ? "gradient-orange text-white border-transparent" : "border-border text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          {pattern && (
            <span className="flex items-center gap-1 text-xs bg-primary/15 text-primary border border-primary/30 px-2.5 py-1 rounded-full font-semibold">
              {PATTERNS.find(p => p.key === pattern)?.label}
              <button onClick={() => setPattern("")}><X size={10} /></button>
            </span>
          )}
          {muscleGroup && (
            <span className="flex items-center gap-1 text-xs bg-primary/15 text-primary border border-primary/30 px-2.5 py-1 rounded-full font-semibold">
              {MUSCLE_GROUPS.find(m => m.key === muscleGroup)?.label}
              <button onClick={() => setMuscleGroup("")}><X size={10} /></button>
            </span>
          )}
          {equipment && (
            <span className="flex items-center gap-1 text-xs bg-primary/15 text-primary border border-primary/30 px-2.5 py-1 rounded-full font-semibold">
              {EQUIPMENT_LABELS[equipment]}
              <button onClick={() => setEquipment("")}><X size={10} /></button>
            </span>
          )}
          {goal && (
            <span className="flex items-center gap-1 text-xs bg-primary/15 text-primary border border-primary/30 px-2.5 py-1 rounded-full font-semibold">
              {GOAL_LABELS[goal]}
              <button onClick={() => setGoal("")}><X size={10} /></button>
            </span>
          )}
          <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground underline">Alle löschen</button>
        </div>
      )}

      {/* Results */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="rounded-xl bg-card border border-border animate-pulse h-40" />
          ))}
        </div>
      ) : exercises.length === 0 ? (
        <div className="stat-card text-center py-14">
          <Dumbbell size={32} className="mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm font-semibold">Keine Übungen gefunden</p>
          <p className="text-muted-foreground/60 text-xs mt-1">Filter anpassen oder Suche leeren</p>
          <button onClick={clearAll} className="mt-3 text-xs text-primary hover:underline">Filter zurücksetzen</button>
        </div>
      ) : grouped ? (
        <div className="space-y-6">
          {Object.entries(grouped).map(([mg, items]) => {
            const mgLabel = MUSCLE_GROUPS.find(m => m.key === mg)?.label ?? mg;
            return (
              <div key={mg} className="space-y-2">
                <div className="flex items-center gap-2">
                  <p className="font-display font-bold text-xs uppercase tracking-wider text-muted-foreground">{mgLabel}</p>
                  <span className="text-[10px] text-muted-foreground/60">({items.length})</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {items.map(ex => (
                    <ExerciseCard
                      key={ex.id}
                      exercise={ex}
                      expanded={expandedId === ex.id}
                      onToggle={() => setExpandedId(expandedId === ex.id ? null : ex.id)}
                      onDelete={() => deleteMutation.mutate(ex.id)}
                      onOpenLog={() => setLogExercise(ex)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {exercises.map(ex => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              expanded={expandedId === ex.id}
              onToggle={() => setExpandedId(expandedId === ex.id ? null : ex.id)}
              onDelete={() => deleteMutation.mutate(ex.id)}
              onOpenLog={() => setLogExercise(ex)}
            />
          ))}
        </div>
      )}

      {/* Log drawer modal */}
      {logExercise && (
        <LogDrawer exercise={logExercise} onClose={() => setLogExercise(null)} />
      )}
    </div>
  );
}

// ── Exercise Card ──────────────────────────────────────────────────────────
function ExerciseCard({
  exercise: ex,
  expanded,
  onToggle,
  onDelete,
  onOpenLog,
}: {
  exercise: Exercise;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onOpenLog: () => void;
}) {
  const videoUrl = getVideoUrl(ex);
  const tags = ex.tags ? ex.tags.split(",").map(t => t.trim()).filter(Boolean) : [];

  // Lazy-load PR for this card (cheap — only fires when card is visible)
  const { data: pr } = useQuery<ExercisePr | null>({
    queryKey: ["/api/exercises", ex.id, "pr"],
    queryFn: async () => (await apiRequest("GET", `/api/exercises/${ex.id}/pr`)).json(),
    staleTime: 0,
  });

  return (
    <div
      className={`rounded-xl border flex flex-col overflow-hidden transition-all duration-200 ${
        expanded
          ? "border-primary/50 shadow-lg shadow-primary/10 col-span-2 sm:col-span-1"
          : "border-border hover:border-primary/30 hover:shadow-md hover:shadow-black/20"
      } bg-card`}
      data-testid={`card-exercise-${ex.id}`}
    >
      {/* Thumbnail */}
      <button
        onClick={onToggle}
        className="relative w-full aspect-square flex items-center justify-center overflow-hidden group"
        style={{ background: ({
          chest:'rgba(255,107,26,0.08)', back:'rgba(59,130,246,0.08)',
          legs:'rgba(16,185,129,0.08)', shoulders:'rgba(139,92,246,0.08)',
          biceps:'rgba(6,182,212,0.08)', triceps:'rgba(245,158,11,0.08)',
          core:'rgba(239,68,68,0.08)', glutes:'rgba(236,72,153,0.08)',
          fullbody:'rgba(255,107,26,0.08)',
        } as Record<string,string>)[ex.muscleGroup] ?? 'rgba(255,255,255,0.03)' }}
        aria-label={`${ex.name} Details anzeigen`}
      >
        <div className="w-3/4 h-3/4 opacity-90 group-hover:opacity-100 transition-opacity">
          <MuscleThumbnail muscleGroup={ex.muscleGroup} />
        </div>
        {/* Equipment badge */}
        <span className={`absolute top-2 left-2 text-[9px] px-1.5 py-0.5 rounded-full border font-semibold ${EQUIPMENT_COLORS[ex.equipment] ?? "bg-muted/30 text-muted-foreground border-border"}`}>
          {EQUIPMENT_LABELS[ex.equipment] ?? ex.equipment}
        </span>
        {/* PR badge */}
        {pr && (
          <span
            className="absolute top-2 right-2 flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 font-semibold"
            data-testid={`badge-pr-${ex.id}`}
          >
            <Trophy size={8} />PR
          </span>
        )}
        {/* Custom badge (when no PR) */}
        {!!ex.isCustom && !pr && (
          <span className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 font-semibold">
            Eigene
          </span>
        )}
        {/* Expand indicator */}
        <div className="absolute bottom-1.5 right-1.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </div>
      </button>

      {/* Info strip */}
      <div className="px-2.5 pt-2 pb-1.5 flex-1 flex flex-col gap-0.5">
        <p className="font-display font-bold text-[13px] text-foreground leading-tight line-clamp-2">{ex.name}</p>
        {ex.nameEn && <p className="text-[10px] text-muted-foreground/70 leading-tight">{ex.nameEn}</p>}
        <p className="text-[10px] text-muted-foreground mt-0.5">{ex.muscleGroupLabel}</p>
      </div>

      {/* Log button — always visible at the bottom of each card */}
      <button
        onClick={e => { e.stopPropagation(); onOpenLog(); }}
        className="flex items-center justify-center gap-1.5 text-[11px] font-semibold font-display text-muted-foreground hover:text-primary border-t border-border/40 py-2 transition-colors group"
        data-testid={`button-log-${ex.id}`}
      >
        <ClipboardList size={11} className="group-hover:text-primary transition-colors" />
        Einheit loggen
        {pr && <span className="ml-auto mr-2 text-[9px] text-yellow-400">⭐ {pr.bestWeight}kg</span>}
      </button>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="px-2.5 pb-3 space-y-2.5 border-t border-border/50 pt-2.5">
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/40 text-muted-foreground border border-border font-medium">
              {ex.movementType === "compound" ? "Compound" : "Isolation"}
            </span>
            {tags.map(tag => (
              <span key={tag} className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                tag === "powerlifting" ? "bg-orange-500/15 text-orange-400 border-orange-500/20" :
                tag === "bodybuilding" ? "bg-blue-500/15 text-blue-400 border-blue-500/20" :
                tag === "weightloss"   ? "bg-green-500/15 text-green-400 border-green-500/20" :
                "bg-muted/40 text-muted-foreground border-border"
              }`}>
                {GOAL_LABELS[tag] ?? tag}
              </span>
            ))}
          </div>

          {videoUrl && (
            <a
              href={videoUrl}
              target="_top"
              data-testid={`link-video-${ex.id}`}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors group"
            >
              <span className="flex items-center justify-center w-5 h-5 rounded bg-red-600/20 text-red-500 flex-shrink-0">▶</span>
              Instruktionsvideo
              <ExternalLink size={10} className="ml-auto opacity-50 group-hover:opacity-100" />
            </a>
          )}

          {!!ex.isCustom && (
            <button
              onClick={onDelete}
              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors mt-0.5"
              data-testid={`button-delete-${ex.id}`}
            >
              <Trash2 size={11} />Übung löschen
            </button>
          )}
        </div>
      )}
    </div>
  );
}
