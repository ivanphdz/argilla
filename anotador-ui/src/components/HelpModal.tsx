import { useState } from "react";
import { saveConfig } from "../data/config";
import { resetDemo } from "../data/demo";
import { useStore } from "../store";
import Modal from "./Modal";

export default function HelpModal({ onClose }: { onClose(): void }) {
  const { config, applyConfig, notify } = useStore();
  const [showConnection, setShowConnection] = useState(false);
  const [apiKey, setApiKey] = useState(config?.mode === "argilla" ? config.apiKey : "");
  const [apiUrl, setApiUrl] = useState(config?.mode === "argilla" ? config.apiUrl : "");
  const [workspace, setWorkspace] = useState(config?.mode === "argilla" ? config.workspace : "historia");

  function connect() {
    const next = { mode: "argilla" as const, apiKey: apiKey.trim(), apiUrl: apiUrl.trim(), workspace: workspace.trim() || "historia" };
    saveConfig(next);
    applyConfig(next);
    notify("Conexión guardada");
    onClose();
  }

  function switchToDemo() {
    const next = { mode: "demo" as const };
    saveConfig(next);
    applyConfig(next);
    notify("Usando páginas de ejemplo");
    onClose();
  }

  return (
    <Modal title="Ayuda" description="Cómo revisar una página, paso a paso." onClose={onClose}>
      <div className="help-body">
        <ol>
          <li>
            En <b>Documentos</b>, elige una página y presiona <b>Revisar</b>.
          </li>
          <li>
            Las palabras con <span className="possible">subrayado rojo</span> son posibles entidades. Haz clic en ellas
            y confirma qué son, o indica que no son entidad.
          </li>
          <li>
            Para marcar algo que falta, haz clic en una palabra o arrastra sobre varias. Luego elige Persona, Lugar o
            Fecha. Se guarda con un clic.
          </li>
          <li>
            Si una marca está mal, haz clic en ella para cambiar el tipo o quitarla. El botón <b>Deshacer</b> revierte
            el último cambio.
          </li>
          <li>
            Al final, elige cómo quedó la página y presiona <b>Enviar</b>. Si aún no terminas, usa{" "}
            <b>Guardar borrador</b>.
          </li>
        </ol>
        <h3>¿Se pierde algo si cierro la ventana?</h3>
        <p>
          Lo que guardaste con <b>Guardar borrador</b> o <b>Enviar</b> queda guardado en esta computadora. Los cambios que
          no guardaste con un botón se pierden.
        </p>
        <h3>Conexión</h3>
        <p>
          {config?.mode === "argilla"
            ? `Conectado a Argilla, espacio de trabajo “${config.workspace}”.`
            : "Estás usando páginas de ejemplo; tus cambios solo se guardan en este navegador."}{" "}
          <button className="link" style={{ textDecoration: "underline" }} onClick={() => setShowConnection((v) => !v)}>
            {showConnection ? "Ocultar" : "Cambiar conexión (equipo técnico)"}
          </button>
        </p>
        {showConnection && (
          <div style={{ marginTop: 8 }}>
            <label className="field-label" htmlFor="api-key">
              Clave de Argilla <span>(ARGILLA_API_KEY del archivo .env)</span>
            </label>
            <input id="api-key" className="input" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
            <label className="field-label" htmlFor="api-url">
              Dirección del servidor <span>(vacío = la misma de esta página)</span>
            </label>
            <input id="api-url" className="input" placeholder="http://127.0.0.1:6900" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
            <label className="field-label" htmlFor="workspace">
              Espacio de trabajo
            </label>
            <input id="workspace" className="input" value={workspace} onChange={(e) => setWorkspace(e.target.value)} />
            <div className="form-actions">
              <button
                className="btn"
                onClick={() => {
                  resetDemo();
                  switchToDemo();
                }}
              >
                Usar páginas de ejemplo
              </button>
              <button className="btn btn-primary" disabled={!apiKey.trim()} onClick={connect}>
                Conectar
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
