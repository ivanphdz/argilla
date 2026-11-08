// Funciones que todavía no existen en el backend. Se guardan solo en este navegador
// para poder revisar las pantallas. PENDIENTE(backend): moverlas a un almacenamiento compartido.

import type { Rule, RuleStatus } from "./types";

const RULES_KEY = "anotador.rules.v1";
const GROUPS_KEY = "anotador.groups.v1";

const SAMPLE_RULES: Rule[] = [
  {
    id: "r1",
    kind: "wrong_type",
    text: "Lo que sigue a “nao nombrada” suele ser el nombre de un barco, no de una persona.",
    example: "Sancta ana y sancta Catalina (renglón 5)",
    status: "pending",
  },
  {
    id: "r2",
    kind: "bad_length",
    text: "No incluir el oficio (“maestre”) dentro del nombre de la persona.",
    example: "Juan De Lambari maestre (renglón 4)",
    status: "pending",
  },
  {
    id: "r3",
    kind: "missed",
    text: "“Franco” y “anto” seguidos de apellido son nombres de persona abreviados.",
    example: "Franco cortes de los rrios (15) · anto navarro de prado (10)",
    status: "pending",
  },
];

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Solo se conserva en memoria.
  }
}

export function loadRules(): Rule[] {
  return read(RULES_KEY, SAMPLE_RULES);
}

export function setRuleStatus(rules: Rule[], id: string, status: RuleStatus, by?: string): Rule[] {
  const next = rules.map((r) => (r.id === id ? { ...r, status, decidedBy: status === "pending" ? undefined : by } : r));
  write(RULES_KEY, next);
  return next;
}

/** Clave de la entidad → nombre del grupo. */
export type Groups = Record<string, string>;

export function entityKey(pageId: string, start: number, end: number): string {
  return `${pageId}:${start}:${end}`;
}

export function loadGroups(): Groups {
  return read(GROUPS_KEY, {});
}

export function saveGroups(groups: Groups): void {
  write(GROUPS_KEY, groups);
}
