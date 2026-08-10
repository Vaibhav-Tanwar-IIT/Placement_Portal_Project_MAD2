/* Company screens. */
window.Pages = window.Pages || {};

Pages.CompanyDashboard = {
  data: () => ({ d: null, loading: true }),
  created() { this.load(); },
  methods: {
    async load() {
      this.loading = true;
      try { this.d = await API.get("/api/company/dashboard"); }
      catch (e) { Store.notify(e.message, "danger"); }
      finally { this.loading = false; }
    },
    async close(dr) {
      if (!confirm(`Mark ${dr.drive_name} as complete?`)) return;
      try {
        const r = await API.post(`/api/company/drives/${dr.id}/close`, {});
        Store.notify(r.message); this.load();
      } catch (e) { Store.notify(e.message, "danger"); }
    },
    async reopen(dr) {
      try {
        const r = await API.post(`/api/company/drives/${dr.id}/reopen`, {});
        Store.notify(r.message); this.load();
      } catch (e) { Store.notify(e.message, "danger"); }
    },
  },
  template: `
  <div class="page">
    <loader v-if="loading" />
    <template v-else-if="d">
      <page-header :title="'Welcome, ' + d.company.name"
                   :subtitle="(d.company.industry||'—') + ' · ' + (d.company.location||'—')">
        <template #actions>
          <router-link to="/company/profile" class="btn btn-sm btn-outline-secondary">
            <i class="bi bi-pencil"></i> Edit profile</router-link>
          <router-link to="/company/drives/new" class="btn btn-sm btn-primary"
                       v-if="d.company.approval_status === 'approved'">
            <i class="bi bi-plus-lg"></i> Create Drive</router-link>
        </template>
      </page-header>

      <div v-if="d.company.approval_status === 'pending'"
           class="alert alert-warning d-flex align-items-center gap-2">
        <i class="bi bi-hourglass-split"></i>
        <div>Your company profile is awaiting approval from the placement cell.
             You can create drives once it is approved.</div>
      </div>
      <div v-else-if="d.company.approval_status === 'rejected'" class="alert alert-danger">
        Your company registration was rejected by the placement cell.
      </div>

      <div class="row g-3 mb-3">
        <div class="col-6 col-lg-3">
          <stat-card label="Open drives" :value="d.upcoming_drives.length" icon="briefcase" /></div>
        <div class="col-6 col-lg-3">
          <stat-card label="Completed drives" :value="d.closed_drives.length" icon="check2-square" /></div>
        <div class="col-6 col-lg-3">
          <stat-card label="Total applications" :value="d.total_applications" icon="people" /></div>
        <div class="col-6 col-lg-3">
          <stat-card label="Approval status"
                     :value="fmt.title(d.company.approval_status)" icon="patch-check" /></div>
      </div>

      <div class="card mb-3">
        <div class="card-header">Upcoming Drives</div>
        <div class="table-responsive">
          <table class="table">
            <thead><tr><th>Sr No.</th><th>Drive Name</th><th>Role</th><th>Deadline</th>
                       <th>Applicants</th><th>Status</th><th class="text-end">Actions</th></tr></thead>
            <tbody>
              <tr v-for="(dr,i) in d.upcoming_drives" :key="dr.id">
                <td>{{ 1001 + i }}</td>
                <td class="fw-semibold">{{ dr.drive_name }}</td>
                <td>{{ dr.job_title }}</td>
                <td>{{ fmt.date(dr.application_deadline) }}</td>
                <td>{{ dr.applications_count }}</td>
                <td><status-badge :status="dr.status" /></td>
                <td class="text-end text-nowrap">
                  <router-link :to="'/company/drives/'+dr.id"
                               class="btn btn-sm btn-outline-primary me-1">View details</router-link>
                  <button class="btn btn-sm btn-outline-secondary" @click="close(dr)">
                    Mark as complete</button>
                </td>
              </tr>
            </tbody>
          </table>
          <empty-state v-if="!d.upcoming_drives.length" icon="briefcase"
                       text="No active drives. Create one to start recruiting." />
        </div>
      </div>

      <div class="card mb-3">
        <div class="card-header">Closed Drives</div>
        <div class="table-responsive">
          <table class="table">
            <thead><tr><th>Sr No.</th><th>Drive Name</th><th>Role</th><th>Applicants</th>
                       <th class="text-end">Actions</th></tr></thead>
            <tbody>
              <tr v-for="(dr,i) in d.closed_drives" :key="dr.id">
                <td>{{ 1011 + i }}</td>
                <td class="fw-semibold">{{ dr.drive_name }}</td>
                <td>{{ dr.job_title }}</td>
                <td>{{ dr.applications_count }}</td>
                <td class="text-end text-nowrap">
                  <router-link :to="'/company/drives/'+dr.id"
                               class="btn btn-sm btn-outline-primary me-1">View details</router-link>
                  <button class="btn btn-sm btn-outline-secondary" @click="reopen(dr)">
                    Reopen</button>
                </td>
              </tr>
            </tbody>
          </table>
          <empty-state v-if="!d.closed_drives.length" text="No completed drives yet." />
        </div>
      </div>

      <div class="card" v-if="d.rejected_drives.length">
        <div class="card-header">Rejected Drives</div>
        <div class="table-responsive">
          <table class="table">
            <thead><tr><th>Drive Name</th><th>Role</th><th>Status</th></tr></thead>
            <tbody>
              <tr v-for="dr in d.rejected_drives" :key="dr.id">
                <td class="fw-semibold">{{ dr.drive_name }}</td>
                <td>{{ dr.job_title }}</td>
                <td><status-badge :status="dr.status" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>`,
};

/* ------------------------------------------------------- create/edit drive */
Pages.CompanyDriveForm = {
  data() {
    return {
      editing: !!this.$route.params.id,
      busy: false, error: "", loading: false,
      branches: ["Computer Science", "Information Technology", "Electronics",
                 "Mechanical", "Civil"],
      selected: [],
      form: {
        drive_name: "", job_title: "", job_description: "", min_cgpa: 0,
        eligible_year: new Date().getFullYear(), salary: "", location: "",
        openings: 1, interview_mode: "In-person", application_deadline: "",
      },
    };
  },
  created() { if (this.editing) this.load(); },
  methods: {
    async load() {
      this.loading = true;
      try {
        const r = await API.get("/api/company/drives/" + this.$route.params.id);
        Object.keys(this.form).forEach((k) => { if (r.drive[k] != null) this.form[k] = r.drive[k]; });
        this.selected = r.drive.branch_list || [];
      } catch (e) { Store.notify(e.message, "danger"); }
      finally { this.loading = false; }
    },
    async submit() {
      this.error = ""; this.busy = true;
      const payload = { ...this.form, eligible_branches: this.selected.join(",") };
      try {
        const r = this.editing
          ? await API.put("/api/company/drives/" + this.$route.params.id, payload)
          : await API.post("/api/company/drives", payload);
        Store.notify(r.message);
        this.$router.push("/company");
      } catch (e) { this.error = e.message; }
      finally { this.busy = false; }
    },
  },
  template: `
  <div class="page page-narrow">
    <page-header :title="editing ? 'Update Drive' : 'Create a Drive'"
                 subtitle="The placement cell reviews every drive before students can see it."
                 back="/company" />
    <loader v-if="loading" />
    <div v-else class="card">
      <div class="card-body p-4">
        <div v-if="error" class="alert alert-danger py-2 small">{{ error }}</div>
        <form @submit.prevent="submit" class="row g-3">
          <div class="col-md-6">
            <label class="form-label small fw-semibold">Drive Name</label>
            <input v-model.trim="form.drive_name" class="form-control" required
                   placeholder="e.g. Drive 1 — Summer 2026">
          </div>
          <div class="col-md-6">
            <label class="form-label small fw-semibold">Job Title</label>
            <input v-model.trim="form.job_title" class="form-control" required
                   placeholder="e.g. Data Scientist">
          </div>
          <div class="col-12">
            <label class="form-label small fw-semibold">Job Description</label>
            <textarea v-model.trim="form.job_description" rows="4" class="form-control"
                      placeholder="Responsibilities, tech stack, team…"></textarea>
          </div>

          <div class="col-12">
            <label class="form-label small fw-semibold">Eligibility Criteria — branches</label>
            <div class="d-flex flex-wrap gap-3">
              <div v-for="b in branches" :key="b" class="form-check">
                <input class="form-check-input" type="checkbox" :value="b"
                       v-model="selected" :id="'br-'+b">
                <label class="form-check-label small" :for="'br-'+b">{{ b }}</label>
              </div>
            </div>
            <div class="form-text">Leave all unchecked to open the drive to every branch.</div>
          </div>

          <div class="col-md-4">
            <label class="form-label small fw-semibold">Minimum CGPA</label>
            <input v-model="form.min_cgpa" type="number" step="0.1" min="0" max="10"
                   class="form-control">
          </div>
          <div class="col-md-4">
            <label class="form-label small fw-semibold">Graduating year</label>
            <input v-model="form.eligible_year" type="number" class="form-control">
          </div>
          <div class="col-md-4">
            <label class="form-label small fw-semibold">Application Deadline</label>
            <input v-model="form.application_deadline" type="date" class="form-control" required>
          </div>

          <div class="col-md-4">
            <label class="form-label small fw-semibold">Annual CTC (₹)</label>
            <input v-model="form.salary" type="number" min="0" class="form-control">
          </div>
          <div class="col-md-4">
            <label class="form-label small fw-semibold">Openings</label>
            <input v-model="form.openings" type="number" min="1" class="form-control">
          </div>
          <div class="col-md-4">
            <label class="form-label small fw-semibold">Interview mode</label>
            <select v-model="form.interview_mode" class="form-select">
              <option>In-person</option><option>Online</option><option>Hybrid</option>
            </select>
          </div>
          <div class="col-12">
            <label class="form-label small fw-semibold">Location</label>
            <input v-model.trim="form.location" class="form-control" placeholder="e.g. Chennai">
          </div>

          <div class="col-12 d-flex justify-content-end gap-2 mt-4">
            <router-link to="/company" class="btn btn-outline-secondary">Cancel</router-link>
            <button class="btn btn-primary px-4" :disabled="busy">
              <span v-if="busy" class="spinner-border spinner-border-sm me-1"></span>Save</button>
          </div>
        </form>
      </div>
    </div>
  </div>`,
};

/* -------------------------------------- drive detail + application reviews */
Pages.CompanyDrive = {
  data: () => ({ d: null, apps: [], loading: true, saving: false, filter: "all" }),
  created() { this.load(); },
  computed: {
    visible() {
      return this.filter === "all"
        ? this.apps : this.apps.filter((a) => a.status === this.filter);
    },
  },
  methods: {
    async load() {
      this.loading = true;
      try {
        const r = await API.get("/api/company/drives/" + this.$route.params.id);
        this.d = r.drive; this.apps = r.applications;
      } catch (e) { Store.notify(e.message, "danger"); }
      finally { this.loading = false; }
    },
    async saveAll() {
      this.saving = true;
      try {
        const r = await API.put("/api/company/applications/bulk", {
          items: this.apps.map((a) => ({ id: a.id, status: a.status, remark: a.remark })),
        });
        Store.notify(r.message);
      } catch (e) { Store.notify(e.message, "danger"); }
      finally { this.saving = false; }
    },
  },
  template: `
  <div class="page">
    <loader v-if="loading" />
    <template v-else-if="d">
      <page-header :title="'Applications — ' + d.drive_name"
                   :subtitle="'Job Title: ' + d.job_title" back="/company">
        <template #actions>
          <router-link v-if="d.status !== 'closed'"
                       :to="'/company/drives/'+d.id+'/edit'"
                       class="btn btn-sm btn-outline-secondary">
            <i class="bi bi-pencil"></i> Edit drive</router-link>
          <button class="btn btn-sm btn-primary" :disabled="saving || !apps.length"
                  @click="saveAll">
            <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>Save</button>
        </template>
      </page-header>

      <div class="row g-3 mb-3">
        <div class="col-6 col-lg-3"><stat-card label="Applications" :value="apps.length" /></div>
        <div class="col-6 col-lg-3"><stat-card label="Shortlisted"
             :value="apps.filter(a=>a.status==='shortlisted').length" /></div>
        <div class="col-6 col-lg-3"><stat-card label="Selected"
             :value="apps.filter(a=>a.status==='selected').length" /></div>
        <div class="col-6 col-lg-3"><stat-card label="Openings" :value="d.openings" /></div>
      </div>

      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
          <span>Received Applications</span>
          <select v-model="filter" class="form-select form-select-sm" style="width:auto">
            <option value="all">All statuses</option>
            <option value="applied">Applied</option>
            <option value="shortlisted">Short listed</option>
            <option value="waiting">Waiting</option>
            <option value="selected">Selected</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div class="table-responsive">
          <table class="table">
            <thead><tr><th>Student</th><th>Branch</th><th>CGPA</th><th>Applied</th>
                       <th style="width:160px">Status</th><th>Remark</th>
                       <th class="text-end"></th></tr></thead>
            <tbody>
              <tr v-for="a in visible" :key="a.id">
                <td>
                  <div class="fw-semibold">{{ a.student_name }}</div>
                  <div class="text-muted-sm">{{ a.student_email }}</div>
                </td>
                <td>{{ a.student_branch }}</td>
                <td>{{ a.student_cgpa }}</td>
                <td>{{ fmt.date(a.applied_on) }}</td>
                <td>
                  <select v-model="a.status" class="form-select form-select-sm">
                    <option value="applied">Applied</option>
                    <option value="shortlisted">Shortlist</option>
                    <option value="waiting">Waiting</option>
                    <option value="selected">Select</option>
                    <option value="rejected">Reject</option>
                  </select>
                </td>
                <td><input v-model="a.remark" class="form-control form-control-sm"
                           placeholder="Remark"></td>
                <td class="text-end">
                  <router-link :to="'/company/applications/'+a.id"
                               class="btn btn-sm btn-outline-primary">Review</router-link>
                </td>
              </tr>
            </tbody>
          </table>
          <empty-state v-if="!visible.length" icon="people"
                       text="No applications match this filter." />
        </div>
      </div>
    </template>
  </div>`,
};

/* --------------------------------------------- single application review */
Pages.CompanyApplication = {
  data: () => ({ a: null, loading: true, busy: false,
                 form: { status: "", remark: "", interview_datetime: "" } }),
  created() { this.load(); },
  methods: {
    async load() {
      try {
        const r = await API.get("/api/company/applications/" + this.$route.params.id);
        this.a = r.application;
        this.form.status = r.application.status;
        this.form.remark = r.application.remark === "None" ? "" : r.application.remark;
        this.form.interview_datetime = r.application.interview_datetime
          ? r.application.interview_datetime.slice(0, 16) : "";
      } catch (e) { Store.notify(e.message, "danger"); }
      finally { this.loading = false; }
    },
    async save() {
      this.busy = true;
      try {
        const r = await API.put("/api/company/applications/" + this.a.id, this.form);
        Store.notify(r.message);
        this.$router.push("/company/drives/" + this.a.drive_id);
      } catch (e) { Store.notify(e.message, "danger"); }
      finally { this.busy = false; }
    },
  },
  template: `
  <div class="page page-narrow">
    <loader v-if="loading" />
    <template v-else-if="a">
      <page-header title="Student Application"
                   :subtitle="a.drive_name + ' · ' + a.job_title"
                   :back="'/company/drives/'+a.drive_id" />
      <div class="card">
        <div class="card-body p-4">
          <div class="d-flex align-items-center gap-3 mb-4">
            <logo-mark :name="a.student_name" />
            <div>
              <div class="h5 mb-0">{{ a.student_name }}</div>
              <div class="text-muted-sm">{{ a.student_email }}</div>
            </div>
            <status-badge :status="a.status" class="ms-auto" />
          </div>

          <dl class="row small">
            <dt class="col-sm-4 text-muted">Department</dt>
            <dd class="col-sm-8">{{ a.student_branch }}</dd>
            <dt class="col-sm-4 text-muted">CGPA</dt><dd class="col-sm-8">{{ a.student_cgpa }}</dd>
            <dt class="col-sm-4 text-muted">Drive</dt><dd class="col-sm-8">{{ a.drive_name }}</dd>
            <dt class="col-sm-4 text-muted">Job Title</dt><dd class="col-sm-8">{{ a.job_title }}</dd>
            <dt class="col-sm-4 text-muted">Interview mode</dt>
            <dd class="col-sm-8">{{ a.interview_mode }}</dd>
            <dt class="col-sm-4 text-muted">Applied on</dt>
            <dd class="col-sm-8">{{ fmt.date(a.applied_on) }}</dd>
          </dl>

          <a v-if="a.resume_url" :href="a.resume_url" target="_blank"
             class="btn btn-sm btn-outline-primary mb-4">
            <i class="bi bi-file-earmark-person"></i> View resume</a>
          <div v-else class="text-muted-sm mb-4">No resume on file.</div>

          <hr>
          <form @submit.prevent="save" class="row g-3">
            <div class="col-md-6">
              <label class="form-label small fw-semibold">Decision</label>
              <select v-model="form.status" class="form-select">
                <option value="applied">Applied</option>
                <option value="shortlisted">Shortlist</option>
                <option value="waiting">Waiting</option>
                <option value="selected">Select</option>
                <option value="rejected">Reject</option>
              </select>
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-semibold">Interview schedule</label>
              <input v-model="form.interview_datetime" type="datetime-local" class="form-control">
            </div>
            <div class="col-12">
              <label class="form-label small fw-semibold">Remark</label>
              <textarea v-model="form.remark" rows="2" class="form-control"
                        placeholder="Visible to the student on their history page"></textarea>
            </div>
            <div class="col-12 d-flex justify-content-end gap-2">
              <router-link :to="'/company/drives/'+a.drive_id"
                           class="btn btn-outline-secondary">Back</router-link>
              <button class="btn btn-primary px-4" :disabled="busy">
                <span v-if="busy" class="spinner-border spinner-border-sm me-1"></span>
                Save</button>
            </div>
          </form>
        </div>
      </div>
    </template>
  </div>`,
};

/* -------------------------------------------------------- company profile */
Pages.CompanyProfile = {
  data: () => ({ form: {}, loading: true, busy: false }),
  created() { this.load(); },
  methods: {
    async load() {
      try { this.form = { ...(await API.get("/api/company/dashboard")).company }; }
      catch (e) { Store.notify(e.message, "danger"); }
      finally { this.loading = false; }
    },
    async save() {
      this.busy = true;
      try {
        const r = await API.put("/api/company/profile", this.form);
        Store.notify(r.message);
        Store.state.profile = r.company;
      } catch (e) { Store.notify(e.message, "danger"); }
      finally { this.busy = false; }
    },
  },
  template: `
  <div class="page page-narrow">
    <page-header title="Company Profile" subtitle="Students see this on your overview page."
                 back="/company" />
    <loader v-if="loading" />
    <div v-else class="card">
      <div class="card-body p-4">
        <form @submit.prevent="save" class="row g-3">
          <div class="col-md-6">
            <label class="form-label small fw-semibold">Company name</label>
            <input v-model.trim="form.name" class="form-control" required>
          </div>
          <div class="col-md-6">
            <label class="form-label small fw-semibold">Industry</label>
            <input v-model.trim="form.industry" class="form-control">
          </div>
          <div class="col-md-6">
            <label class="form-label small fw-semibold">HR contact</label>
            <input v-model.trim="form.hr_contact" class="form-control">
          </div>
          <div class="col-md-6">
            <label class="form-label small fw-semibold">HR phone</label>
            <input v-model.trim="form.hr_phone" class="form-control">
          </div>
          <div class="col-md-6">
            <label class="form-label small fw-semibold">Website</label>
            <input v-model.trim="form.website" class="form-control">
          </div>
          <div class="col-md-6">
            <label class="form-label small fw-semibold">Location</label>
            <input v-model.trim="form.location" class="form-control">
          </div>
          <div class="col-12">
            <label class="form-label small fw-semibold">Logo URL</label>
            <input v-model.trim="form.logo_url" class="form-control" placeholder="https://...">
          </div>
          <div class="col-12">
            <label class="form-label small fw-semibold">Overview</label>
            <textarea v-model.trim="form.overview" rows="4" class="form-control"></textarea>
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
