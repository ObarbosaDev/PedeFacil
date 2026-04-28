import { DependencyList, useEffect } from "react";

export function useDebouncedEffect(effect: () => void | (() => void), delayMs: number, deps: DependencyList) {
  useEffect(() => {
    const handle = window.setTimeout(() => {
      effect();
    }, delayMs);

    return () => {
      window.clearTimeout(handle);
    };
  }, deps);
}
