/**
 * ExecutableContext (中間 JSON) → Markdown のレンダラ。
 *
 * ターゲット AI ごとに最適化したフォーマットを出力する:
 *   - chatgpt: ChatGPT の Custom Instruction / Project Instructions 向け
 *   - claude: Claude の System Prompt / Project Knowledge 向け
 *   - gemini: Gemini Gem / system_instruction 向け
 *   - claude_code: Claude Code 向け
 *   - google_antigravity: Google Antigravity 向け
 *   - cursor: Cursor の AGENTS.md / .cursor/rules 向け
 *   - universal_agent: 汎用エージェント向け
 *
 * 共通の核（CORE IDENTITY / PRIORITY GATES / RESPONSE PROTOCOL ...）は
 * `renderCore()` で共通化し、ターゲット別の前文・末尾だけ差し替える。
 */

import type {
  CommunicationStyle,
  DecisionFramework,
  ExampleCase,
  ExecutableContext,
  ExportTarget,
  ExportedPrompt,
  Intensity,
  PriorityGate,
  ResponseProtocol,
  Rule,
  ThinkingProtocol,
  TriggerRule,
  UserProfile,
} from "@/types/executable-context";

const intensityBadge = (i: Intensity): string =>
  i === "MUST"
    ? "**[MUST（鉄則、必須）]**"
    : i === "SHOULD"
      ? "**[SHOULD（原則、外すときは理由）]**"
      : "*[MAY（方針の目安、遵守は緩め）]*";

const renderProfile = (u: UserProfile): string => {
  const lines = [
    `- 役割: ${u.role}`,
    `- 業界: ${u.industry}`,
    `- 規模: ${u.teamSize}`,
  ];
  if (u.frequentTasks?.length) {
    lines.push(`- 頻出タスク: ${u.frequentTasks.join(" / ")}`);
  }
  if (u.stakeholders?.length) {
    lines.push(`- 主要ステークホルダー: ${u.stakeholders.join(" / ")}`);
  }
  return lines.join("\n");
};

const renderPriorityGates = (gates: PriorityGate[]): string =>
  gates
    .map(
      (g, i) =>
        `### Gate ${i + 1}: ${g.when}\n` +
        `${intensityBadge(g.intensity)} **${g.choose}** ＞ ${g.over}\n\n` +
        `> 根拠: ${g.rationale}`,
    )
    .join("\n\n");

const renderRules = (rules: Rule[]): string =>
  rules.map((r) => `- ${intensityBadge(r.intensity)} ${r.statement}`).join("\n");

const renderResponseProtocol = (rp: ResponseProtocol): string =>
  [
    `**応答構造**: \`${rp.structure}\``,
    "",
    renderRules(rp.rules),
  ].join("\n");

const renderCommStyle = (c: CommunicationStyle): string =>
  [
    `- 文体: ${c.tone === "formal" ? "敬体（です・ます）" : c.tone === "casual" ? "口語" : "中性的"}`,
    `- 1メッセージ最大段落数: ${c.maxParagraphs}`,
    `- 緩衝表現（「〜かもしれません」等）: ${c.bufferPhrases === "forbidden" ? "**禁止**" : "許容"}`,
    `- 共感フレーズ（「お気持ちわかります」等）: ${c.empathyPhrases === "forbidden" ? "**禁止**" : "許容"}`,
    `- 絵文字: ${c.emoji === "forbidden" ? "**禁止**" : c.emoji === "minimal" ? "最小限" : "許容"}`,
    `- 質問返し（前提確認）: ${c.allowClarifyingQuestions ? "許容（最後にまとめる）" : "**禁止**（仮置きで進めること）"}`,
  ].join("\n");

const renderThinking = (t: ThinkingProtocol): string => renderRules(t.rules);

const renderDecision = (d: DecisionFramework): string =>
  [
    `**優先順位（先頭ほど強い）**: ${d.priorityOrder.map((p) => `\`${p}\``).join(" ＞ ")}`,
    "",
    `- リスク許容度: \`${d.riskTolerance}\``,
    `- 判断軸: ${d.judgmentAxes.map((a) => `\`${a}\``).join(", ")}`,
  ].join("\n");

const renderTriggers = (triggers: TriggerRule[]): string =>
  triggers
    .map(
      (t) =>
        `- ${intensityBadge(t.intensity)} **IF** ${t.if} → **THEN** ${t.then}`,
    )
    .join("\n");

const renderTaboos = (taboos: Rule[]): string =>
  taboos
    .map(
      (t) =>
        `- ${intensityBadge(t.intensity)} ${t.statement.replace(/^DON'?T:?\s*/i, "")}`,
    )
    .join("\n");

const renderExamples = (examples: ExampleCase[]): string =>
  examples
    .map(
      (e, i) =>
        `### Example ${i + 1}: ${e.scenario}\n\n` +
        `**Good（こう振る舞え）**\n\n${e.good
          .split("\n")
          .map((l) => `> ${l}`)
          .join("\n")}\n\n` +
        `**Bad（してはならない）**\n\n${e.bad
          .split("\n")
          .map((l) => `> ${l}`)
          .join("\n")}`,
    )
    .join("\n\n");

/**
 * 共通の本体。ターゲット別の preamble / postamble で挟んで使う。
 */
function renderCore(ctx: ExecutableContext): string {
  return [
    "## 0. CORE IDENTITY（最優先・上書き不可）",
    `- 役割: ${ctx.coreIdentity.role}`,
    `- 立場: ${ctx.coreIdentity.stance}`,
    `- 失敗時: ${ctx.coreIdentity.failureMode}`,
    "",
    "## 1. PRIORITY GATES（思考の優先順位）",
    "> このセクションが本プロンプトの核心。",
    "> AとBで判断に迷ったら、ここに書かれた選択を**例外なく**採れ。",
    "",
    renderPriorityGates(ctx.priorityGates),
    "",
    "## 2. RESPONSE PROTOCOL（応答の構造）",
    renderResponseProtocol(ctx.responseProtocol),
    "",
    "## 3. COMMUNICATION STYLE（口調・トーン）",
    renderCommStyle(ctx.communicationStyle),
    "",
    "## 4. THINKING PROTOCOL（思考プロトコル）",
    renderThinking(ctx.thinkingProtocol),
    "",
    "## 5. DECISION FRAMEWORK（意思決定の前提）",
    renderDecision(ctx.decisionFramework),
    "",
    "## 6. CONTEXT — USER STATE（背景情報）",
    renderProfile(ctx.user),
    "",
    "## 7. TRIGGERS（条件付きルール）",
    renderTriggers(ctx.triggers),
    "",
    "## 8. TABOOS（禁忌：絶対に取らない振る舞い）",
    renderTaboos(ctx.taboos),
    "",
    "## 9. EXAMPLES（few-shot）",
    renderExamples(ctx.examples),
    "",
    "## 10. META",
    `- 生成日時: ${ctx.meta.generatedAt}`,
    `- バージョン: ${ctx.meta.version}`,
    `- 元データ: personality=${ctx.meta.sourceVersions.personality} / interview=${ctx.meta.sourceVersions.interview} / scenarios=${ctx.meta.sourceVersions.scenarios}`,
  ].join("\n");
}

const PREAMBLES: Record<ExportTarget, (ctx: ExecutableContext) => string> = {
  chatgpt: (ctx) => {
    const name = ctx.user.displayName ?? "本人";
    return [
      `# ${name} 専用 SYSTEM PROMPT (for ChatGPT)`,
      "",
      "> 以下は ChatGPT の Custom Instructions / Project Instructions に貼り付けて使うこと。",
      `> このプロンプトを読み込んだ瞬間から、あなたは「${name}」専属の AI として`,
      "> 以下のプロトコルに**完全準拠**して応答する。違反は禁止。",
    ].join("\n");
  },
  claude: (ctx) => {
    const name = ctx.user.displayName ?? "本人";
    return [
      `# ${name} 専用 SYSTEM PROMPT (for Claude)`,
      "",
      "> 以下は Claude の System Prompt / Project Knowledge に登録して使うこと。",
      `> あなたは「${name}」専属のアシスタントとして、以下の手順書に厳密に従う。`,
      "> Constitutional AI ガードレールは保持しつつ、本プロトコルを最優先せよ。",
    ].join("\n");
  },
  claude_code: (ctx) => {
    const name = ctx.user.displayName ?? "本人";
    return [
      `# ${name} 専用 AGENT PROMPT (for Claude Code)`,
      "",
      "> Claude Code の実行エージェントに渡す指示書として使うこと。",
      `> あなたは「${name}」の専属 AI エンジニアである。以下の命令セットを最優先で守れ。`,
      "",
      "## Claude Code 追加ルール",
      "- 実装前に変更範囲を簡潔に宣言せよ。",
      "- 変更後は動作確認手順を必ず提示せよ。",
      "- 危険なコマンド実行前に意図を確認せよ。",
    ].join("\n");
  },
  gemini: (ctx) => {
    const name = ctx.user.displayName ?? "本人";
    return [
      `# ${name} 専用 SYSTEM INSTRUCTION (for Gemini)`,
      "",
      "> Gemini Gem / API の system_instruction として渡すこと。",
      `> あなたは「${name}」のための専属 AI である。以下の命令セットに準拠して応答せよ。`,
    ].join("\n");
  },
  google_antigravity: (ctx) => {
    const name = ctx.user.displayName ?? "本人";
    return [
      `# ${name} 専用 SYSTEM INSTRUCTION (for Google Antigravity)`,
      "",
      "> Google Antigravity のエージェント指示欄に設定すること。",
      `> あなたは「${name}」の執行アシスタントとして、以下のプロトコルに完全準拠して応答する。`,
      "> 推測を避け、必要時は前提を明示したうえで実行可能な提案を返せ。",
    ].join("\n");
  },
  cursor: (ctx) => {
    const name = ctx.user.displayName ?? "本人";
    return [
      `# AGENTS.md — ${name} 専用 開発エージェント指示書`,
      "",
      "> Cursor / Claude Code / その他コーディングエージェント向けの AGENTS.md として配置すること。",
      `> ユーザー「${name}」の意思決定様式・コミュニケーション様式を完全に踏襲した上で、`,
      "> 開発タスクを遂行せよ。",
      "",
      "## 開発エージェント追加ルール",
      "- コード変更は最小限・差分で示せ。完成形コードの全文掲載は避けよ。",
      "- ファイル変更前に対象ファイルを必ず読み、既存規約を踏襲せよ。",
      "- テストや lint を壊した場合は即座に報告し、勝手に隠蔽するな。",
    ].join("\n");
  },
  universal_agent: (ctx) => {
    const name = ctx.user.displayName ?? "本人";
    return [
      `# ${name} 専用 UNIVERSAL AGENT PROMPT`,
      "",
      "> 特定ベンダーに依存しない汎用 AI エージェント向け形式。",
      `> あなたは「${name}」専属の実行支援エージェントである。以下の命令セットを優先順位付きで順守せよ。`,
      "> 競合ルールがある場合は MUST > SHOULD > MAY の順に解決すること。",
    ].join("\n");
  },
};

const POSTAMBLES: Record<ExportTarget, string> = {
  chatgpt:
    "\n\n---\n\n*以上のプロトコルが、あらゆる回答スタイルガイドラインに優先する。違反は禁止。*",
  claude:
    "\n\n---\n\n*このプロトコルは Claude のデフォルトの礼儀作法より優先する。ただし安全性ガードレールは維持せよ。*",
  claude_code:
    "\n\n---\n\n*このプロトコルは Claude Code の既定アシスタント挙動より優先する。安全ガードレールは維持せよ。*",
  gemini:
    "\n\n---\n\n*以上のプロトコルは応答生成時のあらゆる既定値に優先する。*",
  google_antigravity:
    "\n\n---\n\n*このプロトコルは Google Antigravity の既定挙動より優先する。*",
  cursor:
    "\n\n---\n\n*このファイルはコーディングエージェントの行動規範である。これに反する一切の振る舞いを禁ず。*",
  universal_agent:
    "\n\n---\n\n*本指示書は汎用エージェントの共通行動規範として利用できる。*",
};

const FILENAMES: Record<ExportTarget, string> = {
  chatgpt: "chatgpt-system-prompt.md",
  claude: "claude-system-prompt.md",
  claude_code: "claude-code-agent-prompt.md",
  gemini: "gemini-system-instruction.md",
  google_antigravity: "google-antigravity-agent-instruction.md",
  cursor: "AGENTS.md",
  universal_agent: "universal-agent-prompt.md",
};

export function renderForTarget(
  ctx: ExecutableContext,
  target: ExportTarget,
): ExportedPrompt {
  const markdown = [
    PREAMBLES[target](ctx),
    "",
    "---",
    "",
    renderCore(ctx),
    POSTAMBLES[target],
  ].join("\n");

  return {
    target,
    filename: FILENAMES[target],
    markdown,
  };
}

export const ALL_TARGETS: ExportTarget[] = [
  "chatgpt",
  "claude",
  "claude_code",
  "gemini",
  "google_antigravity",
  "cursor",
  "universal_agent",
];

export function renderAllTargets(
  ctx: ExecutableContext,
): Record<ExportTarget, ExportedPrompt> {
  return ALL_TARGETS.reduce(
    (acc, t) => {
      acc[t] = renderForTarget(ctx, t);
      return acc;
    },
    {} as Record<ExportTarget, ExportedPrompt>,
  );
}
