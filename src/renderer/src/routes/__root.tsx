import { createRootRoute, Outlet } from "@tanstack/react-router";

import { Tabs } from "@/components/tabs";

export const Route = createRootRoute({
  component: () => (
    <div className="h-screen overflow-hidden flex flex-col">
      <Tabs />
      <Outlet />
    </div>
  ),
});
