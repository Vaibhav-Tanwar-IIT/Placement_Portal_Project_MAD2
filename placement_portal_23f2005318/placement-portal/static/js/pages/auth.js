/* Login + Register screens (top of the wireframe). */
window.Pages = window.Pages || {};

Pages.Login = {
  data: () => ({ form: { email: "", password: "" }, error: "", busy: false }),
  methods: {
    async submit() {
      this.error = "";
      this.busy = true;
      try {
        const res = await API.post("/api/auth/login", this.form);
        API.setToken(res.access_token);
        Store.setSession(res);
        Store.notify(`Welcome back, ${res.profile.full_name || res.profile.name || "Admin"}.`);
        this.$router.push(Store.homeFor(res.user.role));
      } catch (e) {
        this.error = e.message;
      } finally {
        this.busy = false;
      }
    },
    fill(email, password) {
      this.form.email = email;
      this.form.password = password;
    },
  },
  template: `
  <div class="auth-wrap">
    <div class="auth-card">
      <div class="text-center mb-4">
        <span class="navbar-brand-mark" style="width:44px;height:44px">PP</span>
        <h4 class="mt-3 mb-1">Institute Placement Portal</h4>
        <div class="text-muted-sm">Sign in to continue</div>
      </div>

      <div class="card">
        <div class="card-body p-4">
          <h5 class="mb-3">Login Form</h5>
          <div v-if="error" class="alert alert-danger py-2 small">{{ error }}</div>
          <form @submit.prevent="submit">
            <div class="mb-3">
              <label class="form-label small fw-semibold">Email</label>
              <input v-model.trim="form.email" type="email" class="form-control" required
                     autocomplete="username" placeholder="you@institute.edu">
            </div>
            <div class="mb-3">
              <label class="form-label small fw-semibold">Password</label>
              <input v-model="form.password" type="password" class="form-control" required
                     autocomplete="current-password" placeholder="••••••••">
            </div>
            <button class="btn btn-primary w-100" :disabled="busy">
              <span v-if="busy" class="spinner-border spinner-border-sm me-1"></span>
              Login
            </button>
          </form>
          <div class="text-center mt-3 small">
            Do not have an account?
            <router-link to="/register" class="plain">Register</router-link>
          </div>
        </div>
      </div>

      <div class="card mt-3">
        <div class="card-body py-3">
          <div class="text-muted-sm mb-2 fw-semibold">Demo accounts</div>
          <div class="d-grid gap-1">
            <button class="btn btn-sm btn-outline-secondary text-start"
                    @click="fill('admin@institute.edu','admin123')">
              Admin · admin@institute.edu</button>
            <button class="btn btn-sm btn-outline-secondary text-start"
                    @click="fill('hr@nexora.com','company123')">
              Company · hr@nexora.com</button>
            <button class="btn btn-sm btn-outline-secondary text-start"
                    @click="fill('cs21b001@institute.edu','student123')">
              Student · cs21b001@institute.edu</button>
          </div>
        </div>
      </div>
    </div>
  </div>`,
};

Pages.Register = {
  data: () => ({
    role: "student",
    busy: false,
    error: "",
    student: {
      email: "", password: "", full_name: "", roll_number: "",
      branch: "Computer Science", cgpa: "", grad_year: new Date().getFullYear(),
      phone: "", resume_url: "",
    },
    company: {
      email: "", password: "", name: "", hr_contact: "", hr_phone: "",
      website: "", location: "", industry: "", overview: "",
    },
    branches: ["Computer Science", "Information Technology", "Electronics",
               "Mechanical", "Civil"],
  }),
  methods: {
    async submit() {
      this.error = "";
      this.busy = true;
      const payload = this.role === "student"
        ? { ...this.student, role: "student" }
        : { ...this.company, role: "company" };
      try {
        const res = await API.post("/api/auth/register", payload);
        Store.notify(res.message);
        this.$router.push("/login");
      } catch (e) {
        this.error = e.message;
      } finally {
        this.busy = false;
      }
    },
  },
  template: `
  <div class="auth-wrap">
    <div class="auth-card" style="max-width:620px">
      <div class="text-center mb-4">
        <span class="navbar-brand-mark" style="width:44px;height:44px">PP</span>
        <h4 class="mt-3 mb-1">Create an account</h4>
        <div class="text-muted-sm">Students and companies can register here</div>
      </div>

      <div class="card">
        <div class="card-body p-4">
          <h5 class="mb-3">Register Form</h5>

          <ul class="nav nav-pills mb-3">
            <li class="nav-item">
              <button class="nav-link" :class="{active: role==='student'}"
                      @click="role='student'">I am a Student</button>
            </li>
            <li class="nav-item">
              <button class="nav-link" :class="{active: role==='company'}"
                      @click="role='company'">I am a Company</button>
            </li>
          </ul>

          <div v-if="error" class="alert alert-danger py-2 small">{{ error }}</div>
          <div v-if="role==='company'" class="alert alert-info py-2 small">
            Company profiles are reviewed by the placement cell before drives can be created.
          </div>

          <form @submit.prevent="submit">
            <!-- Student -->
            <div v-if="role==='student'" class="row g-3">
              <div class="col-md-6">
                <label class="form-label small fw-semibold">Full name</label>
                <input v-model.trim="student.full_name" class="form-control" required>
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-semibold">Roll number</label>
                <input v-model.trim="student.roll_number" class="form-control" required>
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-semibold">Email</label>
                <input v-model.trim="student.email" type="email" class="form-control" required>
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-semibold">Password</label>
                <input v-model="student.password" type="password" class="form-control"
                       minlength="6" required>
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-semibold">Branch</label>
                <select v-model="student.branch" class="form-select">
                  <option v-for="b in branches" :key="b">{{ b }}</option>
                </select>
              </div>
              <div class="col-md-3">
                <label class="form-label small fw-semibold">CGPA</label>
                <input v-model="student.cgpa" type="number" step="0.01" min="0" max="10"
                       class="form-control" required>
              </div>
              <div class="col-md-3">
                <label class="form-label small fw-semibold">Graduating year</label>
                <input v-model="student.grad_year" type="number" class="form-control" required>
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-semibold">Phone</label>
                <input v-model.trim="student.phone" class="form-control">
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-semibold">Resume link</label>
                <input v-model.trim="student.resume_url" class="form-control"
                       placeholder="https://...">
              </div>
            </div>

            <!-- Company -->
            <div v-else class="row g-3">
              <div class="col-md-6">
                <label class="form-label small fw-semibold">Company name</label>
                <input v-model.trim="company.name" class="form-control" required>
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-semibold">Industry</label>
                <input v-model.trim="company.industry" class="form-control">
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-semibold">Login email</label>
                <input v-model.trim="company.email" type="email" class="form-control" required>
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-semibold">Password</label>
                <input v-model="company.password" type="password" class="form-control"
                       minlength="6" required>
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-semibold">HR contact person</label>
                <input v-model.trim="company.hr_contact" class="form-control" required>
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-semibold">HR phone</label>
                <input v-model.trim="company.hr_phone" class="form-control">
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-semibold">Website</label>
                <input v-model.trim="company.website" class="form-control"
                       placeholder="https://...">
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-semibold">Location</label>
                <input v-model.trim="company.location" class="form-control">
              </div>
              <div class="col-12">
                <label class="form-label small fw-semibold">Company overview</label>
                <textarea v-model.trim="company.overview" rows="3" class="form-control"></textarea>
              </div>
            </div>

            <button class="btn btn-primary w-100 mt-4" :disabled="busy">
              <span v-if="busy" class="spinner-border spinner-border-sm me-1"></span>
              Register
            </button>
          </form>

          <div class="text-center mt-3 small">
            Already have an account?
            <router-link to="/login" class="plain">Login</router-link>
          </div>
        </div>
      </div>
    </div>
  </div>`,
};
