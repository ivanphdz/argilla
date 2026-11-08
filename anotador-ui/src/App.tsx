import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { StoreProvider, useStore } from "./store";
import Documents from "./screens/Documents";
import Entities from "./screens/Entities";
import Login from "./screens/Login";
import Review from "./screens/Review";
import Rules from "./screens/Rules";
import { CheckIcon } from "./components/Icons";

function Routed() {
  const { user, toast } = useStore();
  if (!user) return <Login />;
  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/documentos" element={<Documents />} />
          <Route path="/pagina/:pageId" element={<Review />} />
          <Route path="/entidades" element={<Entities />} />
          <Route path="/reglas" element={<Rules />} />
          <Route path="*" element={<Navigate to="/documentos" replace />} />
        </Route>
      </Routes>
      {toast && (
        <div className="toast" role="status">
          <CheckIcon size={15} /> {toast}
        </div>
      )}
    </>
  );
}

export default function App() {
  // HashRouter: funciona al servirse como archivos estáticos desde una subruta (/anotador/).
  return (
    <HashRouter>
      <StoreProvider>
        <Routed />
      </StoreProvider>
    </HashRouter>
  );
}
