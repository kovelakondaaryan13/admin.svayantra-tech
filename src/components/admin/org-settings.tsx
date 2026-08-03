"use client";

import { useState, useCallback } from "react";

/* ------------------------------------------------------------------ */
/*  Types & constants                                                  */
/* ------------------------------------------------------------------ */

interface OrgSettings {
  companyName?: string;
  website?: string;
  industry?: string;
  companySize?: string;
  timezone?: string;
  currency?: string;
  dateFormat?: string;
  workingHoursStart?: string;
  workingHoursEnd?: string;
  workingDays?: string[];
  autoApproveThreshold?: string;
}

const INDUSTRIES = [
  "Technology",
  "Finance",
  "Healthcare",
  "Manufacturing",
  "Retail",
  "Education",
  "Real Estate",
  "Consulting",
  "SaaS",
  "Other",
] as const;

const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"] as const;

const TIMEZONES = [
  "Asia/Kolkata",
  "UTC",
  "US/Eastern",
  "US/Central",
  "US/Mountain",
  "US/Pacific",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
] as const;

const CURRENCIES = ["INR", "USD", "EUR", "GBP"] as const;
const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"] as const;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i.toString().padStart(2, "0");
  return `${h}:00`;
});

const AUTO_APPROVE_OPTIONS = [
  { value: "never", label: "Never (all require approval)" },
  { value: "low-risk", label: "Low-risk only" },
  { value: "all", label: "All (auto-approve everything)" },
] as const;

/* ------------------------------------------------------------------ */
/*  Reusable field components                                          */
/* ------------------------------------------------------------------ */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function OrgSettingsForm({
  initial,
  currentModel,
  showAiConfig,
}: {
  initial: OrgSettings;
  currentModel: string;
  showAiConfig: boolean;
}) {
  const [form, setForm] = useState<OrgSettings>({
    companyName: "",
    website: "",
    industry: "",
    companySize: "",
    timezone: "Asia/Kolkata",
    currency: "INR",
    dateFormat: "DD/MM/YYYY",
    workingHoursStart: "09:00",
    workingHoursEnd: "18:00",
    workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    autoApproveThreshold: "never",
    ...initial,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = useCallback(
    <K extends keyof OrgSettings>(key: K, value: OrgSettings[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setSaved(false);
    },
    [],
  );

  const toggleDay = useCallback((day: string) => {
    setForm((prev) => {
      const days = prev.workingDays ?? [];
      return {
        ...prev,
        workingDays: days.includes(day) ? days.filter((d) => d !== day) : [...days, day],
      };
    });
    setSaved(false);
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b?.error ?? "Could not save settings.");
        return;
      }
      setSaved(true);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ---- Company Profile ---- */}
      <section className="glass space-y-4 p-5">
        <div>
          <h2 className="text-sm font-semibold text-fg">Company Profile</h2>
          <p className="text-xs text-muted">Basic information about your organization.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company name">
            <input
              className="inp w-full"
              value={form.companyName ?? ""}
              onChange={(e) => set("companyName", e.target.value)}
              placeholder="Acme Inc."
            />
          </Field>

          <Field label="Website">
            <input
              className="inp w-full"
              value={form.website ?? ""}
              onChange={(e) => set("website", e.target.value)}
              placeholder="https://example.com"
            />
          </Field>

          <Field label="Industry">
            <select
              className="inp w-full"
              value={form.industry ?? ""}
              onChange={(e) => set("industry", e.target.value)}
            >
              <option value="">Select industry</option>
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </Field>

          <Field label="Company size">
            <select
              className="inp w-full"
              value={form.companySize ?? ""}
              onChange={(e) => set("companySize", e.target.value)}
            >
              <option value="">Select size</option>
              {COMPANY_SIZES.map((s) => (
                <option key={s} value={s}>{s} employees</option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      {/* ---- Regional Settings ---- */}
      <section className="glass space-y-4 p-5">
        <div>
          <h2 className="text-sm font-semibold text-fg">Regional Settings</h2>
          <p className="text-xs text-muted">Timezone, currency, and working schedule.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Timezone">
            <select
              className="inp w-full"
              value={form.timezone ?? ""}
              onChange={(e) => set("timezone", e.target.value)}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </Field>

          <Field label="Currency">
            <select
              className="inp w-full"
              value={form.currency ?? ""}
              onChange={(e) => set("currency", e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>

          <Field label="Date format">
            <select
              className="inp w-full"
              value={form.dateFormat ?? ""}
              onChange={(e) => set("dateFormat", e.target.value)}
            >
              {DATE_FORMATS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Working hours start">
            <select
              className="inp w-full"
              value={form.workingHoursStart ?? "09:00"}
              onChange={(e) => set("workingHoursStart", e.target.value)}
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </Field>

          <Field label="Working hours end">
            <select
              className="inp w-full"
              value={form.workingHoursEnd ?? "18:00"}
              onChange={(e) => set("workingHoursEnd", e.target.value)}
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </Field>
        </div>

        <div>
          <span className="text-xs font-medium text-muted">Working days</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {DAYS.map((day) => {
              const active = form.workingDays?.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-border text-muted hover:border-overlay/30"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---- AI Configuration (owner-only) ---- */}
      {showAiConfig && (
        <section className="glass space-y-4 p-5">
          <div>
            <h2 className="text-sm font-semibold text-fg">AI Configuration</h2>
            <p className="text-xs text-muted">Model defaults and approval settings (owner only).</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Default AI model">
              <input
                className="inp w-full cursor-not-allowed opacity-70"
                value={currentModel}
                readOnly
              />
            </Field>

            <Field label="Auto-approve threshold">
              <select
                className="inp w-full"
                value={form.autoApproveThreshold ?? "never"}
                onChange={(e) => set("autoApproveThreshold", e.target.value)}
              >
                {AUTO_APPROVE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
          </div>
        </section>
      )}

      {/* ---- Save bar ---- */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn-accent"
          disabled={saving}
          onClick={save}
        >
          {saving ? "Saving..." : "Save settings"}
        </button>
        {saved && <span className="text-xs text-teal">Settings saved.</span>}
        {error && <span className="text-xs text-action">{error}</span>}
      </div>
    </div>
  );
}
