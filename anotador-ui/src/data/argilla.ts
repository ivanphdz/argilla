// Fuente de datos de Argilla 2.8.
//
// Acuerdo con annotation-review (history-review):
// - SOLO LECTURA de datasets, configuración, registros y sugerencias. La CLI sella
//   la configuración del dataset (preguntas, etiquetas, colores, guía); esta
//   interfaz nunca la escribe.
// - ESCRIBE solo la respuesta del usuario actual en un registro:
//   POST /api/v1/records/{id}/responses  (primer guardado)
//   PUT  /api/v1/responses/{id}          (guardados siguientes)
//   con los valores { entities, decision, notes } y estado draft | submitted.
// - Las posiciones de las marcas se conservan tal como vienen (caracteres sobre el
//   texto original, fin exclusivo). El texto nunca se modifica, solo se muestra.

import type { DataSource, Decision, Label, NewPageInput, Page, SaveInput, Span } from "./types";

export interface ArgillaConfig {
  /** Dirección base del servidor de Argilla. Vacío = el mismo origen que esta app. */
  apiUrl: string;
  apiKey: string;
  workspace: string;
}

interface ApiQuestion {
  id: string;
  name: string;
}

interface ApiResponse {
  id: string;
  status: "draft" | "submitted" | "discarded";
  user_id: string;
  values?: Record<string, { value: unknown }> | null;
}

interface ApiRecord {
  id: string;
  external_id?: string | null;
  fields: Record<string, string>;
  metadata?: Record<string, unknown> | null;
  responses?: ApiResponse[];
  suggestions?: { question_id: string; value: unknown }[];
}

const REVIEWERS_KEY = "anotador.reviewers.v1";

/** Error entendible para personas que no son técnicas. */
export class ConnectionError extends Error {}

function reviewerNames(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(REVIEWERS_KEY) || "{}");
  } catch {
    return {};
  }
}

function rememberReviewer(pageId: string, name: string): void {
  try {
    localStorage.setItem(REVIEWERS_KEY, JSON.stringify({ ...reviewerNames(), [pageId]: name }));
  } catch {
    // Información solo visual; no pasa nada si se pierde.
  }
}

/** La capa de presentación antepone al campo review la carpeta y el archivo de origen. */
function parseReviewField(review: string | undefined): { folder?: string; file?: string; rest: string } {
  if (!review) return { rest: "" };
  const match = review.match(/^Documento \(carpeta\): (.*)\nArchivo: (.*)\n\n?/);
  if (!match) return { rest: review };
  return { folder: match[1], file: match[2], rest: review.slice(match[0].length) };
}

function asSpans(value: unknown, origin: Span["origin"]): Span[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item.start === "number" && typeof item.end === "number")
    .map((item) => ({ start: item.start, end: item.end, label: item.label as Label, origin }));
}

export function createArgillaSource(config: ArgillaConfig): DataSource {
  const base = config.apiUrl.replace(/\/$/, "");
  let me: { id: string } | null = null;

  async function call<T>(path: string, init?: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await fetch(base + path, {
        ...init,
        headers: {
          "X-Argilla-Api-Key": config.apiKey,
          "Content-Type": "application/json",
          ...(init?.headers || {}),
        },
      });
    } catch {
      throw new ConnectionError(
        "No se pudo conectar con Argilla. Revisa que el programa esté encendido (docker compose up).",
      );
    }
    if (response.status === 401) {
      throw new ConnectionError("La clave de conexión no es válida. Pide la clave correcta al equipo técnico.");
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new ConnectionError(`Argilla respondió con un error (${response.status}). ${detail}`.trim());
    }
    return response.json() as Promise<T>;
  }

  async function currentUser() {
    if (!me) me = await call<{ id: string }>("/api/v1/me");
    return me;
  }

  async function allRecords(datasetId: string): Promise<ApiRecord[]> {
    const records: ApiRecord[] = [];
    for (;;) {
      const page = await call<{ items: ApiRecord[] }>(
        `/api/v1/datasets/${datasetId}/records?offset=${records.length}&limit=100&include=responses&include=suggestions`,
      );
      records.push(...page.items);
      if (page.items.length < 100) return records;
    }
  }

  function toPage(record: ApiRecord, datasetId: string, questions: ApiQuestion[], userId: string): Page {
    const byName = Object.fromEntries(questions.map((q) => [q.name, q.id]));
    const mine = (record.responses || []).find((r) => r.user_id === userId);
    const values = mine?.values || {};
    const suggestion = (record.suggestions || []).find((s) => s.question_id === byName.entities);
    const spans =
      mine && values.entities ? asSpans(values.entities.value, "human") : asSpans(suggestion?.value, "model");
    const review = parseReviewField(record.fields.review);
    const metadata = record.metadata || {};
    const fileStem = review.file?.replace(/\.txt$/i, "");
    const pageId = String(metadata.page_id || record.external_id || record.id);
    return {
      id: record.id,
      title: fileStem ? (review.folder ? `${review.folder} · ${fileStem}` : fileStem) : pageId,
      origin: "TXT",
      text: record.fields.text || "",
      spans,
      candidates: [],
      reviewText: review.rest.trim() || undefined,
      status: mine ? mine.status : "pending",
      decision: values.decision?.value as Decision | undefined,
      notes: typeof values.notes?.value === "string" ? (values.notes.value as string) : "",
      lastReviewBy: mine ? reviewerNames()[record.id] || "—" : undefined,
      ref: { datasetId, responseId: mine?.id || "" },
    };
  }

  return {
    mode: "argilla",
    canAddPages: false,
    async listPages() {
      const user = await currentUser();
      const workspaces = await call<{ items: { id: string; name: string }[] }>("/api/v1/me/workspaces");
      const workspace = workspaces.items.find((w) => w.name === config.workspace);
      if (!workspace) {
        throw new ConnectionError(`No existe el espacio de trabajo "${config.workspace}" en Argilla.`);
      }
      const datasets = await call<{ items: { id: string; workspace_id: string; status?: string }[] }>(
        "/api/v1/me/datasets",
      );
      const pages: Page[] = [];
      for (const dataset of datasets.items.filter((d) => d.workspace_id === workspace.id)) {
        const questions = await call<{ items: ApiQuestion[] }>(`/api/v1/datasets/${dataset.id}/questions`);
        const records = await allRecords(dataset.id);
        records.sort(
          (a, b) => Number(a.metadata?.page_order ?? 0) - Number(b.metadata?.page_order ?? 0),
        );
        pages.push(...records.map((r) => toPage(r, dataset.id, questions.items, user.id)));
      }
      return pages;
    },
    async savePage(page: Page, input: SaveInput) {
      const values: Record<string, { value: unknown }> = {
        entities: { value: input.spans.map(({ start, end, label }) => ({ start, end, label })) },
      };
      if (input.decision) values.decision = { value: input.decision };
      if (input.notes.trim()) values.notes = { value: input.notes.trim() };
      const body = JSON.stringify({ values, status: input.status });
      const responseId = page.ref?.responseId;
      const saved = responseId
        ? await call<ApiResponse>(`/api/v1/responses/${responseId}`, { method: "PUT", body })
        : await call<ApiResponse>(`/api/v1/records/${page.id}/responses`, { method: "POST", body });
      rememberReviewer(page.id, input.reviewer);
      return {
        ...page,
        spans: input.spans.map((s) => ({ ...s, origin: "human" as const })),
        decision: input.decision,
        notes: input.notes.trim(),
        status: saved.status,
        lastReviewBy: input.reviewer,
        ref: { ...page.ref, responseId: saved.id },
      };
    },
    async addPages(_inputs: NewPageInput[]) {
      throw new ConnectionError(
        "Por ahora las páginas nuevas las agrega el equipo técnico con el comando prepare.",
      );
    },
  };
}
