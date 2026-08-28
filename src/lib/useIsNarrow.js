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

// The v3 redesign draws exactly two widths -- 430 and 1440 -- so it needs one
// switch rather than the eight the app accumulated (480/560/640/720/900/980/
// 1100/1280, each page picking its own). Below this the mobile mock renders;
// at and above it the desktop mock does, with its rails collapsing per the
// desktop handoff rather than the layout changing shape again.
//
// 900 rather than 1100: at 1100 an iPad in landscape and a 13" laptop get the
// phone design, which is the exact failure `e84eac9` fixed once already.
export const PHONE_BP = 900;

export function useIsPhone() {
  return useIsNarrow(PHONE_BP);
}
