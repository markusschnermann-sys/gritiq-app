/**
 * GritIQ Brand Style Guide — /brand route
 * One-page identity reference: logo, color palette, typography, spacing, usage rules.
 */

// ── Inline SVG assets ────────────────────────────────────────────────────────

function LogoMark({ size = 100, variant = "primary" }: { size?: number; variant?: "primary" | "white" | "mono" }) {
  const bg = variant === "primary" ? "#1B1F2A" : "transparent";
  const fill = variant === "white" ? "white" : variant === "mono" ? "currentColor" : "url(#markGrad)";
  const collarFill = variant === "primary" ? "#FF8C42" : variant === "white" ? "rgba(255,255,255,0.6)" : "currentColor";
  const rx = Math.round(size * 0.22);
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.33;
  const innerR = size * 0.21;
  // Opening at 60deg from right
  const ang = (60 * Math.PI) / 180;
  const oxTop = cx + outerR * Math.cos(-ang);
  const oyTop = cy + outerR * Math.sin(-ang);
  const ixTop = cx + innerR * Math.cos(-ang);
  const iyTop = cy + innerR * Math.sin(-ang);
  const oxBot = cx + outerR * Math.cos(ang);
  const oyBot = cy + outerR * Math.sin(ang);
  const ixBot = cx + innerR * Math.cos(ang);
  const iyBot = cy + innerR * Math.sin(ang);
  // Crossbar dimensions
  const cbX = ixTop;
  const cbY = cy - size * 0.06;
  const cbW = size * 0.23;
  const cbH = size * 0.12;
  const cbRx = cbH * 0.35;
  const collarX = cbX + cbW - cbH;
  const gradId = `mg${size}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" aria-label="GritIQ">
      <defs>
        <linearGradient id={gradId} x1="30%" y1="20%" x2="70%" y2="80%">
          <stop offset="0%" stopColor="#FF8C42" />
          <stop offset="100%" stopColor="#E8541A" />
        </linearGradient>
      </defs>
      {bg !== "transparent" && <rect width={size} height={size} rx={rx} fill={bg} />}
      <path
        fill={variant === "primary" ? `url(#${gradId})` : fill}
        d={`M ${oxTop},${oyTop} A ${outerR},${outerR} 0 1,0 ${oxBot},${oyBot} L ${ixBot},${iyBot} A ${innerR},${innerR} 0 1,1 ${ixTop},${iyTop} Z`}
      />
      <rect x={cbX} y={cbY} width={cbW} height={cbH} rx={cbRx} fill={variant === "primary" ? `url(#${gradId})` : fill} />
      <rect x={collarX} y={cbY} width={cbH * 0.9} height={cbH} rx={cbH * 0.45} fill={collarFill} />
    </svg>
  );
}

// ── Color system ─────────────────────────────────────────────────────────────

const PALETTE = [
  {
    group: "Brand",
    colors: [
      { name: "Orange 500", hex: "#FF6B1A", hsl: "25 100% 55%", role: "Primary — CTAs, accents, active states" },
      { name: "Orange 400", hex: "#FF8C42", hsl: "25 100% 63%", role: "Hover, highlights, collar accents" },
      { name: "Orange 700", hex: "#E8541A", hsl: "20 83% 50%", role: "Pressed states, gradient end" },
    ],
  },
  {
    group: "Surface",
    colors: [
      { name: "Steel 950", hex: "#0D0F14", hsl: "220 20% 6%", role: "App background (deepest)" },
      { name: "Steel 900", hex: "#12151C", hsl: "220 20% 9%", role: "Background base" },
      { name: "Steel 850", hex: "#1B1F2A", hsl: "220 20% 13%", role: "Logo background, cards" },
      { name: "Steel 800", hex: "#22273A", hsl: "225 25% 18%", role: "Elevated cards, modals" },
      { name: "Steel 700", hex: "#2E3447", hsl: "225 22% 24%", role: "Borders, dividers" },
    ],
  },
  {
    group: "Text",
    colors: [
      { name: "White 92", hex: "#E6EAF0", hsl: "210 20% 92%", role: "Primary text" },
      { name: "White 55", hex: "#7A8299", hsl: "215 12% 55%", role: "Muted / secondary text" },
      { name: "White 30", hex: "#444C5E", hsl: "220 16% 32%", role: "Placeholder, disabled" },
    ],
  },
  {
    group: "Goal",
    colors: [
      { name: "Powerlifting", hex: "#FF6B1A", hsl: "25 100% 55%", role: "Powerlifting goal identity" },
      { name: "Bodybuilding", hex: "#3B82F6", hsl: "217 91% 60%", role: "Bodybuilding goal identity" },
      { name: "Weightloss", hex: "#EF4444", hsl: "0 84% 60%", role: "Fat loss goal identity" },
    ],
  },
  {
    group: "Status",
    colors: [
      { name: "Success", hex: "#22C55E", hsl: "142 76% 45%", role: "Completed workouts, success" },
      { name: "Warning", hex: "#EAB308", hsl: "48 96% 48%", role: "Warnings, caution states" },
      { name: "Error", hex: "#EF4444", hsl: "0 72% 57%", role: "Errors, destructive actions" },
    ],
  },
];

const TYPE_SCALE = [
  { name: "Display XL", size: "clamp(2rem, 3vw, 3rem)", weight: "700", font: "Clash Grotesk", use: "Hero headlines, onboarding" },
  { name: "Display L", size: "clamp(1.5rem, 2vw, 2.25rem)", weight: "700", font: "Clash Grotesk", use: "Page titles, section headers" },
  { name: "Display M", size: "clamp(1.125rem, 1.5vw, 1.5rem)", weight: "600", font: "Clash Grotesk", use: "Card titles, navigation labels" },
  { name: "Body L", size: "clamp(1rem, 1.2vw, 1.125rem)", weight: "400", font: "Satoshi", use: "Primary reading text, descriptions" },
  { name: "Body M", size: "clamp(0.875rem, 1vw, 1rem)", weight: "400", font: "Satoshi", use: "UI labels, secondary text" },
  { name: "Body S", size: "clamp(0.75rem, 0.9vw, 0.875rem)", weight: "400", font: "Satoshi", use: "Captions, timestamps, metadata" },
  { name: "Mono", size: "clamp(0.75rem, 0.9vw, 0.875rem)", weight: "500", font: "JetBrains Mono", use: "Numbers, weights, rep counts" },
];

const LOGO_USAGE = [
  { ok: true,  rule: "Use on dark backgrounds (#1B1F2A or darker)" },
  { ok: true,  rule: "Minimum size: 24px on screen, 6mm in print" },
  { ok: true,  rule: "White mono version on photographic backgrounds" },
  { ok: false, rule: "Do not place on light/white backgrounds" },
  { ok: false, rule: "Do not rotate, skew, or apply effects" },
  { ok: false, rule: "Do not change the G-ring proportions" },
  { ok: false, rule: "Do not use below 16px (use text-only below 16px)" },
];

const SPACING = [2, 4, 8, 12, 16, 24, 32, 48, 64, 96];

// ── Components ────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-6">
      <div className="flex items-center gap-4">
        <h2 className="font-display font-bold text-base text-foreground tracking-wide uppercase">{title}</h2>
        <div className="flex-1 h-px bg-border" />
      </div>
      {children}
    </section>
  );
}

function ColorSwatch({ name, hex, hsl, role }: { name: string; hex: string; hsl: string; role: string }) {
  return (
    <div className="space-y-2">
      <div
        className="h-14 rounded-xl border border-border/50"
        style={{ background: hex }}
      />
      <div>
        <p className="font-display font-semibold text-xs text-foreground">{name}</p>
        <p className="font-mono text-xs text-muted-foreground mt-0.5">{hex}</p>
        <p className="font-mono text-xs text-muted-foreground">hsl({hsl})</p>
        <p className="text-xs text-muted-foreground mt-1 leading-tight">{role}</p>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function BrandPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero header */}
      <div className="relative overflow-hidden border-b border-border">
        {/* Background texture */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, hsl(25 100% 55% / 0.15) 0%, transparent 60%),
                              radial-gradient(circle at 80% 50%, hsl(220 20% 20% / 0.8) 0%, transparent 60%)`,
          }}
        />
        <div className="relative max-w-5xl mx-auto px-6 py-16 flex items-center justify-between gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <LogoMark size={56} variant="primary" />
              <div>
                <h1 className="font-display font-bold text-xl text-foreground leading-none">GritIQ</h1>
                <p className="text-xs text-muted-foreground mt-1">Brand Identity Kit · v1.0</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
              Precision-engineered identity for a strength tracking platform. Dark industrial aesthetic,
              electric orange energy, typographic clarity.
            </p>
            <div className="flex flex-wrap gap-2">
              {["Clash Grotesk", "Satoshi", "Dark Mode First", "Orange #FF6B1A"].map(t => (
                <span key={t} className="text-xs font-mono px-2 py-1 rounded-md bg-card border border-border text-muted-foreground">{t}</span>
              ))}
            </div>
          </div>
          {/* Large mark preview */}
          <div className="flex-shrink-0 hidden md:block">
            <LogoMark size={160} variant="primary" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-12 space-y-16">

        {/* ── Logo ── */}
        <Section title="Logomark">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Primary */}
            <div className="stat-card space-y-4">
              <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Primary — Dark bg</p>
              <div className="flex justify-center py-6 bg-[#12151C] rounded-xl">
                <LogoMark size={96} variant="primary" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Background: <span className="font-mono">#1B1F2A</span></p>
                <p className="text-xs text-muted-foreground">Fill: Orange gradient <span className="font-mono">#FF8C42 → #E8541A</span></p>
              </div>
            </div>

            {/* White variant */}
            <div className="stat-card space-y-4">
              <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">White — Any dark surface</p>
              <div className="flex justify-center py-6 bg-[#1B1F2A] rounded-xl">
                <LogoMark size={96} variant="white" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Use on any dark background</p>
                <p className="text-xs text-muted-foreground">No background tile required</p>
              </div>
            </div>

            {/* Mono */}
            <div className="stat-card space-y-4">
              <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Monochrome — currentColor</p>
              <div className="flex justify-center py-6 bg-[#1B1F2A] rounded-xl">
                <div className="text-primary"><LogoMark size={96} variant="mono" /></div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Uses CSS <span className="font-mono">currentColor</span></p>
                <p className="text-xs text-muted-foreground">Single-ink print, embossing</p>
              </div>
            </div>
          </div>

          {/* Size grid */}
          <div className="stat-card space-y-4">
            <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Scale</p>
            <div className="flex items-end gap-6 flex-wrap">
              {[16, 24, 32, 48, 64, 96, 128].map(s => (
                <div key={s} className="text-center">
                  <LogoMark size={s} variant="primary" />
                  <p className="text-xs font-mono text-muted-foreground mt-2">{s}px</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Minimum: <strong className="text-foreground">24px</strong> with tile · <strong className="text-foreground">16px</strong> favicon only (no tile)</p>
          </div>

          {/* Usage rules */}
          <div className="stat-card space-y-3">
            <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Usage Rules</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {LOGO_USAGE.map((r, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-xs ${
                    r.ok ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                  }`}>
                    {r.ok ? "✓" : "✕"}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{r.rule}</p>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* ── App Store Icon ── */}
        <Section title="App Icon & Splash">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="stat-card space-y-4">
              <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">App Store Icon — 1024×1024</p>
              <div className="flex justify-center py-4">
                {/* Inline app-icon-1024 SVG (scaled) */}
                <svg width="200" height="200" viewBox="0 0 1024 1024" fill="none" style={{ borderRadius: 44 }}>
                  <defs>
                    <linearGradient id="ibg" x1="0" y1="0" x2="1024" y2="1024" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#1E2330"/>
                      <stop offset="100%" stopColor="#12151C"/>
                    </linearGradient>
                    <linearGradient id="imark" x1="200" y1="200" x2="800" y2="800" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#FF8C42"/>
                      <stop offset="100%" stopColor="#E8541A"/>
                    </linearGradient>
                    <linearGradient id="icollar" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
                      <stop offset="0%" stopColor="#FFAA70"/>
                      <stop offset="100%" stopColor="#FF6B1A"/>
                    </linearGradient>
                  </defs>
                  <rect width="1024" height="1024" rx="224" fill="url(#ibg)"/>
                  <path fill="url(#imark)" d="M 681,219.3 A 338,338 0 1,0 681,804.7 L 619,697.3 A 214,214 0 1,1 619,326.7 Z"/>
                  <rect x="619" y="452" width="236" height="120" rx="36" fill="url(#imark)"/>
                  <rect x="790" y="452" width="56" height="120" rx="28" fill="url(#icollar)"/>
                  <rect x="820" y="470" width="4" height="84" rx="2" fill="rgba(255,255,255,0.2)"/>
                  <rect x="830" y="470" width="4" height="84" rx="2" fill="rgba(255,255,255,0.15)"/>
                  <text x="512" y="890" fontFamily="'Clash Grotesk','Arial Black',sans-serif" fontWeight="700" fontSize="88" fill="white" textAnchor="middle" letterSpacing="8" opacity="0.95">GritIQ</text>
                  <text x="512" y="940" fontFamily="'Satoshi','Arial',sans-serif" fontWeight="400" fontSize="32" fill="rgba(255,255,255,0.45)" textAnchor="middle" letterSpacing="6">KRAFT · INTELLIGENZ · PROGRESS</text>
                </svg>
              </div>
              <p className="text-xs text-muted-foreground text-center">Gradient background · orange gradient G-mark · wordmark</p>
            </div>

            <div className="stat-card space-y-4">
              <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Splash Screen — 390×844</p>
              <div className="flex justify-center py-4">
                <svg width="117" height="253" viewBox="0 0 390 844" fill="none" style={{ borderRadius: 16, border: '1px solid #222' }}>
                  <defs>
                    <linearGradient id="sbg" x1="0" y1="0" x2="390" y2="844" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#1E2330"/>
                      <stop offset="60%" stopColor="#12151C"/>
                      <stop offset="100%" stopColor="#0D0F14"/>
                    </linearGradient>
                    <linearGradient id="smark" x1="130" y1="300" x2="260" y2="430" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#FF8C42"/>
                      <stop offset="100%" stopColor="#E8541A"/>
                    </linearGradient>
                    <radialGradient id="sglow" cx="195" cy="380" r="200" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#FF6B1A" stopOpacity="0.12"/>
                      <stop offset="100%" stopColor="#FF6B1A" stopOpacity="0"/>
                    </radialGradient>
                  </defs>
                  <rect width="390" height="844" fill="url(#sbg)"/>
                  <circle cx="195" cy="380" r="220" fill="url(#sglow)"/>
                  <path fill="url(#smark)" d="M 240,302.1 A 90,90 0 1,0 240,457.9 L 223.5,429.4 A 57,57 0 1,1 223.5,330.6 Z"/>
                  <rect x="223" y="370" width="62" height="32" rx="10" fill="url(#smark)"/>
                  <rect x="270" y="370" width="16" height="32" rx="8" fill="#FF8C42"/>
                  <text x="195" y="510" fontFamily="'Clash Grotesk','Arial Black',sans-serif" fontWeight="700" fontSize="48" fill="white" textAnchor="middle" letterSpacing="4">GritIQ</text>
                  <text x="195" y="545" fontFamily="'Satoshi','Arial',sans-serif" fontWeight="400" fontSize="13" fill="rgba(255,255,255,0.4)" textAnchor="middle" letterSpacing="5">KRAFT · INTELLIGENZ · PROGRESS</text>
                  <rect x="155" y="790" width="80" height="3" rx="1.5" fill="rgba(255,255,255,0.1)"/>
                  <rect x="155" y="790" width="40" height="3" rx="1.5" fill="#FF6B1A"/>
                </svg>
              </div>
              <p className="text-xs text-muted-foreground text-center">iPhone 14 Pro · 390×844 · dark gradient + ambient glow</p>
            </div>
          </div>
        </Section>

        {/* ── Color Palette ── */}
        <Section title="Color Palette">
          {PALETTE.map(group => (
            <div key={group.group} className="space-y-3">
              <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">{group.group}</p>
              <div className={`grid gap-4 ${group.colors.length <= 3 ? "grid-cols-3" : "grid-cols-2 md:grid-cols-5"}`}>
                {group.colors.map(c => (
                  <ColorSwatch key={c.name} {...c} />
                ))}
              </div>
            </div>
          ))}

          {/* Color usage notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="stat-card space-y-3">
              <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Do — Color use</p>
              <ul className="space-y-1.5">
                {[
                  "Orange #FF6B1A only for primary CTAs and active states",
                  "One goal color per screen — don't mix orange/blue/red",
                  "Steel surfaces as primary backgrounds — not pure black",
                  "White text at 92% opacity — never pure #FFFFFF",
                ].map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="text-green-400 mt-0.5">✓</span>{r}
                  </li>
                ))}
              </ul>
            </div>
            <div className="stat-card space-y-3">
              <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Don't — Color use</p>
              <ul className="space-y-1.5">
                {[
                  "Don't use orange for warnings or errors",
                  "Don't place orange on orange (no orange text on orange bg)",
                  "Don't use bright background colors — always dark surfaces",
                  "Don't use more than 2 accent colors on a single screen",
                ].map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="text-red-400 mt-0.5">✕</span>{r}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        {/* ── Typography ── */}
        <Section title="Typography">
          <div className="stat-card space-y-1">
            <div className="grid grid-cols-[1fr,auto,auto,1fr] gap-x-6 gap-y-1 items-baseline border-b border-border pb-3 mb-3">
              <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Style</p>
              <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Font</p>
              <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Weight / Size</p>
              <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Use</p>
            </div>
            {TYPE_SCALE.map((t, i) => (
              <div key={i} className="grid grid-cols-[1fr,auto,auto,1fr] gap-x-6 items-center py-2 border-b border-border/40 last:border-0">
                <p
                  className="text-foreground leading-none"
                  style={{
                    fontFamily: t.font === "Clash Grotesk" ? "'Clash Grotesk', sans-serif" : t.font === "Satoshi" ? "'Satoshi', sans-serif" : "monospace",
                    fontSize: t.size,
                    fontWeight: t.weight,
                    lineHeight: 1.2,
                  }}
                >
                  {t.name}
                </p>
                <p className="text-xs font-mono text-muted-foreground whitespace-nowrap">{t.font}</p>
                <p className="text-xs font-mono text-muted-foreground whitespace-nowrap">{t.weight} / {t.size.split(",")[1]?.trim().replace(")", "") || t.size}</p>
                <p className="text-xs text-muted-foreground">{t.use}</p>
              </div>
            ))}
          </div>

          {/* Font specimens */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="stat-card space-y-4">
              <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Clash Grotesk — Display</p>
              <div className="space-y-2">
                <p style={{ fontFamily: "'Clash Grotesk', sans-serif", fontWeight: 700, fontSize: "2rem", lineHeight: 1.1 }} className="text-foreground">
                  Stärke durch Daten
                </p>
                <p style={{ fontFamily: "'Clash Grotesk', sans-serif", fontWeight: 600, fontSize: "1.25rem" }} className="text-primary">
                  ABCDEFGHIJKLMNOPQRSTUVWXYZ
                </p>
                <p style={{ fontFamily: "'Clash Grotesk', sans-serif", fontWeight: 400, fontSize: "1rem" }} className="text-muted-foreground">
                  abcdefghijklmnopqrstuvwxyz 0123456789
                </p>
              </div>
              <p className="text-xs text-muted-foreground">Used for all headings, labels, CTAs, navigation. Geometric grotesque — angular, confident, industrial.</p>
            </div>

            <div className="stat-card space-y-4">
              <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Satoshi — Body</p>
              <div className="space-y-2">
                <p style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 400, fontSize: "1rem", lineHeight: 1.6 }} className="text-foreground">
                  Periodisiertes Training für maximale Kraft, Hypertrophie und Körperkomposition — wissenschaftlich fundiert.
                </p>
                <p style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 500, fontSize: "0.875rem" }} className="text-muted-foreground">
                  ABCDEFGHIJKLMNOPQRSTUVWXYZ 0–9
                </p>
              </div>
              <p className="text-xs text-muted-foreground">Used for body copy, descriptions, tooltips. Warm humanist — readable at small sizes, pairs with Clash Grotesk.</p>
            </div>
          </div>
        </Section>

        {/* ── Spacing ── */}
        <Section title="Spacing Scale">
          <div className="stat-card space-y-4">
            <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Base unit: 4px</p>
            <div className="flex items-end gap-4 flex-wrap">
              {SPACING.map(s => (
                <div key={s} className="text-center">
                  <div
                    className="bg-primary/60 rounded-sm mx-auto"
                    style={{ width: s, height: s }}
                  />
                  <p className="text-xs font-mono text-muted-foreground mt-2">{s}px</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-border">
              {[
                { token: "--space-1", px: "4px", use: "Icon gap, tight chip padding" },
                { token: "--space-2", px: "8px", use: "Button padding, badge gap" },
                { token: "--space-3", px: "12px", use: "Card inner padding (compact)" },
                { token: "--space-4", px: "16px", use: "Card padding, list item height" },
                { token: "--space-6", px: "24px", use: "Section gap, modal padding" },
                { token: "--space-8", px: "32px", use: "Page sections, hero padding" },
                { token: "--space-12", px: "48px", use: "Large section gaps" },
                { token: "--space-16", px: "64px", use: "Full-screen hero height" },
              ].map(s => (
                <div key={s.token} className="space-y-0.5">
                  <p className="font-mono text-xs text-primary">{s.token}</p>
                  <p className="font-mono text-xs text-muted-foreground">{s.px}</p>
                  <p className="text-xs text-muted-foreground">{s.use}</p>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* ── Motion ── */}
        <Section title="Motion & Interaction">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { name: "Micro", duration: "100–150ms", easing: "ease-out", use: "Button press, toggle" },
              { name: "Interactive", duration: "180ms", easing: "cubic-bezier(0.16,1,0.3,1)", use: "Hover, focus, expand" },
              { name: "Transition", duration: "250–300ms", easing: "cubic-bezier(0.4,0,0.2,1)", use: "Page transitions, modals" },
            ].map(m => (
              <div key={m.name} className="stat-card space-y-2">
                <p className="font-display font-bold text-sm text-foreground">{m.name}</p>
                <p className="font-mono text-xs text-primary">{m.duration}</p>
                <p className="font-mono text-xs text-muted-foreground">{m.easing}</p>
                <p className="text-xs text-muted-foreground">{m.use}</p>
              </div>
            ))}
          </div>
          <div className="stat-card">
            <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider mb-3">Principles</p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                "Motion is functional, never decorative",
                "All interactive states must have a visible transition",
                "Avoid motion on repeated list items (too distracting)",
                "Loading states use pulsing opacity, not spinning icons",
                "Page transitions are instant — no slide/fade between routes",
                "Hover states use border-color change + subtle bg lift",
              ].map((p, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-0.5">→</span>{p}
                </li>
              ))}
            </ul>
          </div>
        </Section>

        {/* ── Component anatomy ── */}
        <Section title="Component DNA">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Stat card example */}
            <div className="space-y-3">
              <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Stat Card</p>
              <div className="stat-card space-y-1">
                <p className="text-xs text-muted-foreground">Surface: <span className="font-mono text-foreground">hsl(220 14% 13%)</span></p>
                <p className="text-xs text-muted-foreground">Border: <span className="font-mono text-foreground">hsl(220 12% 22%)</span></p>
                <p className="text-xs text-muted-foreground">Radius: <span className="font-mono text-foreground">0.75rem (12px)</span></p>
                <p className="text-xs text-muted-foreground">Padding: <span className="font-mono text-foreground">16px</span></p>
                <p className="text-xs text-muted-foreground">Hover border: <span className="font-mono text-foreground">primary/40</span></p>
              </div>
            </div>

            {/* Button system */}
            <div className="space-y-3">
              <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Button System</p>
              <div className="stat-card space-y-3">
                <div className="flex flex-wrap gap-2">
                  <button className="px-4 py-2 rounded-lg text-sm font-display font-semibold text-white gradient-orange border-0">Primary CTA</button>
                  <button className="px-4 py-2 rounded-lg text-sm font-display font-semibold text-foreground border border-border bg-card">Secondary</button>
                  <button className="px-4 py-2 rounded-lg text-sm font-display font-semibold text-muted-foreground">Ghost</button>
                  <button className="px-4 py-2 rounded-lg text-sm font-display font-semibold text-red-400 border border-red-500/30 bg-red-500/10">Destructive</button>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Primary: orange gradient background, white text</p>
                  <p className="text-xs text-muted-foreground">Secondary: card bg + border, foreground text</p>
                  <p className="text-xs text-muted-foreground">Height: 44px touch target minimum</p>
                </div>
              </div>
            </div>

            {/* Goal badges */}
            <div className="space-y-3">
              <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Goal Identity Badges</p>
              <div className="stat-card space-y-3">
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs font-display font-bold px-3 py-1.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/30">🏋️ Powerlifting</span>
                  <span className="text-xs font-display font-bold px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">💪 Bodybuilding</span>
                  <span className="text-xs font-display font-bold px-3 py-1.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/30">🔥 Abnehmen</span>
                </div>
                <p className="text-xs text-muted-foreground">Each goal has a dedicated color — used consistently across nutrition cards, timing entries, supplement stacks</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-3">
              <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Progress Bar</p>
              <div className="stat-card space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Programmfortschritt</span>
                    <span className="text-primary font-bold font-display">44%</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full w-[44%] gradient-orange rounded-full" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex h-2.5 rounded-full overflow-hidden">
                    <div className="bg-orange-500/80 w-[35%]" />
                    <div className="bg-sky-400/70 w-[40%]" />
                    <div className="bg-yellow-500/80 w-[25%]" />
                  </div>
                  <p className="text-xs text-muted-foreground">Macro split bar: Protein / Carbs / Fat</p>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* ── Tagline & Voice ── */}
        <Section title="Brand Voice">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="stat-card space-y-4">
              <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Tagline</p>
              <p className="font-display font-bold text-lg text-foreground leading-tight">
                Kraft.<br/>Intelligenz.<br/>Progress.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Short-form: <span className="font-mono text-foreground">KRAFT · INTELLIGENZ · PROGRESS</span><br/>
                Used on app icon, splash screen, print materials.
              </p>
            </div>
            <div className="stat-card space-y-4">
              <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Voice Attributes</p>
              <ul className="space-y-2">
                {[
                  ["Direct", "No filler. One sentence. Maximum clarity."],
                  ["Precise", "Numbers, percentages, weights — show the data."],
                  ["Confident", "Not aggressive. Calm authority of a good coach."],
                  ["German / English", "Primary language German, technical terms can be English."],
                ].map(([attr, desc]) => (
                  <li key={attr} className="flex gap-3">
                    <span className="font-display font-bold text-xs text-primary w-24 flex-shrink-0">{attr}</span>
                    <span className="text-xs text-muted-foreground">{desc}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        {/* Footer */}
        <div className="border-t border-border pt-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LogoMark size={28} variant="primary" />
            <p className="text-xs text-muted-foreground">GritIQ Brand Identity Kit · v1.0 · 2026</p>
          </div>
          <p className="text-xs text-muted-foreground font-mono">hsl(25 100% 55%) · Clash Grotesk + Satoshi</p>
        </div>

      </div>
    </div>
  );
}
