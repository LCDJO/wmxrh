import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerNotificationListeners } from "@/domains/notifications/notification-event-listener";

// Boot notification listener bridge (event buses → notification hub)
registerNotificationListeners();

createRoot(document.getElementById("root")!).render(<App />);
