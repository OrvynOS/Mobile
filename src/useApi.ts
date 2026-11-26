import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { api } from "./api";

/** GET `path` (null to skip): data, error, and refresh (also refreshed when the screen regains focus). */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!path) return;
    setRefreshing(true);
    try {
      setData(await api<T>(path));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }, [path]);

  // Runs on first focus too, so this is also the initial load.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return { data, error, refreshing, refresh: load, setData };
}
