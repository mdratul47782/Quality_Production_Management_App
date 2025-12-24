"use client";

import FloorDashboardBase from "./FloorDashboardBase";

export default function FloorDashBoardTvView() {
  // TV: slower refresh to reduce pressure
  return <FloorDashboardBase forcedView="tv" refreshMs={15000} />;
}
