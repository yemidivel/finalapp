import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { DashboardPage } from "./pages/DashboardPage";
import { InventoryPage } from "./pages/InventoryPage";
import { ProductsPage } from "./pages/ProductsPage";
import { TransactionsPage } from "./pages/TransactionsPage";
import { InsightsPage } from "./pages/InsightsPage";
import { ForecastsPage } from "./pages/ForecastsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import SettingsPage from "./pages/SettingsPage";
import { PosPage } from "./pages/PosPage";
import { StoresPage } from "./pages/StoresPage";
import { TeamPage } from "./pages/TeamPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: DashboardPage },
      { path: "stores", Component: StoresPage },
      { path: "team", Component: TeamPage },
      { path: "inventory", Component: InventoryPage },
      { path: "products", Component: ProductsPage },
      { path: "transactions", Component: TransactionsPage },
      { path: "pos", Component: PosPage },
      { path: "insights", Component: InsightsPage },
      { path: "forecasts", Component: ForecastsPage },
      { path: "reports", Component: ReportsPage },
      { path: "notifications", Component: NotificationsPage },
      { path: "settings", Component: SettingsPage },
    ],
  },
]);
