import { useEffect, useState } from "react";

// Is the viewport narrower than `breakpoint`?
//
// PropLedger has had its own copy of this since the first mobile pass; this is
// the same hook for the pages that live outside that file. Kept as a shared
// module rather than a third copy, because the breakpoints it is asked about
// have to agree with the ones index.css uses or a component will collapse its
// layout at a width the stylesheet has not.
//
// matchMedia rather than a resize listener: it fires once on the crossing
// instead of on every pixel of a drag, and it gives the right answer on the
// first render rather than after one.
export default function useIsNarrow(breakpoint = 900) {
  const [narrow, setNarrow] = useState(
    typeof window !== "undefined" && window.innerWidth <= breakpoint
  );
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = () => setNarrow(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [breakpoint]);
  return narrow;
}
