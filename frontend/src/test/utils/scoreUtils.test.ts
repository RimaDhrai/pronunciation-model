import { describe, it, expect } from "vitest";

// ── Fonctions utilitaires de scoring (testées directement) ────────────────
function getScoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Bien";
  if (score >= 40) return "À améliorer";
  return "Insuffisant";
}

function getScoreColor(score: number): string {
  if (score >= 80) return "green";
  if (score >= 60) return "blue";
  if (score >= 40) return "orange";
  return "red";
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

function formatWer(wer: number): string {
  return `${(wer * 100).toFixed(1)}%`;
}

// ─────────────────────────────────────────────────────────────────────────

describe("getScoreLabel", () => {
  it("retourne 'Excellent' pour score >= 80", () => {
    expect(getScoreLabel(80)).toBe("Excellent");
    expect(getScoreLabel(95)).toBe("Excellent");
    expect(getScoreLabel(100)).toBe("Excellent");
  });

  it("retourne 'Bien' pour score entre 60 et 79", () => {
    expect(getScoreLabel(60)).toBe("Bien");
    expect(getScoreLabel(75)).toBe("Bien");
    expect(getScoreLabel(79)).toBe("Bien");
  });

  it("retourne 'À améliorer' pour score entre 40 et 59", () => {
    expect(getScoreLabel(40)).toBe("À améliorer");
    expect(getScoreLabel(50)).toBe("À améliorer");
    expect(getScoreLabel(59)).toBe("À améliorer");
  });

  it("retourne 'Insuffisant' pour score < 40", () => {
    expect(getScoreLabel(0)).toBe("Insuffisant");
    expect(getScoreLabel(39)).toBe("Insuffisant");
  });
});

describe("getScoreColor", () => {
  it("retourne 'green' pour un excellent score", () => {
    expect(getScoreColor(85)).toBe("green");
  });

  it("retourne 'red' pour un score insuffisant", () => {
    expect(getScoreColor(20)).toBe("red");
  });
});

describe("clampScore", () => {
  it("ne dépasse pas 100", () => {
    expect(clampScore(150)).toBe(100);
  });

  it("ne descend pas sous 0", () => {
    expect(clampScore(-10)).toBe(0);
  });

  it("laisse les valeurs normales inchangées", () => {
    expect(clampScore(75)).toBe(75);
  });
});

describe("formatWer", () => {
  it("formate le WER en pourcentage avec 1 décimale", () => {
    expect(formatWer(0.123)).toBe("12.3%");
    expect(formatWer(0)).toBe("0.0%");
    expect(formatWer(1)).toBe("100.0%");
  });
});
