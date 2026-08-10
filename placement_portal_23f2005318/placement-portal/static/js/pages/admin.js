/* Admin (Institute Placement Cell) screens. */
window.Pages = window.Pages || {};

Pages.AdminDashboard = {
  data: () => ({ d: null, loading: true, q: "", results: null, searching: false }),
  created() { this.load(); },
  methods: {
    async load() {
      this.loading = true;
      try { this.d = await API.get("/api/admin/dashboard"); }
      catch (e) { Store.notify(e.message, "danger"); }
      finally { this.loading = false; }
    },
    async search() {
      if (!this.q.trim()) { this.results = null; return; }
      this.searching = true;
      try { this.results = await API.get("/api/admin/search?q=" + encodeURIComponent(this.q)); }
      catch (e) { Store.notify(e.message, "danger"); }
      finally { this.searching = false; }
    },
    clearSearch() { this.q = ""; this.results = null; },
    async act(url, body, confirmText) {
      if (confirmText && !confirm(confirmText)) return;
      try {
        const res = await API.post(url, body);
        Store.notify(res.message);
        await this.load();
        if (this.results) await this.search();
      } catch (e) { Store.notify(e.message, "danger"); }
    },
    approveCompany(c, decision) {
      this.act(`/api/admin/companies/${c.id}/approval`, { decision },
        decision === "rejected" ? `Reject the registration from ${c.name}?` : null);
    },
    blacklistCompany(c) {
      const on = !c.is_blacklisted;
      this.act(`/api/admin/companies/${c.id}/blacklist`, { blacklist: on },
        on ? `Blacklist ${c.name}? All of its pending and open drives will be cancelled.`
           : null);
    },
    blacklistStudent(s) {
      const on = !s.is_blacklisted;
      this.act(`/api/admin/students/${s.id}/blacklist`, { blacklist: on },
        on ? `Blacklist ${s.full_name}? They will not be able to log in or apply.` : null);
    },
    approveDrive(d, decision) {
      this.act(`/api/admin/drives/${d.id}/approval`, { decision },
        decision === "rejected" ? `Reject ${d.drive_name}?` : null);
    },
    closeDrive(d) {
      this.act(`/api/admin/drives/${d.id}/close`, {}, `Mark ${d.drive_name} as complete?`);
    },
  },
  template: `
  <div class="page">
    <page-header title="Welcome, Admin"
                 subtitle="Institute Placement Cell — manage companies, students and drives.">
      <template #actions>
        <router-link to="/admin/reports" class="btn btn-outline-primary btn-sm">
          <i class="bi bi-bar-chart"></i> Reports &amp; statistics
        </router-link>
      </template>
    </page-header>

    <!-- Search -->
    <div class="card mb-3">
      <div class="card-body py-3">
        <form class="d-flex gap-2" @submit.prevent="search">
          <input v-model="q" class="form-control"
                 placeholder="Search students, organizations or drives…">
          <button class="btn btn-primary px-4" :disabled="searching">Search</button>
          <button v-if="results" type="button" class="btn btn-outline-secondary"
                  @click="clearSearch">Clear</button>
        </form>
      </div>
    </div>

    <loader v-if="loading" />

    <!-- Search results -->
    <div v-else-if="results" class="card mb-3">
      <div class="card-header">Search results for “{{ q }}”</div>
      <div class="card-body">
        <h6 class="text-muted-sm">Students ({{ results.students.length }})</h6>
        <div class="table-responsive mb-4">
          <table class="table table-sm align-middle">
            <thead><tr><th>Name</th><th>Roll</th><th>Branch</th><th>CGPA</th><th></th></tr></thead>
            <tbody>
              <tr v-for="s in results.students" :key="s.id">
                <td>{{ s.full_name }}</td><td>{{ s.roll_number }}</td>
                <td>{{ s.branch }}</td><td>{{ s.cgpa }}</td>
                <td class="text-end">
                  <router-link :to="'/admin/students/'+s.id"
                               class="btn btn-sm btn-outline-primary">View</router-link>
                </td>
              </tr>
              <tr v-if="!results.students.length">
                <td colspan="5" class="text-muted-sm">No students matched.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h6 class="text-muted-sm">Organizations ({{ results.companies.length }})</h6>
        <div class="table-responsive">
          <table class="table table-sm align-middle">
            <thead><tr><th>Company</th><th>Industry</th><th>Status</th><th></th></tr></thead>
            <tbody>
              <tr v-for="c in results.companies" :key="c.id">
                <td>{{ c.name }}</td><td>{{ c.industry || '—' }}</td>
                <td><status-badge :status="c.approval_status" /></td>
                <td class="text-end">
                  <router-link :to="'/admin/companies/'+c.id"
                               class="btn btn-sm btn-outline-primary">View</router-link>
                </td>
              </tr>
              <tr v-if="!results.companies.length">
                <td colspan="4" class="text-muted-sm">No organizations matched.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <template v-else-if="d">
      <div class="row g-3 mb-3">
        <div class="col-6 col-lg-3">
          <stat-card label="Registered companies" :value="d.companies.length" icon="building" />
        </div>
        <div class="col-6 col-lg-3">
          <stat-card label="Registered students" :value="d.students.length" icon="mortarboard" />
        </div>
        <div class="col-6 col-lg-3">
          <stat-card label="Ongoing drives" :value="d.ongoing_drives.length" icon="briefcase" />
        </div>
        <div class="col-6 col-lg-3">
          <stat-card label="Awaiting approval"
                     :value="d.pending_companies.length + d.pending_drives.length"
                     icon="hourglass-split" />
        </div>
      </div>

      <div class="row g-3">
        <!-- Registered companies -->
        <div class="col-lg-6">
          <div class="card h-100">
            <div class="card-header">Registered Companies</div>
            <div class="table-responsive">
              <table class="table">
                <thead><tr><th>Company</th><th>Drives</th><th class="text-end">Action</th></tr></thead>
                <tbody>
                  <tr v-for="c in d.companies" :key="c.id">
                    <td>
                      <router-link :to="'/admin/companies/'+c.id" class="plain fw-semibold">
                        {{ c.name }}</router-link>
                      <div class="text-muted-sm">{{ c.location || '—' }}</div>
                    </td>
                    <td>{{ c.drives_count }}</td>
                    <td class="text-end">
                      <button class="btn btn-sm"
                              :class="c.is_blacklisted ? 'btn-outline-success' : 'btn-outline-danger'"
                              @click="blacklistCompany(c)">
                        {{ c.is_blacklisted ? 'Reinstate' : 'Blacklist' }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <empty-state v-if="!d.companies.length" icon="building"
                           text="No approved companies yet." />
            </div>
          </div>
        </div>

        <!-- Registered students -->
        <div class="col-lg-6">
          <div class="card h-100">
            <div class="card-header">Registered Students</div>
            <div class="table-responsive">
              <table class="table">
                <thead><tr><th>Student</th><th>Branch</th><th>CGPA</th>
                           <th class="text-end">Action</th></tr></thead>
                <tbody>
                  <tr v-for="s in d.students" :key="s.id">
                    <td>
                      <router-link :to="'/admin/students/'+s.id" class="plain fw-semibold">
                        {{ s.full_name }}</router-link>
                      <div class="text-muted-sm">{{ s.roll_number }}</div>
                    </td>
                    <td>{{ s.branch }}</td>
                    <td>{{ s.cgpa }}</td>
                    <td class="text-end">
                      <button class="btn btn-sm"
                              :class="s.is_blacklisted ? 'btn-outline-success' : 'btn-outline-danger'"
                              @click="blacklistStudent(s)">
                        {{ s.is_blacklisted ? 'Reinstate' : 'Blacklist' }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <empty-state v-if="!d.students.length" icon="mortarboard"
                           text="No students registered yet." />
            </div>
          </div>
        </div>

        <!-- Company applications -->
        <div class="col-lg-6">
          <div class="card h-100">
            <div class="card-header">Company Applications</div>
            <div class="table-responsive">
              <table class="table">
                <thead><tr><th>Company</th><th>Industry</th>
                           <th class="text-end">Action</th></tr></thead>
                <tbody>
                  <tr v-for="c in d.pending_companies" :key="c.id">
                    <td>
                      <router-link :to="'/admin/companies/'+c.id" class="plain fw-semibold">
                        {{ c.name }}</router-link>
                      <div class="text-muted-sm">{{ c.email }}</div>
                    </td>
                    <td>{{ c.industry || '—' }}</td>
                    <td class="text-end text-nowrap">
                      <button class="btn btn-sm btn-success me-1"
                              @click="approveCompany(c,'approved')">Approve</button>
                      <button class="btn btn-sm btn-outline-danger"
                              @click="approveCompany(c,'rejected')">Reject</button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <empty-state v-if="!d.pending_companies.length" icon="check2-circle"
                           text="No company registrations pending." />
            </div>
          </div>
        </div>

        <!-- Drive approvals -->
        <div class="col-lg-6">
          <div class="card h-100">
            <div class="card-header">Drive Approvals</div>
            <div class="table-responsive">
              <table class="table">
                <thead><tr><th>Drive</th><th>Company</th>
                           <th class="text-end">Action</th></tr></thead>
                <tbody>
                  <tr v-for="dr in d.pending_drives" :key="dr.id">
                    <td>
                      <router-link :to="'/admin/drives/'+dr.id" class="plain fw-semibold">
                        {{ dr.drive_name }}</router-link>
                      <div class="text-muted-sm">{{ dr.job_title }}</div>
                    </td>
                    <td>{{ dr.company_name }}</td>
                    <td class="text-end text-nowrap">
                      <button class="btn btn-sm btn-success me-1"
                              @click="approveDrive(dr,'approved')">Approve</button>
                      <button class="btn btn-sm btn-outline-danger"
                              @click="approveDrive(dr,'rejected')">Reject</button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <empty-state v-if="!d.pending_drives.length" icon="check2-circle"
                           text="No drives pending approval." />
            </div>
          </div>
        </div>

        <!-- Ongoing drives -->
        <div class="col-12">
          <div class="card">
            <div class="card-header">Ongoing Drives</div>
            <div class="table-responsive">
              <table class="table">
                <thead>
                  <tr><th>Sr No.</th><th>Drive Name</th><th>Company</th><th>Role</th>
                      <th>Deadline</th><th>Applicants</th><th class="text-end">Actions</th></tr>
                </thead>
                <tbody>
                  <tr v-for="(dr,i) in d.ongoing_drives" :key="dr.id">
                    <td>{{ 1001 + i }}</td>
                    <td class="fw-semibold">{{ dr.drive_name }}</td>
                    <td>{{ dr.company_name }}</td>
                    <td>{{ dr.job_title }}</td>
                    <td>{{ fmt.date(dr.application_deadline) }}</td>
                    <td>{{ dr.applications_count }}</td>
                    <td class="text-end text-nowrap">
                      <router-link :to="'/admin/drives/'+dr.id"
                                   class="btn btn-sm btn-outline-primary me-1">
                        View details</router-link>
                      <button class="btn btn-sm btn-outline-secondary"
                              @click="closeDrive(dr)">Mark as complete</button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <empty-state v-if="!d.ongoing_drives.length" icon="briefcase"
                           text="No approved drives are currently running." />
            </div>
          </div>
        </div>

        <!-- Student applications -->
        <div class="col-12">
          <div class="card">
            <div class="card-header">Student Applications</div>
            <div class="table-responsive">
              <table class="table">
                <thead>
                  <tr><th>Sr No.</th><th>Name</th><th>Drive</th><th>Company</th>
                      <th>Date</th><th>Status</th><th class="text-end">Action</th></tr>
                </thead>
                <tbody>
                  <tr v-for="(a,i) in d.applications" :key="a.id">
                    <td>{{ i + 1 }}</td>
                    <td class="fw-semibold">{{ a.student_name }}</td>
                    <td>{{ a.drive_name }}</td>
                    <td>{{ a.company_name }}</td>
                    <td>{{ fmt.date(a.applied_on) }}</td>
                    <td><status-badge :status="a.status" /></td>
                    <td class="text-end">
                      <router-link :to="'/admin/students/'+a.student_id"
                                   class="btn btn-sm btn-outline-primary">View</router-link>
                    </td>
                  </tr>
                </tbody>
              </table>
              <empty-state v-if="!d.applications.length" icon="file-earmark-text"
                           text="No applications submitted yet." />
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>`,
};

/* ---------------------------------------------------------------- student */
Pages.AdminStudent = {
  data: () => ({ s: null, apps: [], loading: true }),
  created() { this.load(); },
  methods: {
    async load() {
      try {
        const r = await API.get("/api/admin/students/" + this.$route.params.id);
        this.s = r.student; this.apps = r.applications;
      } catch (e) { Store.notify(e.message, "danger"); }
      finally { this.loading = false; }
    },
    async toggle() {
      const on = !this.s.is_blacklisted;
      if (on && !confirm(`Blacklist ${this.s.full_name}?`)) return;
      const r = await API.post(`/api/admin/students/${this.s.id}/blacklist`, { blacklist: on });
      Store.notify(r.message); this.s = r.student;
    },
  },
  template: `
  <div class="page">
    <loader v-if="loading" />
    <template v-else-if="s">
      <page-header :title="s.full_name" :subtitle="s.roll_number + ' · ' + (s.branch||'—')"
                   back="/admin">
        <template #actions>
          <button class="btn btn-sm"
                  :class="s.is_blacklisted ? 'btn-outline-success' : 'btn-outline-danger'"
                  @click="toggle">
            {{ s.is_blacklisted ? 'Reinstate student' : 'Blacklist student' }}
          </button>
        </template>
      </page-header>

      <div class="row g-3">
        <div class="col-lg-4">
          <div class="card">
            <div class="card-header">Student Profile</div>
            <div class="card-body">
              <dl class="row mb-0 small">
                <dt class="col-5 text-muted">Email</dt><dd class="col-7">{{ s.email }}</dd>
                <dt class="col-5 text-muted">Department</dt><dd class="col-7">{{ s.branch || '—' }}</dd>
                <dt class="col-5 text-muted">CGPA</dt><dd class="col-7">{{ s.cgpa }}</dd>
                <dt class="col-5 text-muted">Graduating</dt><dd class="col-7">{{ s.grad_year || '—' }}</dd>
                <dt class="col-5 text-muted">Phone</dt><dd class="col-7">{{ s.phone || '—' }}</dd>
                <dt class="col-5 text-muted">Status</dt>
                <dd class="col-7">
                  <span class="badge badge-soft"
                        :class="s.is_blacklisted ? 'bg-danger-subtle text-danger-emphasis'
                                                 : 'bg-success-subtle text-success-emphasis'">
                    {{ s.is_blacklisted ? 'Blacklisted' : 'Active' }}</span>
                </dd>
              </dl>
              <a v-if="s.resume_url" :href="s.resume_url" target="_blank"
                 class="btn btn-sm btn-outline-primary w-100 mt-3">
                <i class="bi bi-file-earmark-person"></i> View resume</a>
            </div>
          </div>
        </div>

        <div class="col-lg-8">
          <div class="card">
            <div class="card-header">Placement History</div>
            <div class="table-responsive">
              <table class="table">
                <thead><tr><th>Drive</th><th>Company</th><th>Role</th><th>Applied</th>
                           <th>Result</th><th>Remark</th></tr></thead>
                <tbody>
                  <tr v-for="a in apps" :key="a.id">
                    <td>{{ a.drive_name }}</td>
                    <td>{{ a.company_name }}</td>
                    <td>{{ a.job_title }}</td>
                    <td>{{ fmt.date(a.applied_on) }}</td>
                    <td><status-badge :status="a.status" /></td>
                    <td class="text-muted-sm">{{ a.remark }}</td>
                  </tr>
                </tbody>
              </table>
              <empty-state v-if="!apps.length" text="This student has not applied anywhere yet." />
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>`,
};

/* ---------------------------------------------------------------- company */
Pages.AdminCompany = {
  data: () => ({ c: null, loading: true }),
  created() { this.load(); },
  methods: {
    async load() {
      try { this.c = (await API.get("/api/admin/companies/" + this.$route.params.id)).company; }
      catch (e) { Store.notify(e.message, "danger"); }
      finally { this.loading = false; }
    },
    async decide(decision) {
      const r = await API.post(`/api/admin/companies/${this.c.id}/approval`, { decision });
      Store.notify(r.message); this.load();
    },
    async toggle() {
      const on = !this.c.is_blacklisted;
      if (on && !confirm(`Blacklist ${this.c.name}? Its open drives will be cancelled.`)) return;
      const r = await API.post(`/api/admin/companies/${this.c.id}/blacklist`, { blacklist: on });
      Store.notify(r.message); this.load();
    },
  },
  template: `
  <div class="page">
    <loader v-if="loading" />
    <template v-else-if="c">
      <page-header :title="c.name" :subtitle="(c.industry||'—') + ' · ' + (c.location||'—')"
                   back="/admin">
        <template #actions>
          <template v-if="c.approval_status === 'pending'">
            <button class="btn btn-sm btn-success" @click="decide('approved')">Approve</button>
            <button class="btn btn-sm btn-outline-danger" @click="decide('rejected')">Reject</button>
          </template>
          <button class="btn btn-sm"
                  :class="c.is_blacklisted ? 'btn-outline-success' : 'btn-outline-danger'"
                  @click="toggle">
            {{ c.is_blacklisted ? 'Reinstate' : 'Blacklist' }}</button>
        </template>
      </page-header>

      <div class="row g-3">
        <div class="col-lg-4">
          <div class="card">
            <div class="card-body">
              <div class="d-flex gap-3 align-items-center mb-3">
                <logo-mark :name="c.name" :url="c.logo_url" />
                <div>
                  <div class="fw-semibold">{{ c.name }}</div>
                  <status-badge :status="c.approval_status" />
                </div>
              </div>
              <dl class="row mb-0 small">
                <dt class="col-5 text-muted">HR contact</dt><dd class="col-7">{{ c.hr_contact || '—' }}</dd>
                <dt class="col-5 text-muted">Phone</dt><dd class="col-7">{{ c.hr_phone || '—' }}</dd>
                <dt class="col-5 text-muted">Email</dt><dd class="col-7">{{ c.email }}</dd>
                <dt class="col-5 text-muted">Website</dt>
                <dd class="col-7">
                  <a v-if="c.website" :href="c.website" target="_blank">{{ c.website }}</a>
                  <span v-else>—</span>
                </dd>
              </dl>
              <p v-if="c.overview" class="text-muted-sm mt-3 mb-0">{{ c.overview }}</p>
            </div>
          </div>
        </div>

        <div class="col-lg-8">
          <div class="card">
            <div class="card-header">Placement Drives</div>
            <div class="table-responsive">
              <table class="table">
                <thead><tr><th>Drive</th><th>Role</th><th>Deadline</th><th>Applicants</th>
                           <th>Status</th><th class="text-end"></th></tr></thead>
                <tbody>
                  <tr v-for="d in c.drives" :key="d.id">
                    <td class="fw-semibold">{{ d.drive_name }}</td>
                    <td>{{ d.job_title }}</td>
                    <td>{{ fmt.date(d.application_deadline) }}</td>
                    <td>{{ d.applications_count }}</td>
                    <td><status-badge :status="d.status" /></td>
                    <td class="text-end">
                      <router-link :to="'/admin/drives/'+d.id"
                                   class="btn btn-sm btn-outline-primary">View</router-link>
                    </td>
                  </tr>
                </tbody>
              </table>
              <empty-state v-if="!c.drives.length" text="This company has not created any drives." />
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>`,
};

/* ------------------------------------------------------------------ drive */
Pages.AdminDrive = {
  data: () => ({ d: null, apps: [], loading: true }),
  created() { this.load(); },
  methods: {
    async load() {
      try {
        const r = await API.get("/api/admin/drives/" + this.$route.params.id);
        this.d = r.drive; this.apps = r.applications;
      } catch (e) { Store.notify(e.message, "danger"); }
      finally { this.loading = false; }
    },
    async decide(decision) {
      const r = await API.post(`/api/admin/drives/${this.d.id}/approval`, { decision });
      Store.notify(r.message); this.load();
    },
    async close() {
      const r = await API.post(`/api/admin/drives/${this.d.id}/close`, {});
      Store.notify(r.message); this.load();
    },
  },
  template: `
  <div class="page">
    <loader v-if="loading" />
    <template v-else-if="d">
      <page-header :title="d.drive_name" :subtitle="d.job_title + ' · ' + d.company_name"
                   back="/admin">
        <template #actions>
          <template v-if="d.status === 'pending'">
            <button class="btn btn-sm btn-success" @click="decide('approved')">Approve</button>
            <button class="btn btn-sm btn-outline-danger" @click="decide('rejected')">Reject</button>
          </template>
          <button v-if="d.status === 'approved'" class="btn btn-sm btn-outline-secondary"
                  @click="close">Mark as complete</button>
        </template>
      </page-header>

      <div class="row g-3">
        <div class="col-lg-4">
          <div class="card">
            <div class="card-header">Drive Details</div>
            <div class="card-body">
              <status-badge :status="d.status" class="mb-3 d-inline-block" />
              <dl class="row mb-0 small">
                <dt class="col-5 text-muted">Job title</dt><dd class="col-7">{{ d.job_title }}</dd>
                <dt class="col-5 text-muted">Salary</dt><dd class="col-7">{{ fmt.money(d.salary) }}</dd>
                <dt class="col-5 text-muted">Location</dt><dd class="col-7">{{ d.location || '—' }}</dd>
                <dt class="col-5 text-muted">Openings</dt><dd class="col-7">{{ d.openings }}</dd>
                <dt class="col-5 text-muted">Interview</dt><dd class="col-7">{{ d.interview_mode }}</dd>
                <dt class="col-5 text-muted">Min CGPA</dt><dd class="col-7">{{ d.min_cgpa }}</dd>
                <dt class="col-5 text-muted">Branches</dt>
                <dd class="col-7">{{ fmt.branches(d.eligible_branches) }}</dd>
                <dt class="col-5 text-muted">Batch</dt><dd class="col-7">{{ d.eligible_year || 'Any' }}</dd>
                <dt class="col-5 text-muted">Deadline</dt>
                <dd class="col-7">{{ fmt.date(d.application_deadline) }}</dd>
              </dl>
              <hr>
              <div class="text-muted-sm">{{ d.job_description }}</div>
            </div>
          </div>
        </div>

        <div class="col-lg-8">
          <div class="card">
            <div class="card-header">Applications ({{ apps.length }})</div>
            <div class="table-responsive">
              <table class="table">
                <thead><tr><th>Student</th><th>Branch</th><th>CGPA</th><th>Applied</th>
                           <th>Status</th></tr></thead>
                <tbody>
                  <tr v-for="a in apps" :key="a.id">
                    <td>
                      <router-link :to="'/admin/students/'+a.student_id" class="plain fw-semibold">
                        {{ a.student_name }}</router-link>
                    </td>
                    <td>{{ a.student_branch }}</td>
                    <td>{{ a.student_cgpa }}</td>
                    <td>{{ fmt.date(a.applied_on) }}</td>
                    <td><status-badge :status="a.status" /></td>
                  </tr>
                </tbody>
              </table>
              <empty-state v-if="!apps.length" text="No students have applied to this drive yet." />
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>`,
};

/* ---------------------------------------------------------------- reports */
Pages.AdminReports = {
  data: () => ({ s: null, loading: true, busy: "" }),
  created() { this.load(); },
  methods: {
    async load() {
      try { this.s = await API.get("/api/admin/stats"); }
      catch (e) { Store.notify(e.message, "danger"); }
      finally { this.loading = false; }
    },
    async run(kind) {
      this.busy = kind;
      try {
        const r = await API.post("/api/admin/reports/" + kind, {});
        Store.notify(r.message + " (task " + r.task_id.slice(0, 8) + ")");
      } catch (e) { Store.notify(e.message, "danger"); }
      finally { this.busy = ""; }
    },
    pct(v) { return this.s.total_applications ? (v * 100 / this.s.total_applications) : 0; },
  },
  template: `
  <div class="page">
    <page-header title="Reports &amp; Placement Statistics"
                 subtitle="Live figures, plus manual triggers for the scheduled Celery jobs."
                 back="/admin">
      <template #actions>
        <button class="btn btn-sm btn-outline-primary" :disabled="busy==='reminders'"
                @click="run('reminders')">
          <i class="bi bi-bell"></i> Run daily reminders</button>
        <button class="btn btn-sm btn-primary" :disabled="busy==='monthly'"
                @click="run('monthly')">
          <i class="bi bi-file-earmark-bar-graph"></i> Generate monthly report</button>
      </template>
    </page-header>

    <loader v-if="loading" />
    <template v-else-if="s">
      <div class="row g-3 mb-3">
        <div class="col-6 col-lg-3"><stat-card label="Students placed"
             :value="s.students_placed" icon="person-check" /></div>
        <div class="col-6 col-lg-3"><stat-card label="Placement rate"
             :value="s.placement_rate + '%'" icon="graph-up-arrow" /></div>
        <div class="col-6 col-lg-3"><stat-card label="Highest CTC"
             :value="fmt.money(s.highest_ctc)" icon="cash-stack" /></div>
        <div class="col-6 col-lg-3"><stat-card label="Average CTC"
             :value="fmt.money(s.average_ctc)" icon="calculator" /></div>
        <div class="col-6 col-lg-3"><stat-card label="Total applications"
             :value="s.total_applications" icon="file-earmark-text" /></div>
        <div class="col-6 col-lg-3"><stat-card label="Open drives"
             :value="s.open_drives" icon="briefcase" /></div>
        <div class="col-6 col-lg-3"><stat-card label="Approved companies"
             :value="s.total_companies" icon="building" /></div>
        <div class="col-6 col-lg-3"><stat-card label="Registered students"
             :value="s.total_students" icon="mortarboard" /></div>
      </div>

      <div class="row g-3">
        <div class="col-lg-6">
          <div class="card h-100">
            <div class="card-header">Applications by status</div>
            <div class="card-body">
              <div v-for="(count, key) in s.applications_by_status" :key="key" class="mb-3">
                <div class="d-flex justify-content-between small mb-1">
                  <span class="fw-semibold">{{ fmt.title(key) }}</span>
                  <span class="text-muted">{{ count }}</span>
                </div>
                <div class="progress" style="height:8px">
                  <div class="progress-bar" :style="{width: pct(count) + '%'}"></div>
                </div>
              </div>
              <empty-state v-if="!Object.keys(s.applications_by_status).length"
                           text="No applications recorded." />
            </div>
          </div>
        </div>

        <div class="col-lg-6">
          <div class="card h-100">
            <div class="card-header">Top recruiters</div>
            <div class="table-responsive">
              <table class="table">
                <thead><tr><th>#</th><th>Company</th><th class="text-end">Hires</th></tr></thead>
                <tbody>
                  <tr v-for="(r,i) in s.top_recruiters" :key="r.company">
                    <td>{{ i+1 }}</td><td>{{ r.company }}</td>
                    <td class="text-end fw-semibold">{{ r.hires }}</td>
                  </tr>
                </tbody>
              </table>
              <empty-state v-if="!s.top_recruiters.length" text="No selections recorded yet." />
            </div>
          </div>
        </div>

        <div class="col-12">
          <div class="card">
            <div class="card-header">Students placed by branch</div>
            <div class="table-responsive">
              <table class="table">
                <thead><tr><th>Branch</th><th class="text-end">Students placed</th></tr></thead>
                <tbody>
                  <tr v-for="b in s.placed_by_branch" :key="b.branch">
                    <td>{{ b.branch }}</td><td class="text-end fw-semibold">{{ b.count }}</td>
                  </tr>
                </tbody>
              </table>
              <empty-state v-if="!s.placed_by_branch.length" text="No placements recorded yet." />
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>`,
};
