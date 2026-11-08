// Utilidades de texto. Las posiciones siempre se refieren al texto original guardado;
// las transformaciones solo visuales (decodificar entidades HTML) nunca cambian posiciones.

import type { Decision, Label, PageStatus, RuleKind } from "./types";

export interface Token {
  start: number;
  end: number;
  /** Número de renglón, empezando en 1. */
  line: number;
  raw: string;
}

export const LABEL_INFO: Record<Label, { name: string; short: string }> = {
  PERSONA: { name: "Persona", short: "PER" },
  LUGAR: { name: "Lugar", short: "LUG" },
  FECHA: { name: "Fecha", short: "FEC" },
};

export const DECISION_INFO: Record<Decision, { title: string; help: string; badge: string }> = {
  complete_with_entities: {
    title: "Terminada",
    help: "Leí toda la página y verifiqué las marcas.",
    badge: "Terminada",
  },
  complete_without_entities: {
    title: "Terminada, sin entidades",
    help: "La página no tiene personas, lugares ni fechas.",
    badge: "Sin entidades",
  },
  needs_adjudication: {
    title: "Necesito ayuda",
    help: "Tengo una duda; la explico en las notas.",
    badge: "Necesita ayuda",
  },
  not_annotatable: {
    title: "No se puede revisar",
    help: "El texto es ilegible o insuficiente; explico por qué.",
    badge: "No revisable",
  },
};

export const RULE_KIND_INFO: Record<RuleKind, string> = {
  wrong_type: "Tipo equivocado",
  bad_length: "Marca muy larga o corta",
  missed: "No lo encontró",
};

export type StatusTone = "neutral" | "success" | "warning" | "danger";

export function statusInfo(status: PageStatus, decision?: Decision): { label: string; tone: StatusTone } {
  if (status === "pending") return { label: "Sin revisar", tone: "neutral" };
  if (status === "draft") return { label: "Borrador", tone: "warning" };
  if (status === "discarded") return { label: "Apartada", tone: "neutral" };
  switch (decision) {
    case "complete_with_entities":
    case "complete_without_entities":
      return { label: DECISION_INFO[decision].badge, tone: "success" };
    case "needs_adjudication":
      return { label: DECISION_INFO[decision].badge, tone: "warning" };
    case "not_annotatable":
      return { label: DECISION_INFO[decision].badge, tone: "danger" };
    default:
      return { label: "Enviada", tone: "success" };
  }
}

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /[^\s]+/g;
  let line = 1;
  let scanned = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    for (let i = scanned; i < match.index; i++) if (text[i] === "\n") line++;
    scanned = match.index;
    tokens.push({ start: match.index, end: match.index + match[0].length, line, raw: match[0] });
  }
  return tokens;
}

export function lineCount(text: string): number {
  return text.length ? text.split("\n").length : 0;
}

export function lineAt(text: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) if (text[i] === "\n") line++;
  return line;
}

export function lineRange(text: string, start: number, end: number): string {
  const first = lineAt(text, start);
  const last = lineAt(text, Math.max(start, end - 1));
  return first === last ? String(first) : `${first}-${last}`;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'" };

/** Decodifica las pocas entidades HTML que puede traer el lote. Solo para mostrar. */
export function decodeEntities(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|#39|apos);/g, (_, name: string) => ENTITIES[name]);
}

/** Texto de una marca para mostrar; los saltos de renglón se muestran como " / ". */
export function spanText(text: string, start: number, end: number): string {
  return decodeEntities(text.slice(start, end)).replace(/\s*\n\s*/g, " / ");
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

/** "Carlos Ramírez" → "Carlos R." */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] || "";
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}
