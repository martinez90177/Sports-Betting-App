import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import ErrorBoundary from "./ErrorBoundary.jsx";
import PropLedger from "./PropLedger.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <PropLedger />
    </ErrorBoundary>
  </React.StrictMode>
);
