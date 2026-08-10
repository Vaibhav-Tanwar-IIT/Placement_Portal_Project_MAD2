/* Global reactive store: session + toast notifications. */
window.Store = (function () {
  const { reactive } = Vue;

  const state = reactive({
    user: null,
    profile: null,
    ready: false,
    toasts: [],
  });

  let toastId = 0;

  function notify(message, variant = "success") {
    const id = ++toastId;
    state.toasts.push({ id, message, variant });
    setTimeout(() => dismiss(id), 4500);
  }

  function dismiss(id) {
    const i = state.toasts.findIndex((t) => t.id === id);
    if (i > -1) state.toasts.splice(i, 1);
  }

  function setSession(payload) {
    state.user = payload.user;
    state.profile = payload.profile;
  }

  async function bootstrap() {
    if (API.token()) {
      try {
        setSession(await API.get("/api/auth/me"));
      } catch (e) {
        API.setToken(null);
        state.user = null;
      }
    }
    state.ready = true;
  }

  function logout() {
    API.setToken(null);
    state.user = null;
    state.profile = null;
  }

  function homeFor(role) {
    return { admin: "/admin", company: "/company", student: "/student" }[role] || "/login";
  }

  return { state, notify, dismiss, setSession, bootstrap, logout, homeFor };
})();

/* ---- Shared formatting helpers ---- */
window.fmt = {
  date(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d)) return value;
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  },
  datetime(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d)) return value;
    return d.toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  },
  money(value) {
    if (!value) return "—";
    return "₹ " + Number(value).toLocaleString("en-IN");
  },
  title(value) {
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
  },
  initials(name) {
    if (!name) return "?";
    return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  },
  branches(value) {
    if (!value) return "All branches";
    return value.split(",").map((b) => b.trim()).filter(Boolean).join(", ");
  },
  daysLeft(value) {
    if (!value) return null;
    const diff = Math.ceil((new Date(value) - new Date()) / 86400000);
    return diff;
  },
};
