import { useEffect, useState } from "react";

export interface Remote<T> {
    data : T | undefined;
    error : string | undefined;
    loading : boolean;
}

// Calls load(arg) on mount and whenever arg changes. `load` must be a stable (module-level) function.
// Results are tagged with the arg they were loaded for, so a slow response for an old arg is never
// shown as the current one.
export function useRemote<A, T>(load: (arg: A) => Promise<T>, arg: A): Remote<T> {
    const [result, setResult] = useState<{ arg : A; data? : T; error? : string } | null>(null);

    useEffect(() => {
        let cancelled = false;
        load(arg).then(
            data => { if (!cancelled) setResult({ arg, data }); },
            (error: Error) => { if (!cancelled) setResult({ arg, error: error.message }); },
        );
        return () => { cancelled = true; };
    }, [load, arg]);

    const current = result !== null && Object.is(result.arg, arg);
    return {
        data: current ? result.data : undefined,
        error: current ? result.error : undefined,
        loading: !current,
    };
}
