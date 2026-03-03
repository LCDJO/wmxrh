import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerNotificationListeners } from "@/domains/notifications/notification-event-listener";
import { bootstrapSignatureProviders } from "@/domains/employee-agreement/provider-bootstrap";

// Boot notification listener bridge (event buses → notification hub)
registerNotificationListeners();

// Boot digital signature provider registry
bootstrapSignatureProviders();

createRoot(document.getElementById("root")!).render(<App />);
