export type PlanType =
  | "DEPOSIT_300"
  | "DEPOSIT_500"
  | "DEPOSIT_1000"
  | "MONTHLY_1000"
  | "TRY_7"
  | "TRY_14";

export const PLAN_VALUE: Record<
  string,
  { amount: number; currency: "USD" | "THB"; countable: boolean }
> = {
  DEPOSIT_300: { amount: 300, currency: "USD", countable: true },
  DEPOSIT_500: { amount: 500, currency: "USD", countable: true },
  DEPOSIT_1000: { amount: 1000, currency: "USD", countable: true },
  MONTHLY_1000: { amount: 1000, currency: "THB", countable: true },
  TRY_7: { amount: 0, currency: "THB", countable: false },
  TRY_14: { amount: 0, currency: "THB", countable: false },
};

export function getPlanValue(plan_type: string | null | undefined) {
  const p = String(plan_type || "").trim();
  return PLAN_VALUE[p] || { amount: 0, currency: "THB" as const, countable: false };
}

export function monthStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function monthStartISO(d: Date) {
  return monthStart(d).toISOString().slice(0, 10); // YYYY-MM-01
}