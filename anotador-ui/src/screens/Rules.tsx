import { RULE_KIND_INFO } from "../data/text";
import { useStore } from "../store";

export default function Rules() {
  const { rules, decideRule, user, config, notify } = useStore();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reglas sugeridas</h1>
          <p>
            Ideas para mejorar el modelo, sacadas de las correcciones de todas las personas. Solo las aprobadas se usan en
            el próximo entrenamiento.
          </p>
        </div>
      </div>

      {config?.mode === "argilla" && (
        <div className="banner banner-info">Las reglas todavía se guardan solo en esta computadora.</div>
      )}

      <div className="rules">
        {rules.map((rule) => (
          <article key={rule.id} className="card rule">
            <span className="pill pill-neutral">{RULE_KIND_INFO[rule.kind]}</span>
            <p>{rule.text}</p>
            <p className="example">
              Ejemplo: <em>{rule.example}</em>
            </p>
            <div className="rule-foot">
              {rule.status === "pending" ? (
                <>
                  <span>Se aprueba a nombre de {user}</span>
                  <div className="actions">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        decideRule(rule.id, "approved");
                        notify("Regla aprobada");
                      }}
                    >
                      Aprobar
                    </button>
                    <button className="btn btn-sm" onClick={() => decideRule(rule.id, "discarded")}>
                      Descartar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className={`pill ${rule.status === "approved" ? "pill-success" : "pill-neutral"}`}>
                    {rule.status === "approved" ? "Aprobada" : "Descartada"} por {rule.decidedBy}
                  </span>
                  <button className="btn btn-sm" onClick={() => decideRule(rule.id, "pending")}>
                    Deshacer
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
