import ClubPage from "@/pages/ClubPage";
import DashboardPage from "@/pages/DashboardPage";
import FacilitiesPage from "@/pages/FacilitiesPage";
import HomePage from "@/pages/HomePage";
import InterclubPage from "@/pages/InterclubPage";
import QuickMatchPage from "@/pages/QuickMatchPage";
import TournamentsPage from "@/pages/TournamentsPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminTournaments from "./pages/admin/AdminTournaments";
import AdminCpuTeams from "./pages/admin/AdminCpuTeams";
import AdminInterclub from "./pages/admin/AdminInterclub";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminLogs from "./pages/admin/AdminLogs";
import EquipmentManagement from "./pages/admin/EquipmentManagement";

const routes = [
    {
        key: "home",
        layout: "",
        path: "",
        component: <HomePage />
    },
    {
        key: "dashboard",
        layout: "",
        path: "dashboard",
        component: <DashboardPage />
    },
    {
        key: "club",
        layout: "",
        path: "club",
        component: <ClubPage />
    },
    {
        key: "tournaments",
        layout: "",
        path: "tournaments",
        component: <TournamentsPage />
    },
    {
        key: "quick-match",
        layout: "",
        path: "quick-match",
        component: <QuickMatchPage />
    },
    {
        key: "interclub",
        layout: "",
        path: "interclub",
        component: <InterclubPage />
    },
    {
        key: "facilities",
        layout: "",
        path: "facilities",
        component: <FacilitiesPage />
    },
    {
        key: "admin_dashboard",
        layout: "",
        path: "admin/dashboard",
        component: <AdminDashboard />
    },
    {
        key: "admin_tournaments",
        layout: "",
        path: "admin/tournaments",
        component: <AdminTournaments/>
    },
    {
        key: "admin_interclub",
        layout: "",
        path: "admin/interclub",
        component: <AdminInterclub/>
    },
    {
        key: "admin_cputeams",
        layout: "",
        path: "admin/cpuTeams",
        component: <AdminCpuTeams/>
    },
    {
        key: "admin_users",
        layout: "",
        path: "admin/users",
        component: <AdminUsers/>
    },
    {
        key: "admin_logs",
        layout: "",
        path: "admin/logs",
        component: <AdminLogs/>
    },
    {
        key: "equipment_management",
        layout: "",
        path: "admin/equipments-management",
        component: <EquipmentManagement/>
    },
];

export default routes;