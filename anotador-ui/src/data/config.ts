// Configuración de conexión. Orden de prioridad:
// 1. Configuración guardada en este navegador (Ayuda → Conexión).
// 2. Un archivo `config.json` junto a index.html (se crea al desplegar y nunca
//    se sube al repo porque contiene la clave de la API). Ver public/config.example.json.
// 3. Modo de prueba con páginas de ejemplo.

import { createArgillaSource, type ArgillaConfig } from "./argilla";
import { createDemoSource } from "./demo";
import type { DataSource } from "./types";

export type AppConfig = { mode: "demo" } | ({ mode: "argilla" } & ArgillaConfig);

const SETTINGS_KEY = "anotador.connection.v1";

export function savedConfig(): AppConfig | null {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? (JSON.parse(raw) as AppConfig) : null;
  } catch {
    return null;
  }
}

export function saveConfig(config: AppConfig | null): void {
  try {
    if (config) localStorage.setItem(SETTINGS_KEY, JSON.stringify(config));
    else localStorage.removeItem(SETTINGS_KEY);
  } catch {
    // La configuración solo dura esta visita.
  }
}

async function deployedConfig(): Promise<AppConfig | null> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}config.json`, { cache: "no-store" });
    if (!response.ok) return null;
    const data = await response.json();
    if (data?.mode === "argilla" && data.apiKey) {
      return { mode: "argilla", apiUrl: data.apiUrl || "", apiKey: data.apiKey, workspace: data.workspace || "historia" };
    }
    if (data?.mode === "demo") return { mode: "demo" };
  } catch {
    // No hay config.json: se continúa con la siguiente opción.
  }
  return null;
}

export async function resolveConfig(): Promise<AppConfig> {
  return savedConfig() || (await deployedConfig()) || { mode: "demo" };
}

export function sourceFor(config: AppConfig): DataSource {
  return config.mode === "argilla" ? createArgillaSource(config) : createDemoSource();
}
