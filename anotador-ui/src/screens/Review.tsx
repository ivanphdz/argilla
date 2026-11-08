import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertIcon, ArrowLeftIcon, CheckIcon, PlusIcon, UndoIcon } from "../components/Icons";
import { DECISION_INFO, LABEL_INFO, decodeEntities, lineRange, shortName, spanText, tokenize, type Token } from "../data/text";
import { DECISIONS, LABELS, type Candidate, type Decision, type Label, type Page, type Span } from "../data/types";
import { useStore } from "../store";

/** Máximo de renglones que puede abarcar una marca nueva. */
const MAX_LINES = 4;

interface Working {
  spans: Span[];
  candidates: Candidate[];
  decision?: Decision;
  notes: string;
}

type Active =
  | { kind: "select"; from: number; to: number }
  | { kind: "mark"; index: number }
  | { kind: "candidate"; id: string }
  | null;

function fromPage(page: Page): Working {
  return {
    spans: page.spans.map((s) => ({ ...s })),
    candidates: page.candidates.map((c) => ({ ...c })),
    decision: page.decision,
    notes: page.notes,
  };
}

const overlaps = (a: { start: number; end: number }, b: { start: number; end: number }) =>
  a.start < b.end && b.start < a.end;

/** Índices de las palabras que cubren [start, end). */
function tokenRange(tokens: Token[], start: number, end: number): [number, number] {
  let from = tokens.findIndex((t) => t.end > start);
  let to = -1;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].start < end) {
      to = i;
      break;
    }
  }
  if (from < 0) from = 0;
  if (to < from) to = from;
  return [from, to];
}

function wordCount(n: number): string {
  return n === 1 ? "1 palabra" : `${n} palabras`;
}

export default function Review() {
  const { pageId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { pages, loading, savePage, user, notify } = useStore();
  const page = pages.find((p) => p.id === pageId);

  const [work, setWork] = useState<Working | null>(null);
  const [history, setHistory] = useState<Working[]>([]);
  const [active, setActive] = useState<Active>(null);
  const [dirty, setDirty] = useState(false);
  const [problem, setProblem] = useState<{ text: string; fix?: "clear" } | null>(null);
  const [saving, setSaving] = useState(false);
  const dragging = useRef(false);
  const loadedFor = useRef<string | null>(null);

  const tokens = useMemo(() => (page ? tokenize(page.text) : []), [page?.text]);

  // Carga la página en la copia de trabajo una vez por página.
  useEffect(() => {
    if (!page || loadedFor.current === page.id) return;
    loadedFor.current = page.id;
    const initial = fromPage(page);
    setWork(initial);
    setHistory([]);
    setDirty(false);
    setProblem(null);
    const focus = params.get("foco")?.match(/^(\d+)-(\d+)$/);
    if (focus) {
      const [start, end] = [Number(focus[1]), Number(focus[2])];
      const markIndex = initial.spans.findIndex((s) => s.start === start && s.end === end);
      const candidate = initial.candidates.find((c) => c.start === start && c.end === end);
      setActive(markIndex >= 0 ? { kind: "mark", index: markIndex } : candidate ? { kind: "candidate", id: candidate.id } : null);
    } else setActive(null);
  }, [page, params]);

  // Avisa antes de cerrar la pestaña si hay cambios sin guardar.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    const stop = () => (dragging.current = false);
    window.addEventListener("mouseup", stop);
    return () => window.removeEventListener("mouseup", stop);
  }, []);

  const change = useCallback(
    (next: Working) => {
      if (work) setHistory((h) => [...h.slice(-49), work]);
      setWork(next);
      setDirty(true);
      setProblem(null);
    },
    [work],
  );

  function undo() {
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory((h) => h.slice(0, -1));
    setWork(previous);
    setActive(null);
    setDirty(true);
  }

  // ---- Acciones sobre marcas ----
  function addMark(label: Label, from: number, to: number) {
    if (!work) return;
    const range = { start: tokens[from].start, end: tokens[to].end };
    const spans = work.spans.filter((s) => !overlaps(s, range));
    spans.push({ ...range, label, origin: "human" });
    spans.sort((a, b) => a.start - b.start);
    change({ ...work, spans, candidates: work.candidates.filter((c) => !overlaps(c, range)) });
    setActive(null);
  }

  function updateMark(index: number, patch: Partial<Span>) {
    if (!work) return;
    const spans = work.spans.map((s, i) => (i === index ? { ...s, ...patch, origin: "human" as const } : s));
    const edited = spans[index];
    const clean = spans.filter((s, i) => i === index || !overlaps(s, edited));
    change({ ...work, spans: clean });
    setActive({ kind: "mark", index: clean.indexOf(edited) });
  }

  function removeMark(index: number) {
    if (!work) return;
    change({ ...work, spans: work.spans.filter((_, i) => i !== index) });
    setActive(null);
  }

  function resolveCandidate(id: string, label: Label | null) {
    if (!work) return;
    const candidate = work.candidates.find((c) => c.id === id);
    if (!candidate) return;
    const candidates = work.candidates.filter((c) => c.id !== id);
    let spans = work.spans;
    if (label) {
      spans = spans.filter((s) => !overlaps(s, candidate));
      spans = [...spans, { start: candidate.start, end: candidate.end, label, origin: "human" as const }].sort(
        (a, b) => a.start - b.start,
      );
    }
    change({ ...work, spans, candidates });
    setActive(null);
  }

  function resize(range: [number, number], edge: "prev" | "next" | "drop"): [number, number] | null {
    let [from, to] = range;
    if (edge === "prev") from = Math.max(0, from - 1);
    if (edge === "next") to = Math.min(tokens.length - 1, to + 1);
    if (edge === "drop") to = Math.max(from, to - 1);
    if ([from, to].join() === range.join()) return null;
    if (tokens[to].line - tokens[from].line + 1 > MAX_LINES) return null;
    return [from, to];
  }

  // ---- Selección con clic / arrastre ----
  function startSelect(index: number) {
    dragging.current = true;
    setActive({ kind: "select", from: index, to: index });
  }

  function extendSelect(index: number) {
    if (!dragging.current || active?.kind !== "select") return;
    const anchor = active.from <= active.to ? active.from : active.to;
    const from = Math.min(anchor, index);
    const to = Math.max(anchor, index);
    if (tokens[to].line - tokens[from].line + 1 > MAX_LINES) return;
    setActive({ kind: "select", from, to });
  }

  // Atajos de teclado del panel lateral: 1/2/3 eligen el tipo, Esc cancela.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("textarea, input")) return;
      if (e.key === "Escape") setActive(null);
      const label = LABELS[Number(e.key) - 1];
      if (!label || !active) return;
      if (active.kind === "select") addMark(label, active.from, active.to);
      if (active.kind === "mark") updateMark(active.index, { label });
      if (active.kind === "candidate") resolveCandidate(active.id, label);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---- Guardar ----
  async function save(status: "draft" | "submitted") {
    if (!page || !work) return;
    if (status === "submitted") {
      const d = work.decision;
      const complete = d === "complete_with_entities" || d === "complete_without_entities";
      if (!d) return setProblem({ text: "Elige cómo quedó la página antes de enviarla." });
      if (complete && work.candidates.length)
        return setProblem({ text: `Te faltan ${work.candidates.length} posibles por confirmar (subrayadas en rojo).` });
      if (d === "complete_with_entities" && !work.spans.length)
        return setProblem({ text: "No hay marcas. Si la página no tiene entidades, elige “Terminada, sin entidades”." });
      if (d === "complete_without_entities" && work.spans.length)
        return setProblem({ text: "Para elegir “sin entidades”, primero quita todas las marcas.", fix: "clear" });
      if ((d === "needs_adjudication" || d === "not_annotatable") && !work.notes.trim())
        return setProblem({ text: "Explica en las notas tu duda o por qué no se puede revisar." });
    }
    setSaving(true);
    setProblem(null);
    try {
      const saved = await savePage(page, {
        spans: status === "submitted" ? work.spans.map((s) => ({ ...s, origin: "human" as const })) : work.spans,
        candidates: work.candidates,
        decision: work.decision,
        notes: work.notes,
        status,
        reviewer: user,
      });
      loadedFor.current = saved.id;
      setWork(fromPage(saved));
      setHistory([]);
      setDirty(false);
      if (status === "submitted") {
        notify("Página enviada. ¡Gracias!");
        navigate("/documentos");
      } else notify("Borrador guardado");
    } catch (e) {
      setProblem({ text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  }

  function leave() {
    if (dirty && !window.confirm("Tienes cambios sin guardar. ¿Salir de todos modos?")) return;
    navigate("/documentos");
  }

  if (loading) return <div className="loading">Cargando página…</div>;
  if (!page || !work)
    return (
      <div className="empty">
        No se encontró esta página.{" "}
        <button className="link" onClick={() => navigate("/documentos")}>
          Volver a Documentos
        </button>
      </div>
    );

  // ---- Datos derivados para la vista ----
  const tokenSpan = tokens.map((t) => work.spans.findIndex((s) => overlaps(s, t)));
  const tokenCandidate = tokens.map((t) => work.candidates.find((c) => overlaps(c, t))?.id ?? null);
  const selFrom = active?.kind === "select" ? Math.min(active.from, active.to) : -1;
  const selTo = active?.kind === "select" ? Math.max(active.from, active.to) : -1;
  const lines = page.text.split("\n");
  const total = work.spans.length + work.candidates.length;
  const reviewed = work.spans.filter((s) => s.origin === "human").length;
  const isSubmitted = page.status === "submitted";

  function renderLine(lineNo: number) {
    const lineTokens = tokens.map((t, i) => ({ t, i })).filter(({ t }) => t.line === lineNo);
    const out: JSX.Element[] = [];
    let k = 0;
    while (k < lineTokens.length) {
      const { i } = lineTokens[k];
      const spanIndex = tokenSpan[i];
      if (spanIndex >= 0) {
        // Agrupa las palabras seguidas de la misma marca en este renglón.
        const group: { t: Token; i: number }[] = [];
        while (k < lineTokens.length && tokenSpan[lineTokens[k].i] === spanIndex) group.push(lineTokens[k++]);
        const s = work!.spans[spanIndex];
        const first = group[0].i === tokens.findIndex((_, j) => tokenSpan[j] === spanIndex);
        const isActive = active?.kind === "mark" && active.index === spanIndex;
        const inSelection = group.some(({ i: j }) => j >= selFrom && j <= selTo);
        out.push(
          <span
            key={`m${i}`}
            role="button"
            tabIndex={0}
            className={`mark mark-${s.label}${isActive ? " is-active" : ""}${inSelection ? " is-selected" : ""}`}
            onMouseDown={(e) => {
              e.preventDefault();
              setActive({ kind: "mark", index: spanIndex });
            }}
            onMouseEnter={() => extendSelect(group[group.length - 1].i)}
            onKeyDown={(e) => e.key === "Enter" && setActive({ kind: "mark", index: spanIndex })}
            aria-label={`${LABEL_INFO[s.label]?.name}: ${spanText(page!.text, s.start, s.end)}`}
          >
            {first && <span className={`tag tag-${s.label}`}>{LABEL_INFO[s.label]?.short ?? s.label}</span>}
            <span>{group.map(({ t }) => decodeEntities(t.raw)).join(" ")}</span>
            <span className="tooltip">
              {LABEL_INFO[s.label]?.name} · {s.origin === "human" ? "Clic para revisar" : "Sugerida · clic para revisar"}
            </span>
          </span>,
        );
        continue;
      }
      const candidateId = tokenCandidate[i];
      const candidate = candidateId ? work!.candidates.find((c) => c.id === candidateId) : undefined;
      if (candidate) {
        // Agrupa las palabras seguidas del mismo candidato en este renglón.
        const group: { t: Token; i: number }[] = [];
        while (k < lineTokens.length && tokenSpan[lineTokens[k].i] < 0 && tokenCandidate[lineTokens[k].i] === candidate.id)
          group.push(lineTokens[k++]);
        const isActive = active?.kind === "candidate" && active.id === candidate.id;
        out.push(
          <span
            key={`c${i}`}
            role="button"
            tabIndex={0}
            className={`w possible${isActive ? " is-active" : ""}`}
            onMouseDown={(e) => {
              e.preventDefault();
              setActive({ kind: "candidate", id: candidate.id });
            }}
            onKeyDown={(e) => e.key === "Enter" && setActive({ kind: "candidate", id: candidate.id })}
          >
            {group.map(({ t }) => decodeEntities(t.raw)).join(" ")}
            <span className="tooltip">Posible {LABEL_INFO[candidate.label]?.name.toLowerCase()} · Clic para confirmar</span>
          </span>,
        );
        continue;
      }
      const selected = i >= selFrom && i <= selTo;
      out.push(
        <span
          key={`w${i}`}
          role="button"
          tabIndex={0}
          className={`w${selected ? " is-selected" : ""}`}
          onMouseDown={(e) => {
            e.preventDefault();
            startSelect(i);
          }}
          onMouseEnter={() => extendSelect(i)}
          onKeyDown={(e) => e.key === "Enter" && setActive({ kind: "select", from: i, to: i })}
        >
          {decodeEntities(tokens[i].raw)}
        </span>,
      );
      k++;
    }
    return out;
  }

  // ---- Panel lateral ----
  function labelChoices(current: Label | undefined, onPick: (l: Label) => void, suggested?: Label) {
    return (
      <div className="choice-list">
        {LABELS.map((l, n) => (
          <button key={l} className={`choice${current === l ? " is-current" : ""}`} onClick={() => onPick(l)}>
            <span className={`sq dot-${l}`} />
            {LABEL_INFO[l].name}
            {suggested === l && <span className="muted" style={{ fontSize: 11.5 }}>sugerido</span>}
            <kbd>{n + 1}</kbd>
          </button>
        ))}
      </div>
    );
  }

  function rangeTools(range: [number, number], apply: (r: [number, number]) => void) {
    const options: { edge: "prev" | "next" | "drop"; label: string }[] = [
      { edge: "prev", label: "+ Anterior" },
      { edge: "next", label: "+ Siguiente" },
      { edge: "drop", label: "− Quitar la última" },
    ];
    return (
      <>
        <p className="q">¿Te faltó o sobró una palabra?</p>
        <div className="chips">
          {options.map((o) => {
            const next = resize(range, o.edge);
            return (
              <button key={o.edge} className="btn btn-sm" disabled={!next} onClick={() => next && apply(next)}>
                {o.label}
              </button>
            );
          })}
        </div>
      </>
    );
  }

  function sidePanel() {
    if (active?.kind === "select") {
      const range: [number, number] = [selFrom, selTo];
      const start = tokens[selFrom].start;
      const end = tokens[selTo].end;
      return (
        <>
          <p className="eyebrow">Marcar texto nuevo</p>
          <div className="quote">“{spanText(page!.text, start, end)}”</div>
          <p className="sub">
            {wordCount(selTo - selFrom + 1)} · renglón {lineRange(page!.text, start, end)}
          </p>
          {rangeTools(range, ([from, to]) => setActive({ kind: "select", from, to }))}
          <p className="q">
            <b>¿Qué es?</b> Un clic y se guarda
          </p>
          {labelChoices(undefined, (l) => addMark(l, selFrom, selTo))}
          <button className="btn btn-block" onClick={() => setActive(null)}>
            Cancelar
          </button>
        </>
      );
    }
    if (active?.kind === "mark" && work!.spans[active.index]) {
      const index = active.index;
      const s = work!.spans[index];
      const range = tokenRange(tokens, s.start, s.end);
      return (
        <>
          <p className="eyebrow">Revisar marca</p>
          <div className={`quote quote-mark mark-${s.label}`}>“{spanText(page!.text, s.start, s.end)}”</div>
          <p className="sub">
            {LABEL_INFO[s.label]?.name} · renglón {lineRange(page!.text, s.start, s.end)}
            {s.origin === "model" && " · sugerida por el modelo"}
          </p>
          {s.origin === "model" && (
            <button className="btn btn-primary btn-block" style={{ marginBottom: 12 }} onClick={() => updateMark(index, {})}>
              <CheckIcon size={15} /> Está bien así
            </button>
          )}
          <p className="q">
            <b>¿Qué es?</b> Cambia el tipo si está mal
          </p>
          {labelChoices(s.label, (l) => updateMark(index, { label: l }))}
          {rangeTools(range, ([from, to]) => updateMark(index, { start: tokens[from].start, end: tokens[to].end }))}
          <div className="chips">
            <button className="btn btn-sm btn-danger-text" onClick={() => removeMark(index)}>
              Quitar marca
            </button>
            <button className="btn btn-sm" style={{ marginLeft: "auto" }} onClick={() => setActive(null)}>
              Listo
            </button>
          </div>
        </>
      );
    }
    const candidate = active?.kind === "candidate" ? work!.candidates.find((c) => c.id === active.id) : undefined;
    if (candidate) {
      return (
        <>
          <p className="eyebrow eyebrow-danger">Posible, por confirmar</p>
          <div className="quote quote-mark">“{spanText(page!.text, candidate.start, candidate.end)}”</div>
          <p className="sub">
            Renglón {lineRange(page!.text, candidate.start, candidate.end)} · el modelo cree que es{" "}
            {LABEL_INFO[candidate.label]?.name.toLowerCase()}
          </p>
          <p className="q">
            <b>¿Qué es?</b> Un clic y se guarda
          </p>
          {labelChoices(undefined, (l) => resolveCandidate(candidate.id, l), candidate.label)}
          <button className="btn btn-block" style={{ marginBottom: 6 }} onClick={() => resolveCandidate(candidate.id, null)}>
            No es una entidad
          </button>
          <button className="btn btn-block" onClick={() => setActive(null)}>
            Cancelar
          </button>
        </>
      );
    }
    return (
      <>
        <div className="progress-head">
          <span>
            Revisadas {reviewed} de {total}
          </span>
          <span className={work!.candidates.length ? "text-danger" : "muted"}>{work!.candidates.length} por confirmar</span>
        </div>
        <div className="progress-bar">
          <div style={{ width: `${total ? (reviewed / total) * 100 : 100}%` }} />
        </div>
        <h3>¿Cómo empezar?</h3>
        <ol className="steps">
          <li>
            <b>1</b>
            <span>
              Revisa las palabras en <span className="possible">rojo</span>: son posibles entidades que hay que confirmar.
            </span>
          </li>
          <li>
            <b>2</b>
            <span>Lee toda la página. Haz clic en una palabra de color para corregirla y marca lo que falte.</span>
          </li>
          <li>
            <b>3</b>
            <span>Abajo, elige cómo quedó la página y envía tu revisión.</span>
          </li>
        </ol>
        {work!.candidates.length ? (
          <p className="note note-warning">
            Quedan {work!.candidates.length} marcas por confirmar en esta página.
          </p>
        ) : (
          <p className="note note-success">No quedan marcas por confirmar en esta página.</p>
        )}
      </>
    );
  }

  const reviewer = page.lastReviewBy ? shortName(page.lastReviewBy) : "—";
  const creator = page.createdBy ? shortName(page.createdBy) : "—";
  const badge =
    page.status === "submitted"
      ? `${page.decision ? DECISION_INFO[page.decision].badge : "Enviada"} · enviada por ${reviewer}`
      : page.status === "draft"
        ? `Borrador · guardado por ${reviewer}`
        : null;

  return (
    <>
      <div className="review-head">
        <div>
          <button className="link" onClick={leave}>
            <ArrowLeftIcon size={14} /> Documentos
          </button>
          <h1>{page.title}</h1>
        </div>
        <button className="btn" disabled={!history.length} onClick={undo}>
          <UndoIcon size={15} /> Deshacer
        </button>
      </div>

      <div className="card legend" aria-label="Leyenda">
        {LABELS.map((l) => (
          <span key={l} className="legend-item">
            <span className={`dot dot-${l}`} />
            <span className="tagname">{LABEL_INFO[l].short}</span> {LABEL_INFO[l].name}
          </span>
        ))}
        <span className="legend-item legend-possible">Posible, por confirmar</span>
        <span className="legend-item legend-select">Tu selección</span>
      </div>

      <div className="review-grid">
        <div>
          <div className="card">
            <div className="hint">
              <PlusIcon size={14} /> Para agregar una entidad, haz clic en una palabra, o arrastra sobre varias (hasta{" "}
              {MAX_LINES} renglones).
            </div>
            <div className="transcript">
              {lines.map((_, n) => (
                <div className="t-line" key={n}>
                  <span className="t-num">{n + 1}</span>
                  <span className="t-words">{renderLine(n + 1)}</span>
                </div>
              ))}
            </div>
            {page.reviewText && (
              <div className="review-candidates">
                <b>Candidatos del modelo para revisar</b>
                <pre>{decodeEntities(page.reviewText)}</pre>
              </div>
            )}
          </div>

          <div className="card decision">
            <div className="decision-head">
              <h2>¿Cómo quedó esta página?</h2>
              {badge && <span className={`pill ${isSubmitted ? "pill-success" : "pill-warning"}`}>{badge}</span>}
            </div>
            <p className="meta">
              Creado por {creator} · Última revisión: {reviewer}
            </p>
            <div className="options" role="radiogroup" aria-label="Resultado de la revisión">
              {DECISIONS.map((d) => (
                <button
                  key={d}
                  role="radio"
                  aria-checked={work.decision === d}
                  className={`option${work.decision === d ? " is-checked" : ""}`}
                  onClick={() => change({ ...work, decision: d })}
                >
                  <span className="radio" />
                  <span className="option-text">
                    <b>{DECISION_INFO[d].title}</b>
                    <small>{DECISION_INFO[d].help}</small>
                  </span>
                </button>
              ))}
            </div>
            <label className="field-label" htmlFor="notes">
              Notas o dudas <span>(opcional)</span>
            </label>
            <textarea
              id="notes"
              className="textarea"
              placeholder="Explica aquí tus dudas o por qué no se puede revisar. No cambies aquí la transcripción."
              value={work.notes}
              onChange={(e) => {
                setWork({ ...work, notes: e.target.value });
                setDirty(true);
                setProblem(null);
              }}
            />
            <div className="form-actions">
              {problem && (
                <span className="form-error">
                  <AlertIcon size={14} /> {problem.text}
                  {problem.fix === "clear" && (
                    <button className="btn btn-sm" onClick={() => change({ ...work, spans: [] })}>
                      Quitar todas
                    </button>
                  )}
                </span>
              )}
              <button className="btn" disabled={saving} onClick={() => void save("draft")}>
                Guardar borrador
              </button>
              <button className="btn btn-primary" disabled={saving} onClick={() => void save("submitted")}>
                <CheckIcon size={15} /> {isSubmitted ? "Volver a enviar" : "Enviar"}
              </button>
            </div>
          </div>
        </div>

        <aside className="side" aria-live="polite">
          {sidePanel()}
        </aside>
      </div>
    </>
  );
}
