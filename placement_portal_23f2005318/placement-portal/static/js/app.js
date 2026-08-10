/* Root component + app bootstrap. */
const RootApp = {
  computed: {
    state() { return Store.state; },
    displayName() {
      const p = Store.state.profile || {};
      return p.full_name || p.name || "Admin";
    },
    homeLink() { return Store.homeFor(this.state.user && this.state.user.role); },
    roleLabel() {
      return { admin: "Placement Cell", company: "Company", student: "Student" }[
        this.state.user && this.state.user.role] || "";
    },
  },
  methods: {
    dismiss: Store.dismiss,
    logout() {
      Store.logout();
      this.$router.push("/login");
      Store.notify("You have been logged out.");
    },
  },
  template: `
  <div>
    <nav v-if="state.user" class="navbar navbar-expand-lg bg-white border-bottom sticky-top">
      <div class="container-fluid px-3 px-lg-4">
        <router-link :to="homeLink" class="navbar-brand d-flex align-items-center">
          <span class="navbar-brand-mark">PP</span>
          <span class="fw-semibold">Placement Portal</span>
        </router-link>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse"
                data-bs-target="#nav"><span class="navbar-toggler-icon"></span></button>

        <div class="collapse navbar-collapse" id="nav">
          <ul class="navbar-nav me-auto">
            <template v-if="state.user.role === 'admin'">
              <li class="nav-item"><router-link to="/admin" class="nav-link">Dashboard</router-link></li>
              <li class="nav-item"><router-link to="/admin/reports" class="nav-link">Reports</router-link></li>
            </template>
            <template v-else-if="state.user.role === 'company'">
              <li class="nav-item"><router-link to="/company" class="nav-link">Dashboard</router-link></li>
              <li class="nav-item"><router-link to="/company/drives/new" class="nav-link">Create Drive</router-link></li>
              <li class="nav-item"><router-link to="/company/profile" class="nav-link">Profile</router-link></li>
            </template>
            <template v-else>
              <li class="nav-item"><router-link to="/student" class="nav-link">Dashboard</router-link></li>
              <li class="nav-item"><router-link to="/student/drives" class="nav-link">Drives</router-link></li>
              <li class="nav-item"><router-link to="/student/history" class="nav-link">History</router-link></li>
            </template>
          </ul>

          <div class="d-flex align-items-center gap-3">
            <div class="text-end d-none d-lg-block">
              <div class="small fw-semibold">{{ displayName }}</div>
              <div class="text-muted-sm">{{ roleLabel }}</div>
            </div>
            <button class="btn btn-sm btn-outline-secondary" @click="logout">
              <i class="bi bi-box-arrow-right"></i> Logout</button>
          </div>
        </div>
      </div>
    </nav>

    <router-view v-slot="{ Component }">
      <component :is="Component" />
    </router-view>

    <div class="toast-stack">
      <div v-for="t in state.toasts" :key="t.id"
           class="alert alert-dismissible shadow-sm d-flex align-items-start gap-2"
           :class="'alert-' + (t.variant === 'danger' ? 'danger' : 'success')">
        <i :class="'bi bi-' + (t.variant === 'danger' ? 'exclamation-triangle' : 'check-circle')"></i>
        <div class="small flex-grow-1">{{ t.message }}</div>
        <button type="button" class="btn-close" @click="dismiss(t.id)"></button>
      </div>
    </div>
  </div>`,
};

const app = Vue.createApp(RootApp);

// Register the shared presentational components globally (kebab-case in templates).
app.component("status-badge", Components.StatusBadge);
app.component("empty-state", Components.EmptyState);
app.component("stat-card", Components.StatCard);
app.component("logo-mark", Components.LogoMark);
app.component("page-header", Components.PageHeader);
app.component("loader", Components.Loader);

// Formatting helpers available in every template as `fmt.…`
app.config.globalProperties.fmt = window.fmt;
app.config.globalProperties.$fmt = window.fmt;
app.use(router);
app.mount("#app");
