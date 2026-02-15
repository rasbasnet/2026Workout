import { protectPage } from "./auth-guard.js";
import { wireGlobalActions } from "./layout.js";

protectPage(() => {
  wireGlobalActions();
});
