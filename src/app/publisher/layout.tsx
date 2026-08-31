import type { Metadata } from "next";
import { PublisherShell } from "@/components/publisher/publisher-shell";

export const metadata: Metadata = {
  title: "HUE Publisher — 今の言葉を、届けたい場所へ",
  description:
    "今伝えたいことから、SNSごとの投稿案をつくるHUE Publisherのライフ型ワークスペースです。",
};

export default function PublisherLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <PublisherShell>{children}</PublisherShell>;
}
