import { useEffect, useRef } from "react";

// --------------------------------------------------------------------------
// Overlay dismissal
// --------------------------------------------------------------------------
// The four behaviours every full-screen overlay in this app needs: Escape to
// close, a body scroll lock so the page underneath doesn't move, focus moved
// into the dialog and handed back on close, and a claimed history entry so a
// native back gesture closes the overlay instead of unloading the SPA.
//
// That last one is not optional here. The app has no router -- navigation is
// a useState in PropLedger -- so a back gesture with nothing on the stack
// leaves the site entirely and reloads it to its default Prop Feed state,
// losing whatever the user was looking at.
//
// Generalised from MLBDetailModal, whose own comment noted the logic was a
// copy of FilterPanelLauncher's and that factoring the two together was worth
// doing on its own. Those two are left alone deliberately: they work, they
// apply these behaviours per-breakpoint in ways this hook doesn't model, and
// rewriting their history handling is a risk with no user-visible payoff.
//
// Returns a ref to put on the panel element (for focus) and requestClose(),
// which every explicit close path must call instead of onClose directly so
// the pushed history entry gets consumed rather than orphaned.
export function useOverlay({ open, onClose, historyKey, lockScroll = true }) {
  const panelRef = useRef(null);
  const restoreFocusRef = useRef(null);
  // Tracks whether we're the one who pushed the dummy history entry below, so
  // requestClose() and the effect's cleanup never both try to consume it.
  const pushedHistoryRef = useRef(false);
  // onClose is read through a ref inside the history effect so that a caller
  // passing an inline arrow (the common case) doesn't re-run the effect on
  // every render -- which would push and drop history entries continuously.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const requestClose = () => {
    if (pushedHistoryRef.current) window.history.back();
    else onCloseRef.current();
  };
  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;

  // Escape + body scroll lock.
  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    if (lockScroll) document.body.style.overflow = "hidden";
    const handleKeyDown = (e) => {
      if (e.key === "Escape") requestCloseRef.current();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      if (lockScroll) document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, lockScroll]);

  // Move focus into the dialog on open and hand it back to whatever opened it
  // on close, so keyboard users aren't dropped at the top of the document
  // every time they open a panel.
  useEffect(() => {
    if (!open) return undefined;
    restoreFocusRef.current = document.activeElement;
    panelRef.current?.focus();
    return () => {
      const el = restoreFocusRef.current;
      if (el && typeof el.focus === "function") el.focus();
    };
  }, [open]);

  // Claims one same-document history entry for as long as the overlay is open.
  useEffect(() => {
    if (!open || !historyKey) return undefined;
    // Idempotent on purpose: React (StrictMode in dev) can run this setup, its
    // cleanup, and this setup again for a single logical open, and pushing
    // twice would leave an orphaned entry that neither requestClose nor a real
    // back gesture would ever consume.
    if (!(window.history.state && window.history.state[historyKey])) {
      window.history.pushState({ [historyKey]: true }, "");
    }
    pushedHistoryRef.current = true;
    const handlePopState = () => {
      pushedHistoryRef.current = false;
      onCloseRef.current();
    };
    window.addEventListener("popstate", handlePopState);
    // Deliberately does NOT call history.back() here: cleanup must stay a pure
    // "undo the listener" step. Calling back() (an async, real navigation) from
    // a cleanup breaks under StrictMode's double-invoke -- the practice
    // teardown would fire a real popstate that closes the overlay right after
    // it opens. Consuming the dummy entry only happens through requestClose (an
    // explicit close) or an actual user back gesture.
    return () => {
      window.removeEventListener("popstate", handlePopState);
      pushedHistoryRef.current = false;
    };
  }, [open, historyKey]);

  return { panelRef, requestClose };
}
