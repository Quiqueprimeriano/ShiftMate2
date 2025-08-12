import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeTokenRefresh } from "./lib/token-refresh";

// Initialize persistent login token refresh system
initializeTokenRefresh();

createRoot(document.getElementById("root")!).render(<App />);
