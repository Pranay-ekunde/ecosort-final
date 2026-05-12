import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import App from "./App";
import "./index.css";

// Apply persisted theme before first paint
const savedTheme = localStorage.getItem("theme") || "dark";
document.body.dataset.theme = savedTheme;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <App />
          <Toaster
            position="top-right"
            toastOptions={{
              style: { background:"var(--surface)", color:"var(--text)", border:"1px solid var(--border)" },
              success: { iconTheme: { primary:"var(--green)", secondary:"var(--surface)" } },
              error:   { iconTheme: { primary:"var(--red)", secondary:"var(--surface)" } },
            }}
          />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);