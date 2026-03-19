import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import AlarmPopup from "./AlarmPopup.tsx";

const isAlarmPopup = window.location.hash === "#alarm-popup";

if (isAlarmPopup) {
  document.body.classList.add("alarm-popup-body");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isAlarmPopup ? <AlarmPopup /> : <App />}
  </StrictMode>
);
