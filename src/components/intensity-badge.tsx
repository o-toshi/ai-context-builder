import { cn } from "@/lib/utils";
import type { Intensity } from "@/types/executable-context";

const LABEL: Record<Intensity, string> = {
  MUST: "MUST（鉄則、必須）",
  SHOULD: "SHOULD（原則、外すときは理由）",
  MAY: "MAY（方針の目安、遵守は緩め）",
};

const CLASS: Record<Intensity, string> = {
  MUST: "badge-must",
  SHOULD: "badge-should",
  MAY: "badge-may",
};

export function IntensityBadge({
  intensity,
  className,
}: {
  intensity: Intensity;
  className?: string;
}) {
  return (
    <span className={cn("badge", CLASS[intensity], className)}>
      {LABEL[intensity]}
    </span>
  );
}
