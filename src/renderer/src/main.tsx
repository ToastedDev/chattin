import "./main.css";

import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import React from "react";
import ReactDOM from "react-dom/client";

import { routeTree } from "./routeTree.gen";

const memoryHistory = createMemoryHistory({
  initialEntries: ["/"], // Pass your initial url
});

const router = createRouter({ routeTree, history: memoryHistory });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
