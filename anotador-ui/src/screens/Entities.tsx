import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LABEL_INFO } from "../data/text";
import type { Label } from "../data/types";
import { useStore, type EntityRow } from "../store";

type Filter = "all" | Label | "possible";

export default function Entities() {
  const { entities, groups, setGroups, notify, config } = useStore();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const counts = useMemo(() => {
    const by = (fn: (e: EntityRow) => boolean) => entities.filter(fn).length;
    return {
      all: entities.length,
      PERSONA: by((e) => e.label === "PERSONA"),
      LUGAR: by((e) => e.label === "LUGAR"),
      FECHA: by((e) => e.label === "FECHA"),
      possible: by((e) => e.state === "Posible"),
    };
  }, [entities]);

  const rows = entities.filter((e) =>
    filter === "all" ? true : filter === "possible" ? e.state === "Posible" : e.label === filter,
  );

  const chosen = entities.filter((e) => selected.has(e.key));
  const sharedGroup = chosen.length > 0 && chosen.every((e) => e.group && e.group === chosen[0].group) ? chosen[0].group : null;

  function toggle(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function group() {
    const name = chosen.find((e) => e.state === "Confirmada")?.text || chosen[0].text;
    const next = { ...groups };
    for (const e of chosen) next[e.key] = name;
    setGroups(next);
    setSelected(new Set());
    notify(`Agrupadas como “${name}”`);
  }

  function ungroup() {
    const next = { ...groups };
    for (const e of chosen) delete next[e.key];
    setGroups(next);
    setSelected(new Set());
    notify("Separadas del grupo");
  }

  const filters: { id: Filter; label: string; n: number; danger?: boolean }[] = [
    { id: "all", label: "Todas", n: counts.all },
    { id: "PERSONA", label: "Persona", n: counts.PERSONA },
    { id: "LUGAR", label: "Lugar", n: counts.LUGAR },
    { id: "FECHA", label: "Fecha", n: counts.FECHA },
    { id: "possible", label: "Por confirmar", n: counts.possible, danger: true },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Lista de entidades</h1>
          <p>Lo marcado en todas las páginas, tal como aparece. Haz clic en un texto para ir a él.</p>
        </div>
      </div>

      {config?.mode === "argilla" && (
        <div className="banner banner-info">Los grupos todavía se guardan solo en esta computadora.</div>
      )}

      <div className="filters" role="toolbar" aria-label="Filtrar">
        {filters.map((f) => (
          <button
            key={f.id}
            className={`filter${filter === f.id ? " is-on" : ""}${f.danger && filter !== f.id ? " filter-danger" : ""}`}
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
            <span className="n">{f.n}</span>
          </button>
        ))}
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        {!rows.length ? (
          <div className="empty">No hay entidades con este filtro.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <span className="sr-only">Elegir</span>
                </th>
                <th>Tal como aparece</th>
                <th>Tipo</th>
                <th>Página</th>
                <th>Renglón</th>
                <th>Estado</th>
                <th>Grupo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.key}>
                  <td>
                    <input
                      type="checkbox"
                      className="checkbox"
                      aria-label={`Elegir ${e.text}`}
                      checked={selected.has(e.key)}
                      onChange={() => toggle(e.key)}
                    />
                  </td>
                  <td>
                    <button
                      className={`entity-text${e.state === "Posible" ? " possible" : ""}`}
                      onClick={() => navigate(`/pagina/${e.pageId}?foco=${e.start}-${e.end}`)}
                    >
                      {e.text}
                    </button>
                  </td>
                  <td>
                    <span className="type-cell">
                      <span className={`dot dot-${e.label}`} /> {LABEL_INFO[e.label]?.name ?? e.label}
                    </span>
                  </td>
                  <td className="muted">{e.pageTitle}</td>
                  <td className="mono">{e.lines}</td>
                  <td className={e.state === "Posible" ? "text-danger" : "muted"}>{e.state}</td>
                  <td>{e.group ? <span className="group-tag">{e.group}</span> : <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="group-bar">
        {sharedGroup ? (
          <button className="btn btn-sm" onClick={ungroup}>
            Separar del grupo
          </button>
        ) : (
          <button className="btn btn-sm" disabled={chosen.length < 2} onClick={group}>
            Agrupar como la misma
          </button>
        )}
        Elige 2 o más que sean la misma persona o lugar escrito de forma distinta.
      </div>
    </>
  );
}
