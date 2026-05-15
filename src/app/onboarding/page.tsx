"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useBuilderStore } from "@/store/builder-store";

const ROLE_PRESETS = [
  "フリーランスエンジニア",
  "フリーランスデザイナー",
  "フリーランスライター",
  "コンサルタント",
  "経営者 / 代表",
  "個人事業主",
];

const TEAM_PRESETS = [
  "1人（自分のみ）",
  "2〜5人",
  "6〜20人",
  "21人以上",
];

export default function OnboardingPage() {
  const router = useRouter();
  const setProfile = useBuilderStore((s) => s.setProfile);
  const markCompleted = useBuilderStore((s) => s.markCompleted);
  const goTo = useBuilderStore((s) => s.goTo);
  const profile = useBuilderStore((s) => s.input.profile);

  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [role, setRole] = useState(profile.role ?? "");
  const [industry, setIndustry] = useState(profile.industry ?? "");
  const [teamSize, setTeamSize] = useState(profile.teamSize ?? "");

  const canSubmit = role.trim() && industry.trim() && teamSize.trim();

  const handleNext = () => {
    setProfile({ displayName, role, industry, teamSize });
    markCompleted("onboarding");
    goTo("personality");
    router.push("/builder/personality");
  };

  return (
    <WorkspaceShell
      current="onboarding"
      title="まずあなたの基本文脈を教えてください"
      subtitle="AI が『あなたとして』振る舞うために、業務の前提となる役割・業界・規模を設定します。"
    >
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>基本プロフィール</CardTitle>
            <CardDescription>すべての項目は後から編集できます。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-5">
              <Field label="呼び方（任意）" hint="出力される指示書の冒頭に使われます">
                <input
                  className="input"
                  placeholder="例: 健太、社長、Howard …"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </Field>

              <Field
                label="役割 / 肩書き"
                hint="フリーランス・経営者・個人事業主など、最も近いもの"
                required
              >
                <input
                  className="input"
                  placeholder="例: フリーランスデザイナー"
                  list="role-presets"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                />
                <datalist id="role-presets">
                  {ROLE_PRESETS.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </Field>

              <Field
                label="業界 / 領域"
                hint="関わる主な業界（複数あれば代表的なもの）"
                required
              >
                <input
                  className="input"
                  placeholder="例: SaaS / 製造業 / 教育 など"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                />
              </Field>

              <Field
                label="規模"
                hint="関係する人数（自分含めた稼働人数）"
                required
              >
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {TEAM_PRESETS.map((p) => {
                    const selected = teamSize === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setTeamSize(p)}
                        className={
                          "rounded-lg border px-3 py-2 text-sm transition-colors " +
                          (selected
                            ? "border-ink-900 bg-ink-900 text-white"
                            : "border-ink-200 bg-white text-ink-700 hover:bg-ink-50")
                        }
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>次のステップで聞くこと</CardTitle>
            <CardDescription>5〜10 分で完了します</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm text-ink-700">
              <Item>応答の長さ・否定耐性・結論先行度</Item>
              <Item>音声で語る『絶対に守らせるルール』</Item>
              <Item>シナリオ判断での即決パターン</Item>
            </ol>
            <p className="mt-5 text-xs leading-relaxed text-ink-500">
              すべての回答はこのブラウザの localStorage に保存されます。
              サーバーへ送られるのは、Gemini に解析を依頼する瞬間のみです。
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 flex items-center justify-end gap-3">
        <Button onClick={handleNext} disabled={!canSubmit} size="lg">
          性格診断へ進む →
        </Button>
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          height: 2.5rem;
          padding: 0 0.875rem;
          border-radius: 0.5rem;
          border: 1px solid #d9d9df;
          background-color: white;
          font-size: 0.9rem;
          color: #13131a;
          outline: none;
          transition: border-color 120ms ease, box-shadow 120ms ease;
        }
        .input:focus {
          border-color: #13131a;
          box-shadow: 0 0 0 3px rgba(19, 19, 26, 0.08);
        }
      `}</style>
    </WorkspaceShell>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline gap-2">
        <span className="text-sm font-medium tracking-tightish text-ink-900">
          {label}
        </span>
        {required && (
          <span className="text-[10px] font-medium uppercase tracking-tightish text-signal-must">
            必須
          </span>
        )}
      </span>
      {hint && <span className="text-xs text-ink-500">{hint}</span>}
      {children}
    </label>
  );
}

function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span
        aria-hidden
        className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
      />
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}
