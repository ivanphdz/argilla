import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { NewPageInput } from "../data/types";
import { useStore } from "../store";
import { AlertIcon, FileIcon, UploadIcon } from "./Icons";
import Modal from "./Modal";

type Tab = "file" | "paste";

function stem(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

/** Acepta {title, text}, una lista de ellos o {pages: [...]}. */
function parseJson(name: string, raw: string): NewPageInput[] {
  const data = JSON.parse(raw);
  const items = Array.isArray(data) ? data : Array.isArray(data?.pages) ? data.pages : [data];
  return items.map((item: { title?: string; text?: string }, index: number) => {
    if (typeof item?.text !== "string" || !item.text.trim()) {
      throw new Error(`El archivo ${name} no tiene el campo "text" en la página ${index + 1}.`);
    }
    return {
      title: item.title || (items.length > 1 ? `${stem(name)} · pág. ${index + 1}` : stem(name)),
      text: item.text.replace(/\r\n?/g, "\n"),
      origin: "JSON" as const,
    };
  });
}

async function readFiles(files: File[]): Promise<NewPageInput[]> {
  const pages: NewPageInput[] = [];
  for (const file of files) {
    const raw = await file.text();
    if (/\.json$/i.test(file.name)) pages.push(...parseJson(file.name, raw));
    else if (/\.txt$/i.test(file.name)) {
      if (!raw.trim()) throw new Error(`El archivo ${file.name} está vacío.`);
      pages.push({ title: stem(file.name), text: raw.replace(/\r\n?/g, "\n"), origin: "TXT" });
    } else throw new Error(`${file.name}: solo se aceptan archivos .txt o .json.`);
  }
  return pages;
}

export default function AddDocumentModal({ onClose }: { onClose(): void }) {
  const { source, addPages, notify } = useStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("file");
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const supported = source?.canAddPages ?? false;

  const ready = supported && (tab === "file" ? files.length > 0 : text.trim().length > 0);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const pages =
        tab === "file"
          ? await readFiles(files)
          : [{ title: title.trim() || "Página sin título", text: text.replace(/\r\n?/g, "\n"), origin: "TXT" as const }];
      const created = await addPages(pages);
      notify(created.length === 1 ? "Página agregada" : `${created.length} páginas agregadas`);
      onClose();
      if (created[0]) navigate(`/pagina/${created[0].id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Agregar página"
      description="El texto se guarda tal como viene, respetando los renglones. Antes de agregarla se revisa que no sea una página protegida del corpus."
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" disabled={!ready || busy} onClick={submit}>
            {busy ? "Agregando…" : "Agregar y revisar"}
          </button>
        </>
      }
    >
      {!supported && (
        <div className="banner banner-info">
          <AlertIcon size={16} />
          Por ahora, las páginas nuevas las agrega el equipo técnico. Pídeles que preparen y publiquen el lote.
        </div>
      )}
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "file"} className={tab === "file" ? "is-on" : ""} onClick={() => setTab("file")}>
          Subir archivo
        </button>
        <button role="tab" aria-selected={tab === "paste"} className={tab === "paste" ? "is-on" : ""} onClick={() => setTab("paste")}>
          Pegar texto
        </button>
      </div>

      {tab === "file" ? (
        <>
          <div
            className={`dropzone${over ? " is-over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              setFiles(Array.from(e.dataTransfer.files));
            }}
          >
            <span className="icon">
              <UploadIcon size={16} />
            </span>
            <div>
              Arrastra un archivo aquí o{" "}
              <u role="button" tabIndex={0} onClick={() => input.current?.click()} onKeyDown={(e) => e.key === "Enter" && input.current?.click()}>
                elige uno
              </u>
            </div>
            <small>.txt (una página) · .json (una o varias páginas)</small>
            <input
              ref={input}
              type="file"
              accept=".txt,.json,text/plain,application/json"
              multiple
              hidden
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
          </div>
          {files.length > 0 && (
            <ul className="file-list">
              {files.map((f) => (
                <li key={f.name}>
                  <FileIcon size={14} /> {f.name}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <label className="field-label" htmlFor="new-title" style={{ marginTop: 0 }}>
            Nombre de la página
          </label>
          <input
            id="new-title"
            className="input"
            placeholder="Ej.: Poder de Pedro de Molina, 1591 · pág. 1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <label className="field-label" htmlFor="new-text">
            Transcripción
          </label>
          <textarea
            id="new-text"
            className="textarea"
            style={{ minHeight: 150, fontFamily: "var(--font-text)", fontSize: 15 }}
            placeholder="Pega aquí el texto, con un renglón por línea."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </>
      )}
      {error && (
        <p className="form-error" style={{ marginTop: 10 }}>
          <AlertIcon size={14} /> {error}
        </p>
      )}
    </Modal>
  );
}
