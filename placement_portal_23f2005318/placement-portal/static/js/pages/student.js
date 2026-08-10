/* Student screens. */
window.Pages = window.Pages || {};

Pages.StudentDashboard = {
  data: () => ({ d: null, loading: true }),
  created() { this.load(); },
  methods: {
    async load() {
      this.loading = true;
      try { this.d = await API.get("/api/student/dashboard"); }
      catch (e) { Store.notify(e.message, "danger"); }
      finally { this.loading = false; }
    },
    async withdraw(a) {
      if (!confirm(`Withdraw your application to ${a.drive_name}?`)) return;
      try {
        const r = await API.del("/api/student/applications/" + a.id);
        Store.notify(r.message); this.load();
      } catch (e) { Store.notify(e.message, "danger"); }
    },
  },
  template: `
  <div class="page">
    <loader v-if="loading" />
    <template v-else-if="d">
      <page-header :title="'Welcome, ' + d.profile.full_name"
                   :subtitle="d.profile.branch + ' · CGPA ' + d.profile.cgpa +
                              ' · Batch of ' + (d.profile.grad_year || '—')">
        <template #actions>
          <router-link to="/student/profile" class="btn btn-sm btn-outline-secondary">
            <i class="bi bi-pencil"></i> Edit profile</router-link>
          <router-link to="/student/history" class="btn btn-sm btn-outline-secondary">
            History</router-link>
          <router-link to="/student/drives" class="btn btn-sm btn-primary">
            <i class="bi bi-search"></i> Browse drives</router-link>
        </template>
      </page-header>

      <div class="row g-3 mb-3">
        <div class="col-6 col-lg-3">
          <stat-card label="Open drives" :value="d.open_drives_count" icon="briefcase" /></div>
        <div class="col-6 col-lg-3">
          <stat-card label="Applications" :value="d.applied_drives.length" icon="send" /></div>
        <div class="col-6 col-lg-3">
          <stat-card label="Short listed"
             :value="d.applied_drives.filter(a=>a.status==='shortlisted').length"
             icon="star" /></div>
        <div class="col-6 col-lg-3">
          <stat-card label="Selected"
             :value="d.applied_drives.filter(a=>a.status==='selected').length"
             icon="trophy" /></div>
      </div>

      <div class="row g-3">
        <div class="col-lg-5">
          <div class="card h-100">
            <div class="card-header">Organizations</div>
            <div class="list-group list-group-flush">
              <div v-for="c in d.organizations" :key="c.id"
                   class="list-group-item d-flex align-items-center gap-3">
                <logo-mark :name="c.name" :url="c.logo_url" />
                <div class="flex-grow-1">
                  <div class="fw-semibold">{{ c.name }}</div>
                  <div class="text-muted-sm">{{ c.industry || '—' }} · {{ c.location || '—' }}</div>
                </div>
                <router-link :to="'/student/organizations/'+c.id"
                             class="btn btn-sm btn-outline-primary">View details</router-link>
              </div>
            </div>
            <empty-state v-if="!d.organizations.length" icon="building"
                         text="No organizations are registered yet." />
          </div>
        </div>

        <div class="col-lg-7">
          <div class="card h-100">
            <div class="card-header">Applied Drives</div>
            <div class="table-responsive">
              <table class="table">
                <thead><tr><th>Sr No.</th><th>Drive Name</th><th>Company</th><th>Date</th>
                           <th>Status</th><th class="text-end">Actions</th></tr></thead>
                <tbody>
                  <tr v-for="(a,i) in d.applied_drives" :key="a.id">
                    <td>{{ i+1 }}</td>
                    <td class="fw-semibold">{{ a.drive_name }}</td>
                    <td>{{ a.company_name }}</td>
                    <td>{{ fmt.date(a.applied_on) }}</td>
                    <td><status-badge :status="a.status" /></td>
                    <td class="text-end text-nowrap">
                      <router-link :to="'/student/drives/'+a.drive_id"
                                   class="btn btn-sm btn-outline-primary me-1">View</router-link>
                      <button v-if="['applied','waiting'].includes(a.status)"
                              class="btn btn-sm btn-outline-danger"
                              @click="withdraw(a)">Withdraw</button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <empty-state v-if="!d.applied_drives.length" icon="send"
                           text="You have not applied to any drive yet." />
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>`,
};

/* ------------------------------------------------------------ drive list */
Pages.StudentDrives = {
  data: () => ({ drives: [], loading: true, q: "", onlyEligible: false }),
  created() { this.load(); },
  computed: {
    filtered() {
      const term = this.q.trim().toLowerCase();
      return this.drives.filter((d) => {
        if (this.onlyEligible && (!d.eligible || d.applied)) return false;
        if (!term) return true;
        return (d.drive_name + d.job_title + d.company_name + (d.location || ""))
          .toLowerCase().includes(term);
      });
    },
  },
  methods: {
    async load() {
      this.loading = true;
      try { this.drives = (await API.get("/api/student/drives")).drives; }
      catch (e) { Store.notify(e.message, "danger"); }
      finally { this.loading = false; }
    },
    async apply(d) {
      try {
        const r = await API.post(`/api/student/drives/${d.id}/apply`, {});
        Store.notify(r.message); this.load();
      } catch (e) { Store.notify(e.message, "danger"); }
    },
    deadlineText(d) {
      const left = fmt.daysLeft(d.application_deadline);
      if (left === null) return "";
      if (left < 0) return "Closed";
      if (left === 0) return "Closes today";
      return left + " day(s) left";
    },
  },
  template: `
  <div class="page">
    <page-header title="Placement Drives"
                 subtitle="Every drive approved by the placement cell." back="/student" />

    <div class="card mb-3">
      <div class="card-body py-3 d-flex flex-wrap gap-3 align-items-center">
        <input v-model="q" class="form-control" style="max-width:340px"
               placeholder="Search by role, company or location…">
        <div class="form-check mb-0">
          <input class="form-check-input" type="checkbox" v-model="onlyEligible" id="elig">
          <label class="form-check-label small" for="elig">
            Only show drives I am eligible for</label>
        </div>
        <span class="text-muted-sm ms-auto">{{ filtered.length }} drive(s)</span>
      </div>
    </div>

    <loader v-if="loading" />
    <div v-else class="row g-3">
      <div v-for="d in filtered" :key="d.id" class="col-md-6 col-xl-4">
        <div class="card h-100">
          <div class="card-body d-flex flex-column">
            <div class="d-flex gap-3 mb-3">
              <logo-mark :name="d.company_name" :url="d.company_logo" />
              <div>
                <div class="fw-semibold">{{ d.job_title }}</div>
                <div class="text-muted-sm">{{ d.company_name }} · {{ d.drive_name }}</div>
              </div>
            </div>
            <div class="small mb-3">
              <div><i class="bi bi-geo-alt text-muted"></i> {{ d.location || '—' }}</div>
              <div><i class="bi bi-cash text-muted"></i> {{ fmt.money(d.salary) }}</div>
              <div><i class="bi bi-mortarboard text-muted"></i>
                   Min CGPA {{ d.min_cgpa }} ·
                   {{ fmt.branches(d.eligible_branches) }}</div>
              <div><i class="bi bi-calendar-event text-muted"></i>
                   {{ fmt.date(d.application_deadline) }}
                   <span class="text-muted">({{ deadlineText(d) }})</span></div>
            </div>

            <div v-if="!d.eligible && !d.applied" class="alert alert-warning py-1 px-2 small mb-3">
              {{ d.ineligible_reason }}
            </div>

            <div class="mt-auto d-flex gap-2 align-items-center">
              <router-link :to="'/student/drives/'+d.id"
                           class="btn btn-sm btn-outline-primary">View details</router-link>
              <button v-if="!d.applied" class="btn btn-sm btn-primary"
                      :disabled="!d.eligible" @click="apply(d)">Apply</button>
              <status-badge v-else :status="d.application_status" class="ms-auto" />
            </div>
          </div>
        </div>
      </div>
      <div v-if="!filtered.length" class="col-12">
        <div class="card"><empty-state icon="briefcase"
             text="No drives match your search right now." /></div>
      </div>
    </div>
  </div>`,
};

/* ---------------------------------------------------------- drive detail */
Pages.StudentDrive = {
  data: () => ({ d: null, loading: true, busy: false }),
  created() { this.load(); },
  watch: { "$route.params.id": "load" },
  methods: {
    async load() {
      this.loading = true;
      try { this.d = (await API.get("/api/student/drives/" + this.$route.params.id)).drive; }
      catch (e) { Store.notify(e.message, "danger"); }
      finally { this.loading = false; }
    },
    async apply() {
      this.busy = true;
      try {
        const r = await API.post(`/api/student/drives/${this.d.id}/apply`, {});
        Store.notify(r.message); this.load();
      } catch (e) { Store.notify(e.message, "danger"); }
      finally { this.busy = false; }
    },
  },
  template: `
  <div class="page page-narrow">
    <loader v-if="loading" />
    <template v-else-if="d">
      <page-header :title="d.drive_name" :subtitle="d.company_name" back="/student/drives" />
      <div class="card">
        <div class="card-body p-4">
          <div class="d-flex justify-content-between align-items-start gap-3 mb-4">
            <div>
              <h5 class="mb-1">{{ d.job_title }}</h5>
              <div class="text-muted-sm">{{ d.company_name }}</div>
            </div>
            <logo-mark :name="d.company_name" :url="d.company_logo" />
          </div>

          <h6 class="text-muted-sm">Job Description</h6>
          <p>{{ d.job_description || 'No description provided.' }}</p>

          <dl class="row small mt-4">
            <dt class="col-sm-4 text-muted">Salary</dt>
            <dd class="col-sm-8">{{ fmt.money(d.salary) }}</dd>
            <dt class="col-sm-4 text-muted">Location</dt>
            <dd class="col-sm-8">{{ d.location || '—' }}</dd>
            <dt class="col-sm-4 text-muted">Openings</dt><dd class="col-sm-8">{{ d.openings }}</dd>
            <dt class="col-sm-4 text-muted">Interview mode</dt>
            <dd class="col-sm-8">{{ d.interview_mode }}</dd>
            <dt class="col-sm-4 text-muted">Eligible branches</dt>
            <dd class="col-sm-8">{{ fmt.branches(d.eligible_branches) }}</dd>
            <dt class="col-sm-4 text-muted">Minimum CGPA</dt>
            <dd class="col-sm-8">{{ d.min_cgpa }}</dd>
            <dt class="col-sm-4 text-muted">Graduating batch</dt>
            <dd class="col-sm-8">{{ d.eligible_year || 'Any' }}</dd>
            <dt class="col-sm-4 text-muted">Application deadline</dt>
            <dd class="col-sm-8">{{ fmt.date(d.application_deadline) }}</dd>
          </dl>

          <div v-if="d.applied" class="alert alert-success py-2 small">
            You applied to this drive. Current status:
            <status-badge :status="d.application_status" />
          </div>
          <div v-else-if="!d.eligible" class="alert alert-warning py-2 small">
            {{ d.ineligible_reason }}
          </div>

          <div class="d-flex gap-2 justify-content-end mt-4">
            <router-link to="/student/drives" class="btn btn-outline-secondary">Go Back</router-link>
            <button v-if="!d.applied" class="btn btn-primary px-4"
                    :disabled="!d.eligible || busy" @click="apply">
              <span v-if="busy" class="spinner-border spinner-border-sm me-1"></span>Apply</button>
          </div>
        </div>
      </div>
    </template>
  </div>`,
};

/* ------------------------------------------------------ organization view */
Pages.StudentOrganization = {
  data: () => ({ c: null, drives: [], loading: true }),
  created() { this.load(); },
  methods: {
    async load() {
      try {
        const r = await API.get("/api/student/organizations/" + this.$route.params.id);
        this.c = r.company; this.drives = r.drives;
      } catch (e) { Store.notify(e.message, "danger"); }
      finally { this.loading = false; }
    },
  },
  template: `
  <div class="page">
    <loader v-if="loading" />
    <template v-else-if="c">
      <page-header :title="c.name" :subtitle="(c.industry||'—') + ' · ' + (c.location||'—')"
                   back="/student" />
      <div class="row g-3">
        <div class="col-lg-5">
          <div class="card h-100">
            <div class="card-header">Overview</div>
            <div class="card-body">
              <div class="d-flex gap-3 align-items-center mb-3">
                <logo-mark :name="c.name" :url="c.logo_url" />
                <div class="fw-semibold">{{ c.name }}</div>
              </div>
              <p class="text-muted-sm">{{ c.overview || 'No overview provided.' }}</p>
              <dl class="row small mb-0">
                <dt class="col-5 text-muted">HR contact</dt>
                <dd class="col-7">{{ c.hr_contact || '—' }}</dd>
                <dt class="col-5 text-muted">Website</dt>
                <dd class="col-7">
                  <a v-if="c.website" :href="c.website" target="_blank">{{ c.website }}</a>
                  <span v-else>—</span></dd>
              </dl>
            </div>
          </div>
        </div>

        <div class="col-lg-7">
          <div class="card h-100">
            <div class="card-header">Current Drives</div>
            <div class="list-group list-group-flush">
              <div v-for="d in drives" :key="d.id"
                   class="list-group-item d-flex align-items-center gap-3">
                <div class="flex-grow-1">
                  <div class="fw-semibold">{{ d.job_title }}</div>
                  <div class="text-muted-sm">{{ d.drive_name }} ·
                       {{ fmt.money(d.salary) }} ·
                       closes {{ fmt.date(d.application_deadline) }}</div>
                </div>
                <span v-if="d.applied" class="badge badge-soft bg-success-subtle
                             text-success-emphasis">Applied</span>
                <router-link :to="'/student/drives/'+d.id"
                             class="btn btn-sm btn-outline-primary">View details</router-link>
              </div>
            </div>
            <empty-state v-if="!drives.length" icon="briefcase"
                         text="This organization has no open drives right now." />
          </div>
        </div>
      </div>
    </template>
  </div>`,
};

/* ----------------------------------------------------- application history */
Pages.StudentHistory = {
  data: () => ({ h: null, loading: true }),
  created() { this.load(); },
  methods: {
    async load() {
      try { this.h = await API.get("/api/student/history"); }
      catch (e) { Store.notify(e.message, "danger"); }
      finally { this.loading = false; }
    },
  },
  template: `
  <div class="page">
    <loader v-if="loading" />
    <template v-else-if="h">
      <page-header title="Student Application History"
                   :subtitle="h.profile.full_name + ' · ' + h.profile.branch"
                   back="/student" />

      <div class="row g-3 mb-3">
        <div class="col-6 col-lg-3"><stat-card label="Applications" :value="h.summary.total" /></div>
        <div class="col-6 col-lg-3"><stat-card label="Short listed"
             :value="h.summary.shortlisted" /></div>
        <div class="col-6 col-lg-3"><stat-card label="Selected" :value="h.summary.selected" /></div>
        <div class="col-6 col-lg-3"><stat-card label="Rejected" :value="h.summary.rejected" /></div>
      </div>

      <div class="card">
        <div class="card-header">All applications</div>
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr><th>Drive No.</th><th>Company</th><th>Interview</th><th>Job Title</th>
                  <th>Applied</th><th>Results</th><th>Remark</th></tr>
            </thead>
            <tbody>
              <tr v-for="(a,i) in h.history" :key="a.id">
                <td>{{ i + 1 }}</td>
                <td>{{ a.company_name }}</td>
                <td>{{ a.interview_mode }}</td>
                <td>{{ a.job_title }}</td>
                <td>{{ fmt.date(a.applied_on) }}</td>
                <td><status-badge :status="a.status" /></td>
                <td class="text-muted-sm">{{ a.remark }}</td>
              </tr>
            </tbody>
          </table>
          <empty-state v-if="!h.history.length" icon="clock-history"
                       text="Your placement history is empty for now." />
        </div>
      </div>
    </template>
  </div>`,
};

/* --------------------------------------------------------- student profile */
Pages.StudentProfile = {
  data: () => ({ form: {}, loading: true, busy: false,
                 branches: ["Computer Science", "Information Technology", "Electronics",
                            "Mechanical", "Civil"] }),
  created() { this.load(); },
  methods: {
    async load() {
      try { this.form = { ...(await API.get("/api/student/dashboard")).profile }; }
      catch (e) { Store.notify(e.message, "danger"); }
      finally { this.loading = false; }
    },
    async save() {
      this.busy = true;
      try {
        const r = await API.put("/api/student/profile", this.form);
        Store.notify(r.message);
        Store.state.profile = r.profile;
      } catch (e) { Store.notify(e.message, "danger"); }
      finally { this.busy = false; }
    },
  },
  template: `
  <div class="page page-narrow">
    <page-header title="Edit Profile"
                 subtitle="Companies see these details on your application." back="/student" />
    <loader v-if="loading" />
    <div v-else class="card">
      <div class="card-body p-4">
        <form @submit.prevent="save" class="row g-3">
          <div class="col-md-6">
            <label class="form-label small fw-semibold">Full name</label>
            <input v-model.trim="form.full_name" class="form-control" required>
          </div>
          <div class="col-md-6">
            <label class="form-label small fw-semibold">Roll number</label>
            <input v-model.trim="form.roll_number" class="form-control">
          </div>
          <div class="col-md-6">
            <label class="form-label small fw-semibold">Branch</label>
            <select v-model="form.branch" class="form-select">
              <option v-for="b in branches" :key="b">{{ b }}</option>
            </select>
          </div>
          <div class="col-md-3">
            <label class="form-label small fw-semibold">CGPA</label>
            <input v-model="form.cgpa" type="number" step="0.01" min="0" max="10"
                   class="form-control">
          </div>
          <div class="col-md-3">
            <label class="form-label small fw-semibold">Graduating year</label>
            <input v-model="form.grad_year" type="number" class="form-control">
          </div>
          <div class="col-md-6">
            <label class="form-label small fw-semibold">Phone</label>
            <input v-model.trim="form.phone" class="form-control">
          </div>
          <div class="col-md-6">
            <label class="form-label small fw-semibold">Resume link</label>
            <input v-model.trim="form.resume_url" class="form-control" placeholder="https://...">
          </div>
          <div class="col-12">
            <label class="form-label small fw-semibold">About</label>
            <textarea v-model.trim="form.about" rows="3" class="form-control"></textarea>
          </div>
          <div class="col-12 d-flex justify-content-end">
            <button class="btn btn-primary px-4" :disabled="busy">
              <span v-if="busy" class="spinner-border spinner-border-sm me-1"></span>
              Save changes</button>
          </div>
        </form>
      </div>
    </div>
  </div>`,
};
