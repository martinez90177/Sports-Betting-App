import React from "react";

// React unmounts the whole tree when a render throws and nothing catches it,
// so before this existed a single bad row -- one player whose live-fetched log
// arrived in a shape the row didn't expect -- took the entire site down to a
// blank white page with no header and no way back. That is the worst possible
// failure mode for a link you hand to other people: it looks like the site is
// gone rather than like one row is broken.
//
// Has to be a class: componentDidCatch/getDerivedStateFromError have no hook
// equivalent.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Kept as a console error on purpose -- there's no error-reporting service
    // wired up, and swallowing it entirely would make a caught crash harder to
    // debug than an uncaught one.
    console.error("Caught by ErrorBoundary:", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    // `compact` is for boundaries wrapped around a single repeated item (a
    // feed row): the surrounding page is fine, so it should say so quietly and
    // take up about as much room as the thing it replaced.
    if (this.props.compact) {
      return (
        <div style={{
          padding: "14px 16px", fontSize: 12, color: "var(--dim)",
          borderBottom: "1px solid var(--line)",
        }}>
          {this.props.label || "This row couldn't be displayed."}
        </div>
      );
    }

    return (
      <div style={{
        maxWidth: 460, margin: "60px auto", padding: "24px",
        background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10,
        textAlign: "center",
      }}>
        <div className="oswald" style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>
          Something broke on this page
        </div>
        <div style={{ fontSize: 13, color: "var(--dim)", lineHeight: 1.5, marginBottom: 18 }}>
          Reloading usually clears it. Your saved picks are stored on this
          device and aren't affected.
        </div>
        <button
          type="button"
          className="oswald cta-btn"
          onClick={() => window.location.reload()}
          style={{
            cursor: "pointer", padding: "10px 24px", borderRadius: 6,
            fontSize: 13.5, fontWeight: 700, letterSpacing: "0.02em",
          }}
        >
          Reload
        </button>
        {/* Shown rather than hidden: when this does fire, the message is the
            only clue available, and asking someone to open devtools to report
            a bug is a worse experience than a line of monospace text. */}
        <div className="mono" style={{
          marginTop: 16, fontSize: 10.5, color: "var(--dim)", opacity: 0.75,
          wordBreak: "break-word", textAlign: "left",
        }}>
          {String(this.state.error?.message || this.state.error)}
        </div>
      </div>
    );
  }
}
