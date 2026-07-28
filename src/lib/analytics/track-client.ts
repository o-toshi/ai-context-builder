"use client";

import { track } from "@vercel/analytics/react";
import { ANALYTICS_EVENTS } from "./events";

/** オンボーディング送信（開始数） */
export function trackFlowStart(): void {
  track(ANALYTICS_EVENTS.flowStart);
}
