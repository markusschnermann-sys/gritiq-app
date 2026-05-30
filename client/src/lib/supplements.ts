/**
 * GritIQ Supplement Recommendations
 *
 * Evidence-based supplement stacks for each training goal.
 * Sources: ISSN, Examine.com, peer-reviewed meta-analyses.
 * All recommendations are Tier 1 or Tier 2 evidence only.
 */

export type TrainingGoal = "powerlifting" | "bodybuilding" | "weightloss";
export type EvidenceTier = "A" | "B" | "C";
// A = Strong evidence (meta-analyses, multiple RCTs)
// B = Good evidence (multiple RCTs, some inconsistency)
// C = Preliminary / theoretical

export interface Supplement {
  name: string;
  emoji: string;
  dose: string;
  timing: string;
  mechanism: string;    // How it works
  evidence: EvidenceTier;
  evidenceNote: string; // Key study/source reference
  caution?: string;     // Any warnings or notes
  priority: "core" | "optional"; // Must-have vs. nice-to-have
}

export interface GoalSupplementStack {
  goal: TrainingGoal;
  label: string;
  emoji: string;
  tagline: string;
  accentColor: string;      // Tailwind border color class
  bgColor: string;          // Tailwind bg class
  supplements: Supplement[];
}

// ── Data ─────────────────────────────────────────────────────────────────────

export const SUPPLEMENT_STACKS: Record<TrainingGoal, GoalSupplementStack> = {

  powerlifting: {
    goal: "powerlifting",
    label: "Powerlifting / Kraftzuwachs",
    emoji: "🏋️",
    tagline: "Maximale Kraft, Explosivität und Erholung",
    accentColor: "border-orange-500/50",
    bgColor: "bg-orange-500/8",
    supplements: [
      {
        name: "Kreatin Monohydrat",
        emoji: "⚡",
        dose: "3–5 g täglich",
        timing: "Täglich, Zeitpunkt egal — Konsistenz entscheidend",
        mechanism: "Erhöht Phosphokreatin-Speicher im Muskel → mehr ATP für kurze, explosive Belastungen (1–5 Wdh.). Sicherster und am besten erforschter Kraft-Supplement.",
        evidence: "A",
        evidenceNote: "ISSN Position Stand 2021: Kreatin ist das wirksamste ergogene Nahrungsergänzungsmittel für Kraftathleten. Meta-Analysen zeigen +5–15% Kraftzuwachs.",
        priority: "core",
      },
      {
        name: "Koffein",
        emoji: "☕",
        dose: "3–6 mg/kg KG (ca. 200–400 mg)",
        timing: "30–60 min vor schwerem Training",
        mechanism: "Adenosin-Antagonist → reduziert wahrgenommene Erschöpfung, steigert Kraftoutput um 3–7% und verbessert Explosivkraft. Besonders wirksam für Maximalkraft-Einheiten.",
        evidence: "A",
        evidenceNote: "Grgic et al. 2018 (BJSM): Signifikante Kraftsteigerung bei Squat/Bench durch Koffein. Wirkung bleibt auch bei regelmäßigen Konsumenten.",
        caution: "Keine Einnahme <6h vor Schlaf. Toleranz kann entstehen — 1–2 Tage pro Woche pausieren.",
        priority: "core",
      },
      {
        name: "Beta-Alanin",
        emoji: "🔴",
        dose: "3,2–6,4 g täglich",
        timing: "Aufgeteilt über den Tag (z.B. 2× täglich) — kein exaktes Timing nötig",
        mechanism: "Erhöht Muskel-Carnosin-Spiegel → puffert Milchsäure → verlängert Arbeitsfähigkeit bei Sätzen von 60–240 Sekunden. Besonders wirksam bei 5–15 Wdh.",
        evidence: "A",
        evidenceNote: "Hobson et al. 2012 (Amino Acids): Meta-Analyse zeigt +2,85% Leistungszuwachs bei Übungen von 60–240s. Geringe Evidenz für <60s-Belastungen.",
        caution: "Kribbeln (Parästhesie) ist harmlos aber unangenehm — SR-Formulierungen reduzieren den Effekt.",
        priority: "core",
      },
      {
        name: "Citrullin Malat",
        emoji: "🩸",
        dose: "6–8 g",
        timing: "30–60 min vor Training",
        mechanism: "Steigert Stickoxidproduktion → bessere Durchblutung, reduziert Muskelkater (DOMS) um bis zu 40%. Ermöglicht mehr Arbeitsvolumen in der Trainingseinheit.",
        evidence: "B",
        evidenceNote: "Pérez-Guisado & Jakeman 2010: 8g Citrullin Malat → 52,9% mehr Wdh. beim Bankdrücken vs. Placebo.",
        priority: "optional",
      },
      {
        name: "Omega-3 Fettsäuren",
        emoji: "🐟",
        dose: "2–3 g EPA+DHA täglich",
        timing: "Zu einer Mahlzeit",
        mechanism: "Anti-entzündlich → reduziert Trainingsschäden, beschleunigt Erholung zwischen schweren Einheiten. Kann Muskelprotein-Synthese leicht steigern.",
        evidence: "B",
        evidenceNote: "Smith et al. 2011 (Am J Clin Nutr): Omega-3 erhöhte Muskelprotein-Synthese-Rate um 25% bei Kraftathleten.",
        priority: "optional",
      },
      {
        name: "Vitamin D3 + K2",
        emoji: "☀️",
        dose: "2000–4000 IU D3 + 100 µg K2",
        timing: "Morgens mit fetthaltiger Mahlzeit",
        mechanism: "Vitamin D-Mangel (verbreitet in Deutschland) korreliert mit reduzierter Muskelfunktion und Testosteronspiegel. K2 dirigiert Calcium in Knochen statt Arterien.",
        evidence: "B",
        evidenceNote: "Koundourakis et al. 2016: Vitamin D-Substitution verbesserte Kraftleistung in defizitären Athleten signifikant.",
        priority: "optional",
      },
    ],
  },

  bodybuilding: {
    goal: "bodybuilding",
    label: "Bodybuilding / Muskelaufbau",
    emoji: "💪",
    tagline: "Hypertrophie, Pump und maximale Protein-Synthese",
    accentColor: "border-blue-500/50",
    bgColor: "bg-blue-500/8",
    supplements: [
      {
        name: "Whey Protein",
        emoji: "🥛",
        dose: "25–40 g pro Serving",
        timing: "Post-Workout (innerhalb 30–60 min) und ggf. morgens",
        mechanism: "Schnellverdauliches vollständiges Protein — höchster Leucin-Gehalt aller Proteinquellen (~10%). Maximiert anabole Signalwege (mTOR). Unverzichtbar wenn Nahrungsprotein-Ziel nicht erreicht wird.",
        evidence: "A",
        evidenceNote: "Morton et al. 2018 (BJSM): Meta-Analyse (49 Studien, 1800 Teilnehmer) — Proteinsupplementation steigert Muskelmasse und -kraft signifikant. Optimum bei ~1,62g/kg.",
        priority: "core",
      },
      {
        name: "Kreatin Monohydrat",
        emoji: "⚡",
        dose: "3–5 g täglich",
        timing: "Täglich, post-workout mit Kohlenhydraten optimal",
        mechanism: "Verbessert intrazelluläres Volumen (Zell-Hydratation → anaboler Signal), erhöht Trainingsvolumen — direkte Voraussetzung für Hypertrophie. Einer der wenigen Supplements mit Lean Mass Evidenz.",
        evidence: "A",
        evidenceNote: "Lanhers et al. 2017: Meta-Analyse zeigt +1,37 kg Lean Mass Zugewinn durch Kreatin-Supplementation über Krafttraining-Studien.",
        priority: "core",
      },
      {
        name: "Leucin / EAAs",
        emoji: "🧬",
        dose: "2–3 g Leucin (oder 10g EAAs)",
        timing: "Peri-Workout (pre oder intra bei langen Sessions >75 min)",
        mechanism: "Leucin ist der anabole Auslöser — aktiviert mTORC1 direkt. 'Leucin-Schwelle' (~2–3g) muss pro Mahlzeit erreicht werden um Protein-Synthese maximal zu stimulieren. Wichtig bei pflanzlicher Ernährung.",
        evidence: "A",
        evidenceNote: "Norton & Layman 2006: Leucin-Oxidation und mTOR-Aktivierung direkt verknüpft. Schwellenwert-Effekt gut dokumentiert.",
        priority: "core",
      },
      {
        name: "ZMA (Zink + Magnesium + B6)",
        emoji: "😴",
        dose: "Zink 30mg + Magnesium 450mg + B6 10,5mg",
        timing: "30–60 min vor Schlaf, auf leeren Magen",
        mechanism: "Zink und Magnesium sind bei Kraftathleten häufig depletiert (Schweiß-Verlust). Magnesium fördert Schlaftiefe (GABA-Aktivierung), Zink unterstützt Testosteron-Synthese. Schlaf = wichtigste Erholungsphase für Muskelaufbau.",
        evidence: "B",
        evidenceNote: "Brilla & Conte 2000: ZMA-Supplementation erhöhte Testosteron um 30% und IGF-1 um 5% in Football-Spielern. Wirkung bei Nicht-Defizienten geringer.",
        caution: "Calcium hemmt Zink-Absorption — nicht zusammen mit Milchprodukten einnehmen.",
        priority: "core",
      },
      {
        name: "Citrullin / Pre-Workout",
        emoji: "🩸",
        dose: "6–8 g Citrullin Malat",
        timing: "30 min vor Training",
        mechanism: "Stickoxid-Booster → Vasodilatation, verbesserter Pump und Nährstofftransport. Reduziert DOMS und ermöglicht höheres Trainingsvolumen — kritischer Hypertrophiefaktor.",
        evidence: "B",
        evidenceNote: "Pérez-Guisado & Jakeman 2010: +52,9% Wdh. beim Bankdrücken, signifikant weniger Muskelkater.",
        priority: "optional",
      },
      {
        name: "Omega-3 Fettsäuren",
        emoji: "🐟",
        dose: "2–3 g EPA+DHA täglich",
        timing: "Zu einer Mahlzeit",
        mechanism: "Anti-katabolisch + schwach anabol: reduziert Muskelprotein-Abbau, erhöht Muskelprotein-Synthese-Sensitivität. Potenziert Whey-Protein-Effekte wenn gleichzeitig eingenommen.",
        evidence: "B",
        evidenceNote: "Smith et al. 2011: +25% Muskelprotein-Syntheserate bei gleichzeitiger Omega-3 + Aminosäure-Einnahme.",
        priority: "optional",
      },
    ],
  },

  weightloss: {
    goal: "weightloss",
    label: "Abnehmen / Fettabbau",
    emoji: "🔥",
    tagline: "Fettverbrennung, Hunger-Kontrolle und Muskelerhalt im Defizit",
    accentColor: "border-red-500/50",
    bgColor: "bg-red-500/8",
    supplements: [
      {
        name: "Koffein",
        emoji: "☕",
        dose: "200–400 mg",
        timing: "Morgens und ggf. Pre-Workout (nicht nach 14 Uhr)",
        mechanism: "Doppelwirkung: Thermogenese (+3–11% Kalorienverbrauch) und Fettoxidation. Unterdrückt Hunger über Adenosin-Blockade. Erhöht Performance im Defizit wenn Energie gering ist — schützt dadurch Muskelmasse.",
        evidence: "A",
        evidenceNote: "Astrup et al. 1992; Dulloo et al. 1989: Koffein erhöht metabolische Rate signifikant. Wirkung nimmt bei Toleranz ab — Zyklen empfohlen.",
        caution: "Keine Einnahme nach 14 Uhr wegen Schlafstörungen. Kein leerer Magen bei Magenempfindlichkeit.",
        priority: "core",
      },
      {
        name: "Psyllium / Ballaststoffe",
        emoji: "🌾",
        dose: "5–10 g Psylliumhusk",
        timing: "Vor Mahlzeiten mit viel Wasser (250–300 ml)",
        mechanism: "Quillt im Magen auf → Sättigungsgefühl ohne Kalorien. Verlangsamt Glukose-Absorption → stabilisiert Blutzucker, reduziert Hunger-Spitzen. Eine der effektivsten non-pharmakologischen Hunger-Kontroll-Strategien.",
        evidence: "A",
        evidenceNote: "Giannini Artioli et al. 2009 / Cochrane Review: Lösliche Ballaststoffe reduzieren Körpergewicht und Hunger signifikant.",
        caution: "Immer viel Wasser dazu trinken — ohne Flüssigkeit kontraproduktiv.",
        priority: "core",
      },
      {
        name: "Whey Protein (hoch)",
        emoji: "🥛",
        dose: "30–40 g pro Serving",
        timing: "Morgens und post-workout — sichert Muskelerhalt im Defizit",
        mechanism: "Im Kaloriendefizit ist Muskelerhalt die größte Herausforderung. Hohe Proteinzufuhr (2,6g/kg) hält Muskelmasse trotz negativer Energiebilanz. Protein hat höchsten thermic effect of food (~30% der Kalorien werden für Verdauung verbrannt).",
        evidence: "A",
        evidenceNote: "Helms et al. 2014 (JISSN): 2,3–3,1g/kg Protein schützt Lean Mass während Kalorienrestriktion bei Kraftathleten am besten.",
        priority: "core",
      },
      {
        name: "CLA (Konjugierte Linolsäure)",
        emoji: "🧈",
        dose: "3,2–6,4 g täglich",
        timing: "Zu Mahlzeiten aufgeteilt",
        mechanism: "Möglicherweise leichte anti-lipogene Wirkung (hemmt Fettspeicherung) und erhöht Fettoxidation. Effekt klein aber konsistent in Meta-Analysen (~−0,1 kg Fett/Woche zusätzlich).",
        evidence: "B",
        evidenceNote: "Whigham et al. 2007 (Am J Clin Nutr): Meta-Analyse — CLA reduziert Körperfett um −0,09 kg/Woche vs. Placebo. Kein Ersatz für Kaloriendefizit.",
        caution: "Hohe Dosen (>6g) können Insulinsensitivität verschlechtern. Qualität der CLA-Produkte stark variierend.",
        priority: "optional",
      },
      {
        name: "Grüntee-Extrakt (EGCG)",
        emoji: "🍵",
        dose: "400–500 mg EGCG",
        timing: "Morgens oder vor Training",
        mechanism: "Katechine (EGCG) + Koffein wirken synergistisch auf Thermogenese. Hemmt Catechol-O-Methyltransferase → verlängert Noradrenalin-Wirkung → erhöhte Fettoxidation. Mild aber ohne Nebenwirkungen.",
        evidence: "B",
        evidenceNote: "Hursel et al. 2009: Meta-Analyse — Grüntee-Catechine signifikant wirksam bei Gewichtsverlust und -erhalt.",
        priority: "optional",
      },
      {
        name: "Kreatin (auch im Defizit!)",
        emoji: "⚡",
        dose: "3–5 g täglich",
        timing: "Täglich, Zeitpunkt egal",
        mechanism: "Oft vergessen beim Abnehmen: Kreatin erhält Kraft und Muskelvolumen während des Defizits. Verhindert Kraft-Drop der sonst zu weniger Trainingsvolumen und Muskelabbau führt. Keine Fettmasse-Zunahme — nur intrazelluläres Wasser.",
        evidence: "A",
        evidenceNote: "Lanhers et al. 2017: Kreatin erhält Kraftleistung auch bei kalorienreduzierter Ernährung. Besonders relevant für Powerlifter die cutting machen.",
        priority: "optional",
      },
    ],
  },
};

export function getStack(goal: TrainingGoal): GoalSupplementStack {
  return SUPPLEMENT_STACKS[goal];
}

export function getCoreSupplements(goal: TrainingGoal): Supplement[] {
  return SUPPLEMENT_STACKS[goal].supplements.filter(s => s.priority === "core");
}

export function getOptionalSupplements(goal: TrainingGoal): Supplement[] {
  return SUPPLEMENT_STACKS[goal].supplements.filter(s => s.priority === "optional");
}

export const EVIDENCE_LABELS: Record<EvidenceTier, { label: string; color: string }> = {
  A: { label: "Starke Evidenz", color: "text-green-400 bg-green-500/15 border-green-500/30" },
  B: { label: "Gute Evidenz", color: "text-blue-400 bg-blue-500/15 border-blue-500/30" },
  C: { label: "Vorläufig", color: "text-yellow-400 bg-yellow-500/15 border-yellow-500/30" },
};
