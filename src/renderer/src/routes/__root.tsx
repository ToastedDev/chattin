import { createRootRoute, Outlet } from "@tanstack/react-router";

import { Header } from "@/components/header";

export const Route = createRootRoute({
  component: () => (
    <div className="h-screen overflow-hidden flex flex-col">
      <Header />
      <Outlet />
    </div>
  ),
});
