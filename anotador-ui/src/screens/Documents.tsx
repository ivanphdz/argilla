import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AddDocumentModal from "../components/AddDocumentModal";
import { AlertIcon, DownloadIcon, FileIcon, UploadIcon } from "../components/Icons";
import { lineCount, shortName, spanText, statusInfo } from "../data/text";
import type { Page } from "../data/types";
import { useStore } from "../store";

function exportJson(pages: Page[], mode: string | undefined) {
  const data = {
    exported_at: new Date().toISOString(),
    note:
      mode === "argilla"
        ? "Vista rápida desde el Anotador. La exportación oficial es `history-review collect`."
        : "Exportación de páginas de ejemplo.",
    pages: pages.map((p) => ({
      title: p.title,
      status: p.status,
      decision: p.decision ?? null,
      notes: p.notes || null,
      reviewer: p.lastReviewBy ?? null,
      entities: p.spans.map((s) => ({ start: s.start, end: s.end, label: s.label, text: spanText(p.text, s.start, s.end) })),
    })),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `anotador-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Documents() {
  const { pages, loading, error, config, reload } = useStore();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Documentos</h1>
          <p>Cada fila es una página. Elige una para revisarla, o agrega una nueva.</p>
        </div>
        <div className="actions">
          <button className="btn" disabled={!pages.length} onClick={() => exportJson(pages, config?.mode)}>
            <DownloadIcon size={15} /> Exportar JSON
          </button>
          <button className="btn btn-primary" onClick={() => setAdding(true)}>
            <UploadIcon size={15} /> Agregar documento
          </button>
        </div>
      </div>

      {error && (
        <div className="banner banner-error">
          <AlertIcon size={16} /> {error}
          <button className="btn btn-sm" style={{ marginLeft: "auto" }} onClick={() => void reload()}>
            Reintentar
          </button>
        </div>
      )}

      <div className="card" style={{ overflowX: "auto" }}>
        {loading ? (
          <div className="loading">Cargando páginas…</div>
        ) : !pages.length ? (
          <div className="empty">Todavía no hay páginas.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Página</th>
                <th>Origen</th>
                <th>Renglones</th>
                <th>Marcas</th>
                <th>Por confirmar</th>
                <th>Estado</th>
                <th>Creado por</th>
                <th>Última revisión</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pages.map((page) => {
                const status = statusInfo(page.status, page.decision);
                const done = page.status === "submitted";
                return (
                  <tr key={page.id}>
                    <td>
                      <span className="doc-name">
                        <FileIcon /> {page.title}
                      </span>
                    </td>
                    <td className="muted">{page.origin}</td>
                    <td className="num">{lineCount(page.text)}</td>
                    <td className="num">{page.spans.length}</td>
                    <td className={`num${page.candidates.length ? " text-danger" : ""}`}>{page.candidates.length}</td>
                    <td>
                      <span className={`pill pill-${status.tone}`}>{status.label}</span>
                    </td>
                    <td className="muted">{page.createdBy ? shortName(page.createdBy) : "—"}</td>
                    <td className="muted">{page.lastReviewBy ? shortName(page.lastReviewBy) : "—"}</td>
                    <td className="right">
                      <button className="btn btn-sm" onClick={() => navigate(`/pagina/${page.id}`)}>
                        {done ? "Ver" : "Revisar"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <button className="add-tile" onClick={() => setAdding(true)}>
        <strong>Agregar otra página</strong>
        <span>Sube archivos .txt o .json, o pega el texto directamente</span>
      </button>

      {adding && <AddDocumentModal onClose={() => setAdding(false)} />}
    </>
  );
}
