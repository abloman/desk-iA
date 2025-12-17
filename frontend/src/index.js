import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

const root = ReactDOM.createRoot(document.getElementById("root"));
// Remove StrictMode to avoid double-render issues with portals (Dialog, Dropdown, Toast)
root.render(<App />);
