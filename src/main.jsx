import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import ErrorBoundary from "./ErrorBoundary.jsx";
import { SettingsProvider } from "./settings.jsx";
import PropLedger from "./PropLedger.jsx";

// SettingsProvider sits *inside* ErrorBoundary so a crash in the provider is
// still caught, but outside PropLedger so the theme is applied before the app
// renders (the provider writes data-theme in its state initialiser).
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <SettingsProvider>
        <PropLedger />
      </SettingsProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
