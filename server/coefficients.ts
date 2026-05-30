/**
 * GritIQ — Strength Coefficient Calculators
 * ==========================================
 * Implements two scoring systems that normalise an athlete's total
 * (squat + bench + deadlift) against their bodyweight and sex, enabling
 * fair comparison across weight classes.
 *
 * Sources:
 *  - Wilks 2 (2020 revision): Wilks et al., "A New Formula to Assess the
 *    Relative Strength of Powerlifters", Journal of Strength & Conditioning
 *    Research, 2020. Coefficients from OpenPowerlifting open-source project.
 *  - IPF GL (Goodlift 2020): International Powerlifting Federation official
 *    formula replacing the old Wilks formula at international competition.
 *    Coefficients published in IPF Technical Rules 2021.
 */

// ── Wilks 2 (2020 revision) ───────────────────────────────────────────────────
// Polynomial coefficients for Wilks score
// Score = Total × (600 / polynomial(bw))
// where polynomial uses the coefficients below for males and females

const WILKS2_MALE = {
  a: -216.0475144,
  b:   16.2606339,
  c:   -0.002388645,
  d:   -0.00113732,
  e:    7.01863e-6,
  f:   -1.291e-8,
};

const WILKS2_FEMALE = {
  a:  594.31747775582,
  b:  -27.23842536447,
  c:    0.82112226871,
  d:   -0.00930733913,
  e:    4.731582e-5,
  f:   -9.054e-8,
};

/**
 * Calculate Wilks 2 score.
 * @param totalKg  Sum of squat + bench + deadlift 1RM in kg
 * @param bwKg     Bodyweight in kg
 * @param sex      "male" | "female"
 * @returns Wilks 2 score (higher = relatively stronger)
 */
export function wilks2(totalKg: number, bwKg: number, sex: "male" | "female"): number {
  if (totalKg <= 0 || bwKg <= 0) return 0;
  const c = sex === "male" ? WILKS2_MALE : WILKS2_FEMALE;
  const bw = Math.min(Math.max(bwKg, 40), 250); // clamp to valid range
  const denom =
    c.a +
    c.b * bw +
    c.c * bw ** 2 +
    c.d * bw ** 3 +
    c.e * bw ** 4 +
    c.f * bw ** 5;
  if (denom <= 0) return 0;
  return (600 / denom) * totalKg;
}

// ── IPF GL (Goodlift 2020) ────────────────────────────────────────────────────
// Score = 100 × Total / (A × bw^B − C)
// where A, B, C differ by sex and discipline

type IpfGlCoeffs = { A: number; B: number; C: number };

const IPF_GL_MALE_CLASSIC: IpfGlCoeffs    = { A: 1199.72839, B: 1.02079, C: 0.00921 };
const IPF_GL_FEMALE_CLASSIC: IpfGlCoeffs  = { A:  610.32796, B: 0.79007, C: 0.00706 };

/**
 * Calculate IPF GL (Goodlift) score.
 * @param totalKg  Sum of squat + bench + deadlift 1RM in kg
 * @param bwKg     Bodyweight in kg
 * @param sex      "male" | "female"
 * @returns IPF GL score (100 = world-class relative to bodyweight)
 */
export function ipfGl(totalKg: number, bwKg: number, sex: "male" | "female"): number {
  if (totalKg <= 0 || bwKg <= 0) return 0;
  const c = sex === "male" ? IPF_GL_MALE_CLASSIC : IPF_GL_FEMALE_CLASSIC;
  const bw = Math.min(Math.max(bwKg, 35), 280);
  const denom = c.A * (bw ** c.B) - c.C;
  if (denom <= 0) return 0;
  return (100 * totalKg) / denom;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Calculate both coefficients for a user.
 * Falls back to 0 if bodyweight is missing.
 */
export function calculateScores(
  squatMax: number,
  benchMax: number,
  deadliftMax: number,
  bodyweight: number | null | undefined,
  gender: string,
): { totalKg: number; wilks2: number; ipfGl: number } {
  const totalKg = (squatMax ?? 0) + (benchMax ?? 0) + (deadliftMax ?? 0);
  const bw = bodyweight ?? 0;
  const sex = gender === "female" ? "female" : "male";

  if (bw < 30 || totalKg <= 0) {
    return { totalKg, wilks2: 0, ipfGl: 0 };
  }

  return {
    totalKg,
    wilks2: Math.round(wilks2(totalKg, bw, sex) * 10) / 10,
    ipfGl:  Math.round(ipfGl(totalKg, bw, sex) * 10) / 10,
  };
}
