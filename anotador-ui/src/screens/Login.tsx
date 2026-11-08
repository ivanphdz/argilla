import { useState } from "react";
import { AlertIcon } from "../components/Icons";
import { useStore } from "../store";

export default function Login() {
  const { setUser } = useStore();
  const [name, setName] = useState("");
  const [error, setError] = useState(false);

  return (
    <div className="login">
      <form
        className="card login-card"
        onSubmit={(e) => {
          e.preventDefault();
          const clean = name.trim().replace(/\s+/g, " ");
          if (clean.length < 2) return setError(true);
          setUser(clean);
        }}
      >
        <h1>Te damos la bienvenida</h1>
        <p className="ask">¿Cómo te llamas?</p>
        <label htmlFor="name">Nombre y apellido</label>
        <input
          id="name"
          className="input"
          placeholder="Ej.: Laura Méndez"
          autoComplete="name"
          autoFocus
          aria-invalid={error}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(false);
          }}
        />
        {error && (
          <p className="form-error" style={{ marginTop: 8 }}>
            <AlertIcon size={14} /> Escribe tu nombre para continuar.
          </p>
        )}
        <button className="btn btn-primary btn-block" type="submit">
          Entrar
        </button>
        <p className="foot">Con tu nombre quedan firmadas tus revisiones y comentarios.</p>
      </form>
    </div>
  );
}
