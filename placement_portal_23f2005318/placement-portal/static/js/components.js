/* Small reusable presentational components registered globally. */

window.Components = {};

/* Colour-coded status pill (drive status + application status). */
Components.StatusBadge = {
  props: { status: String },
  computed: {
    cls() {
      return {
        pending: "bg-warning-subtle text-warning-emphasis",
        approved: "bg-success-subtle text-success-emphasis",
        rejected: "bg-danger-subtle text-danger-emphasis",
        closed: "bg-secondary-subtle text-secondary-emphasis",
        applied: "bg-primary-subtle text-primary-emphasis",
        shortlisted: "bg-info-subtle text-info-emphasis",
        waiting: "bg-warning-subtle text-warning-emphasis",
        selected: "bg-success-subtle text-success-emphasis",
      }[this.status] || "bg-light text-secondary";
    },
    label() {
      return { shortlisted: "Short listed" }[this.status] || fmt.title(this.status || "—");
    },
  },
  template: `<span class="badge badge-soft" :class="cls">{{ label }}</span>`,
};

/* Empty-table placeholder. */
Components.EmptyState = {
  props: { icon: { type: String, default: "inbox" }, text: String },
  template: `
    <div class="empty-state">
      <i :class="'bi bi-' + icon"></i>
      <div>{{ text }}</div>
    </div>`,
};

/* Dashboard KPI tile. */
Components.StatCard = {
  props: { label: String, value: [String, Number], icon: String },
  template: `
    <div class="card stat-card h-100">
      <div class="card-body py-3">
        <div class="d-flex align-items-center justify-content-between">
          <div>
            <div class="stat-value">{{ value }}</div>
            <div class="stat-label">{{ label }}</div>
          </div>
          <i v-if="icon" :class="'bi bi-' + icon" class="fs-3 text-primary opacity-25"></i>
        </div>
      </div>
    </div>`,
};

/* Square logo / avatar built from initials. */
Components.LogoMark = {
  props: { name: String, url: String },
  template: `
    <span class="company-logo">
      <img v-if="url" :src="url" :alt="name" class="w-100 h-100 rounded" style="object-fit:cover">
      <template v-else>{{ initials }}</template>
    </span>`,
  computed: { initials() { return fmt.initials(this.name); } },
};

/* Page heading with an optional back button and right-hand slot. */
Components.PageHeader = {
  props: { title: String, subtitle: String, back: [String, Object] },
  template: `
    <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
      <div>
        <router-link v-if="back" :to="back" class="btn btn-sm btn-outline-secondary mb-2">
          <i class="bi bi-arrow-left"></i> Back
        </router-link>
        <h4 class="mb-1">{{ title }}</h4>
        <div v-if="subtitle" class="text-muted-sm">{{ subtitle }}</div>
      </div>
      <div class="d-flex gap-2 flex-wrap"><slot name="actions"></slot></div>
    </div>`,
};

/* Full-page loading spinner. */
Components.Loader = {
  template: `
    <div class="text-center py-5">
      <div class="spinner-border text-primary"></div>
    </div>`,
};
