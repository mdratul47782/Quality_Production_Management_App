"use client";

import FloorDashboardBase from "./FloorDashboardBase";

export default function FloorDashBoardFullView() {
  // Full view: normal refresh
  return <FloorDashboardBase forcedView="grid" refreshMs={10000} />;
}
