import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { initials } from "../data/text";
import { useStore } from "../store";
import AddDocumentModal from "./AddDocumentModal";
import HelpModal from "./HelpModal";
import { BulbIcon, FileIcon, HelpIcon, ListIcon, PlusIcon } from "./Icons";

export default function Layout() {
  const { user, setUser, pages, entities, rules, config } = useStore();
  const [adding, setAdding] = useState(false);
  const [helping, setHelping] = useState(false);
  const pendingRules = rules.filter((r) => r.status === "pending").length;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">T</span>
          Anotador
        </div>
        <div className="topbar-actions">
          <button className="btn" onClick={() => setHelping(true)}>
            <HelpIcon size={15} /> Ayuda
          </button>
          <span className="user-chip" title="Tu nombre firma tus revisiones">
            <span className="avatar">{initials(user)}</span>
            {user}
          </span>
          <button className="btn" onClick={() => setUser("")}>
            Cambiar
          </button>
        </div>
      </header>

      <aside className="sidebar">
        <button className="btn btn-primary btn-block" onClick={() => setAdding(true)}>
          <PlusIcon size={15} /> Agregar documento
        </button>
        <nav className="nav" aria-label="Secciones">
          <NavLink to="/documentos" className={({ isActive }) => (isActive ? "active" : "")}>
            <FileIcon /> Documentos <span className="count">{pages.length}</span>
          </NavLink>
          <NavLink to="/entidades" className={({ isActive }) => (isActive ? "active" : "")}>
            <ListIcon /> Lista de entidades <span className="count">{entities.length}</span>
          </NavLink>
          <NavLink to="/reglas" className={({ isActive }) => (isActive ? "active" : "")}>
            <BulbIcon /> Reglas sugeridas <span className="count">{pendingRules}</span>
          </NavLink>
        </nav>
        <div className="sidebar-foot">
          <span className="dot" style={{ background: config?.mode === "argilla" ? "#12b76a" : "#f79009" }} />
          {config?.mode === "argilla" ? "Conectado a Argilla" : "Modo de prueba"}
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>

      {adding && <AddDocumentModal onClose={() => setAdding(false)} />}
      {helping && <HelpModal onClose={() => setHelping(false)} />}
    </div>
  );
}
