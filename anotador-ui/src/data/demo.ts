// Fuente de datos de prueba: páginas de ejemplo guardadas en el navegador (localStorage).
// Sirve para revisar el diseño sin un servidor de Argilla encendido.

import type { Candidate, DataSource, Label, NewPageInput, Page, SaveInput, Span } from "./types";

const STORAGE_KEY = "anotador.demo.pages.v1";

const MOLINA = [
  "En la ciudad de Sevilla a doze dias",
  "del mes de março de 1591 años",
  "parecio pedro de molina vezino",
  "desta ciudad y dixo",
].join("\n");

const LAMBARI = [
  "Fianza. En la ciudad de sevilla a veynte y quatro dias del mes de heno de 1590 aos",
  "24 heno 1590 ante mi el escriuano publico y testigos",
  "parecio presente martin de erquinigo vezino",
  "desta ciudad e dixo que fiaua a Juan De Lambari maestre",
  "de la nao nombrada Sancta ana y sancta Catalina",
  "que al presente esta surta en el rrio desta ciudad",
  "para hazer viaje en conserua de la flota que va",
  "este presente año a la Provia",
  "De la nueva Espana y se obligo que el dho maestre",
  "y anto navarro de prado su fiador daran quenta",
  "con pago de todo lo que fuere a su cargo",
  "de la dha nao y de las mercaderias que en ella",
  "se cargaren y lo entregaran a sus dueños",
  "conforme a los conocimientos que dello dieren",
  "testigos Franco cortes de los rrios y diego cor",
  "tes de los rrios vezinos de sevilla y lo firmaron",
  "de sus nonbres siendo testigos los susodichos",
  "y el dho otorgante que yo el escriuano doy fee",
  "que conozco",
  "Juan De Lambari",
  "anto navarro de prado",
  "paso ante mi",
].join("\n");

/** Busca `phrase` a partir del inicio del renglón `line` (empezando en 1). */
function locate(text: string, line: number, phrase: string): { start: number; end: number } {
  const lines = text.split("\n");
  const lineStart = lines.slice(0, line - 1).reduce((sum, l) => sum + l.length + 1, 0);
  const start = text.indexOf(phrase, lineStart);
  if (start < 0) throw new Error(`Demo phrase not found: ${phrase}`);
  return { start, end: start + phrase.length };
}

function span(text: string, line: number, phrase: string, label: Label, origin: Span["origin"]): Span {
  return { ...locate(text, line, phrase), label, origin };
}

function candidate(text: string, line: number, phrase: string, label: Label): Candidate {
  const position = locate(text, line, phrase);
  return { id: `c-${position.start}`, ...position, label };
}

function samplePages(): Page[] {
  return [
    {
      id: "demo-lambari-1",
      title: "Fianza de Juan De Lambari, 1590 · pág. 1",
      origin: "TXT",
      text: LAMBARI,
      spans: [
        span(LAMBARI, 1, "heno de 1590 aos", "FECHA", "model"),
        span(LAMBARI, 2, "24 heno 1590", "FECHA", "model"),
        span(LAMBARI, 4, "Juan De Lambari", "PERSONA", "human"),
        span(LAMBARI, 8, "Provia\nDe la nueva Espana", "LUGAR", "model"),
        span(LAMBARI, 10, "anto navarro de prado", "PERSONA", "model"),
        span(LAMBARI, 15, "Franco cortes de los rrios", "PERSONA", "model"),
      ],
      candidates: [
        candidate(LAMBARI, 3, "erquinigo", "PERSONA"),
        candidate(LAMBARI, 5, "Sancta ana y sancta Catalina", "PERSONA"),
        candidate(LAMBARI, 6, "desta ciudad", "LUGAR"),
        candidate(LAMBARI, 15, "diego cor\ntes de los rrios", "PERSONA"),
      ],
      status: "pending",
      notes: "",
      createdBy: "Carlos R.",
    },
    {
      id: "demo-molina-1",
      title: "Poder de Pedro de Molina, 1591 · pág. 1",
      origin: "JSON",
      text: MOLINA,
      spans: [
        span(MOLINA, 1, "Sevilla", "LUGAR", "human"),
        span(MOLINA, 1, "a doze", "FECHA", "human"),
        span(MOLINA, 2, "del mes de março de 1591 años", "FECHA", "human"),
        span(MOLINA, 3, "pedro de molina", "PERSONA", "human"),
      ],
      candidates: [],
      status: "submitted",
      decision: "complete_with_entities",
      notes: "",
      createdBy: "Ana P.",
      lastReviewBy: "Carlos R.",
    },
  ];
}

function load(): Page[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as Page[];
  } catch {
    // Almacenamiento no disponible o dañado: se usan las páginas de ejemplo.
  }
  return samplePages();
}

function persist(pages: Page[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pages));
  } catch {
    // Se ignora: el modo de prueba sigue funcionando en memoria.
  }
}

export function resetDemo(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // No hay nada que reiniciar.
  }
}

export function createDemoSource(): DataSource {
  let pages = load();
  return {
    mode: "demo",
    canAddPages: true,
    async listPages() {
      return structuredClone(pages);
    },
    async savePage(page: Page, input: SaveInput) {
      const updated: Page = {
        ...page,
        spans: input.spans,
        candidates: input.candidates,
        decision: input.decision,
        notes: input.notes,
        status: input.status,
        lastReviewBy: input.reviewer,
      };
      pages = pages.map((p) => (p.id === page.id ? updated : p));
      persist(pages);
      return structuredClone(updated);
    },
    async addPages(inputs: NewPageInput[], author: string) {
      const created = inputs.map<Page>((input, index) => ({
        id: `demo-${Date.now()}-${index}`,
        title: input.title,
        origin: input.origin,
        text: input.text,
        spans: [],
        candidates: [],
        status: "pending",
        notes: "",
        createdBy: author,
      }));
      pages = [...pages, ...created];
      persist(pages);
      return structuredClone(created);
    },
  };
}
