import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./contexts/AuthContext";
import { GameProvider } from "./contexts/GameContext";
import App from "./App.tsx";
import "./index.css";

if (typeof global === "undefined") {
  window.global = window;
}
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <StrictMode>
      <AuthProvider>
        <GameProvider>
          <App />
          <Toaster
            position="top-right"
            richColors
            closeButton
            duration={4000}
          />
        </GameProvider>
      </AuthProvider>
    </StrictMode>
  </BrowserRouter>
);
