/* Hash-based routing with per-route role guards. */
const routes = [
  { path: "/", redirect: () => Store.homeFor(Store.state.user && Store.state.user.role) },

  { path: "/login", component: Pages.Login, meta: { guest: true } },
  { path: "/register", component: Pages.Register, meta: { guest: true } },

  // Admin
  { path: "/admin", component: Pages.AdminDashboard, meta: { role: "admin" } },
  { path: "/admin/students/:id", component: Pages.AdminStudent, meta: { role: "admin" } },
  { path: "/admin/companies/:id", component: Pages.AdminCompany, meta: { role: "admin" } },
  { path: "/admin/drives/:id", component: Pages.AdminDrive, meta: { role: "admin" } },
  { path: "/admin/reports", component: Pages.AdminReports, meta: { role: "admin" } },

  // Company
  { path: "/company", component: Pages.CompanyDashboard, meta: { role: "company" } },
  { path: "/company/profile", component: Pages.CompanyProfile, meta: { role: "company" } },
  { path: "/company/drives/new", component: Pages.CompanyDriveForm, meta: { role: "company" } },
  { path: "/company/drives/:id", component: Pages.CompanyDrive, meta: { role: "company" } },
  { path: "/company/drives/:id/edit", component: Pages.CompanyDriveForm, meta: { role: "company" } },
  { path: "/company/applications/:id", component: Pages.CompanyApplication, meta: { role: "company" } },

  // Student
  { path: "/student", component: Pages.StudentDashboard, meta: { role: "student" } },
  { path: "/student/profile", component: Pages.StudentProfile, meta: { role: "student" } },
  { path: "/student/drives", component: Pages.StudentDrives, meta: { role: "student" } },
  { path: "/student/drives/:id", component: Pages.StudentDrive, meta: { role: "student" } },
  { path: "/student/organizations/:id", component: Pages.StudentOrganization, meta: { role: "student" } },
  { path: "/student/history", component: Pages.StudentHistory, meta: { role: "student" } },

  { path: "/:pathMatch(.*)*", redirect: "/" },
];

window.router = VueRouter.createRouter({
  history: VueRouter.createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach(async (to) => {
  if (!Store.state.ready) await Store.bootstrap();
  const user = Store.state.user;

  if (to.meta.role) {
    if (!user) return { path: "/login" };
    if (user.role !== to.meta.role) return { path: Store.homeFor(user.role) };
  }
  if (to.meta.guest && user) return { path: Store.homeFor(user.role) };
  return true;
});
