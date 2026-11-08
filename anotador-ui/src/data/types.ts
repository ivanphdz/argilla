// Tipos compartidos. Reflejan el esquema que annotation-review publica en
// Argilla 2.8: un registro por página, una pregunta de marcas "entities", una
// pregunta de opción "decision" y una pregunta de texto opcional "notes".

export type Label = "PERSONA" | "LUGAR" | "FECHA";

export const LABELS: Label[] = ["PERSONA", "LUGAR", "FECHA"];

/** Posiciones de caracteres sobre el texto guardado, fin exclusivo (igual que Argilla). */
export interface Span {
  start: number;
  end: number;
  label: Label;
  /** "model" = sugerida por history-ws, "human" = creada o corregida por quien revisa. */
  origin: "model" | "human";
}

/** Una posible entidad de la que el modelo no estaba seguro ("Posible, por confirmar"). */
export interface Candidate {
  id: string;
  start: number;
  end: number;
  label: Label;
}

export type Decision =
  | "complete_with_entities"
  | "complete_without_entities"
  | "needs_adjudication"
  | "not_annotatable";

export const DECISIONS: Decision[] = [
  "complete_with_entities",
  "complete_without_entities",
  "needs_adjudication",
  "not_annotatable",
];

/** Estado de la respuesta en Argilla; "pending" significa que aún no hay respuesta. */
export type PageStatus = "pending" | "draft" | "submitted" | "discarded";

export interface Page {
  id: string;
  title: string;
  origin: "TXT" | "JSON";
  /** Texto original tal como está guardado en Argilla. Las posiciones se refieren a este texto. */
  text: string;
  spans: Span[];
  candidates: Candidate[];
  /** Texto libre con los candidatos del modelo cuando no se pueden mostrar en línea (modo Argilla). */
  reviewText?: string;
  status: PageStatus;
  decision?: Decision;
  notes: string;
  createdBy?: string;
  lastReviewBy?: string;
  /** Datos internos que la fuente necesita para volver a guardar esta página. */
  ref?: Record<string, string>;
}

export interface SaveInput {
  spans: Span[];
  candidates: Candidate[];
  decision?: Decision;
  notes: string;
  status: "draft" | "submitted";
  reviewer: string;
}

export type RuleKind = "wrong_type" | "bad_length" | "missed";
export type RuleStatus = "pending" | "approved" | "discarded";

export interface Rule {
  id: string;
  kind: RuleKind;
  text: string;
  example: string;
  status: RuleStatus;
  decidedBy?: string;
}

export interface NewPageInput {
  title: string;
  text: string;
  origin: "TXT" | "JSON";
}

export interface DataSource {
  mode: "demo" | "argilla";
  /** Si se pueden agregar páginas desde la interfaz (en modo Argilla se hace con `history-review prepare`). */
  canAddPages: boolean;
  listPages(): Promise<Page[]>;
  savePage(page: Page, input: SaveInput): Promise<Page>;
  addPages(pages: NewPageInput[], author: string): Promise<Page[]>;
}
