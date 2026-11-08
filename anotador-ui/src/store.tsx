import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { resolveConfig, sourceFor, type AppConfig } from "./data/config";
import { entityKey, loadGroups, loadRules, saveGroups, setRuleStatus, type Groups } from "./data/local";
import { lineRange, spanText } from "./data/text";
import type { DataSource, Label, NewPageInput, Page, Rule, RuleStatus, SaveInput } from "./data/types";

const USER_KEY = "anotador.user.v1";

export type EntityState = "Sugerida" | "Confirmada" | "Posible";

export interface EntityRow {
  key: string;
  pageId: string;
  pageTitle: string;
  start: number;
  end: number;
  label: Label;
  text: string;
  lines: string;
  state: EntityState;
  group?: string;
}

interface Store {
  user: string;
  setUser(name: string): void;
  config: AppConfig | null;
  applyConfig(config: AppConfig): void;
  source: DataSource | null;
  pages: Page[];
  loading: boolean;
  error: string | null;
  reload(): Promise<void>;
  savePage(page: Page, input: SaveInput): Promise<Page>;
  addPages(pages: NewPageInput[]): Promise<Page[]>;
  entities: EntityRow[];
  rules: Rule[];
  decideRule(id: string, status: RuleStatus): void;
  groups: Groups;
  setGroups(groups: Groups): void;
  toast: string | null;
  notify(message: string): void;
}

const StoreContext = createContext<Store | null>(null);

function readUser(): string {
  try {
    return localStorage.getItem(USER_KEY) || "";
  } catch {
    return "";
  }
}

export function spanState(page: Page, origin: "model" | "human"): EntityState {
  return page.status === "submitted" || origin === "human" ? "Confirmada" : "Sugerida";
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState(readUser);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [source, setSource] = useState<DataSource | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rules, setRules] = useState<Rule[]>(loadRules);
  const [groups, setGroupsState] = useState<Groups>(loadGroups);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async (next: DataSource) => {
    setLoading(true);
    setError(null);
    try {
      setPages(await next.listPages());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const applyConfig = useCallback(
    (next: AppConfig) => {
      const nextSource = sourceFor(next);
      setConfig(next);
      setSource(nextSource);
      void load(nextSource);
    },
    [load],
  );

  useEffect(() => {
    void resolveConfig().then(applyConfig);
  }, [applyConfig]);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? null : current)), 3200);
  }, []);

  const entities = useMemo<EntityRow[]>(() => {
    const rows: EntityRow[] = [];
    for (const page of pages) {
      for (const s of page.spans) {
        const key = entityKey(page.id, s.start, s.end);
        rows.push({
          key,
          pageId: page.id,
          pageTitle: page.title,
          start: s.start,
          end: s.end,
          label: s.label,
          text: spanText(page.text, s.start, s.end),
          lines: lineRange(page.text, s.start, s.end),
          state: spanState(page, s.origin),
          group: groups[key],
        });
      }
      for (const c of page.candidates) {
        const key = entityKey(page.id, c.start, c.end);
        rows.push({
          key,
          pageId: page.id,
          pageTitle: page.title,
          start: c.start,
          end: c.end,
          label: c.label,
          text: spanText(page.text, c.start, c.end),
          lines: lineRange(page.text, c.start, c.end),
          state: "Posible",
          group: groups[key],
        });
      }
    }
    return rows.sort((a, b) => a.pageTitle.localeCompare(b.pageTitle) || a.start - b.start);
  }, [pages, groups]);

  const store: Store = {
    user,
    setUser(name) {
      setUserState(name);
      try {
        if (name) localStorage.setItem(USER_KEY, name);
        else localStorage.removeItem(USER_KEY);
      } catch {
        // El nombre solo se conserva durante esta visita.
      }
    },
    config,
    applyConfig,
    source,
    pages,
    loading,
    error,
    reload: () => (source ? load(source) : Promise.resolve()),
    async savePage(page, input) {
      if (!source) throw new Error("Sin conexión");
      const saved = await source.savePage(page, input);
      setPages((current) => current.map((p) => (p.id === saved.id ? saved : p)));
      return saved;
    },
    async addPages(inputs) {
      if (!source) throw new Error("Sin conexión");
      const created = await source.addPages(inputs, user);
      setPages((current) => [...current, ...created]);
      return created;
    },
    entities,
    rules,
    decideRule(id, status) {
      setRules((current) => setRuleStatus(current, id, status, user));
    },
    groups,
    setGroups(next) {
      setGroupsState(next);
      saveGroups(next);
    },
    toast,
    notify,
  };

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside StoreProvider");
  return store;
}
