import { isAbsolute, relative } from "node:path";

export type Finding = {
  id: string; reviewer: string; summary: string; evidence: string;
  file?: string; line?: number; severity?: string; verdict?: string;
  title?: string; impact?: string; sources?: string[];
  severityLevel?: string; severityMappingSource?: string;
};

export const severityConflict = (a?: { severityLevel?: string }, b?: { severityLevel?: string }) => Boolean(a?.severityLevel && b?.severityLevel && a.severityLevel !== b.severityLevel);
export function applySeverity<T extends { severity?: string }>(finding: T, map?: Record<string,string>, source?: string): T & { severityLevel?: string; severityMappingSource?: string } {
  const level = finding.severity ? map?.[finding.severity] : undefined;
  return { ...finding, severityLevel: level, severityMappingSource: level ? source : undefined };
}

const location = /([\w./-]+\.(?:[cm]?[jt]sx?|py|go|rs|java|rb|php|md|ya?ml|json|sql)|\.gitignore)(?::(\d+))?/i;
const plain = (text: string) => text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[`*_]/g, "").trim();
const claim = (text: string) => plain(text).replace(/^\s*(?:[-•]|\d+[.)])\s*/, "").replace(/^\[P[0-3]\]\s*/i, "").replace(/^(?:critical|high|medium|low):\s*/i, "").replace(location, "").replace(/^\s*[—:–-]\s*/, "").trim();
const ignored = (text: string) => /^(?:#{1,6}\s*)?(?:review scope|vee questions|vee verdict|default review|current spec set|review summary|summary|verdict|findings|no findings|no actionable findings|none\b|clean-context subagent|static workflow validation|git diff --check|i[’'](?:ll|m)\b)/i.test(plain(text));
const stopWords = new Set(["the", "a", "an", "is", "are", "to", "of", "in", "and", "for", "this", "that", "with", "it", "can", "should", "does", "do"]);
const tokens = (text: string) => new Set(claim(text).toLowerCase().match(/[a-z0-9_]+/g)?.filter(word => !stopWords.has(word)) ?? []);
const similarity = (a: string, b: string) => {
  const left = tokens(a), right = tokens(b);
  return [...left].filter(word => right.has(word)).length / Math.max(1, Math.max(left.size, right.size));
};
export const sameLocation = (a: Finding, b: Finding) => Boolean(a.file && a.file === b.file && a.line !== undefined && a.line === b.line);
export function sameConcern(a: Finding, b: Finding): boolean {
  // ponytail: conservative lexical matching; ambiguous paraphrases remain separate for debate.
  return Boolean(sameLocation(a, b) && tokens(a.summary).size >= 2 && similarity(a.summary, b.summary) >= 0.8);
}

function consolidate(items: Finding[]): Finding[] {
  const result: Finding[] = [];
  for (const item of items) {
    const previous = result.find(other => sameConcern(other, item) && (!other.verdict || !item.verdict || other.verdict === item.verdict) && !severityConflict(other, item));
    if (!previous) { result.push(item); continue; }
    previous.verdict ??= item.verdict;
    if (!previous.severity && item.severity) { previous.severity=item.severity; previous.severityLevel=item.severityLevel; previous.severityMappingSource=item.severityMappingSource; }
    previous.impact ??= item.impact;
    previous.sources = [...(previous.sources ?? [previous.evidence]), ...(item.sources ?? [item.evidence])];
    previous.evidence = [...new Set([previous.evidence, item.evidence])].join("\n\n");
  }
  return result;
}

export function findings(reviewer: string, transcript: string, cwd = process.cwd(), severityMap?: Record<string,string>, mappingSource = reviewer): Finding[] {
  const normalizeFile = (file: string) => {
    const path = isAbsolute(file) ? relative(cwd, file) : file;
    return path.startsWith("../") ? file : path;
  };
  const anchor = (raw: string) => {
    const linked = raw.match(/\[[^\]]+\]\(<?([^)>]+)>?\)/)?.[1];
    let target = linked ?? plain(raw);
    try { target = decodeURIComponent(target); } catch { /* Preserve a literal path with malformed escapes. */ }
    const match = target.match(location);
    if (!match) return {};
    return { file: normalizeFile(match[1]), line: match[2] ? Number(match[2]) : undefined };
  };
  const parsedCandidates = [transcript, ...[...transcript.matchAll(/```(?:json)?\s*\n([\s\S]*?)```/g)].map(match => match[1]), ...transcript.split("\n").flatMap((line, index, lines) => line.trim().startsWith("{") ? [lines.slice(index).join("\n")] : []).reverse(), ...transcript.split("\n").reverse()];
  for (const candidate of parsedCandidates) {
    let parsed: any;
    try { parsed = JSON.parse(candidate); } catch { continue; }
    if (!parsed || !Array.isArray(parsed.findings)) continue;
    return consolidate(parsed.findings.filter((item: unknown) => item && typeof item === "object").flatMap((item: Record<string, unknown>, index: number) => {
      const summary = String(item.summary ?? item.title ?? item.message ?? "");
      if (!claim(summary) || ignored(summary)) return [];
      const at = anchor(summary);
      return [{
        id: `${reviewer}-${index + 1}`, reviewer, summary,
        evidence: String(item.evidence ?? item.rationale ?? summary), sources: [JSON.stringify(item)],
        file: typeof item.file === "string" ? normalizeFile(item.file) : at.file,
        line: typeof item.line === "number" ? item.line : at.line,
        severity: typeof item.severity === "string" ? item.severity : undefined,
        verdict: item.verdict === "issue" || item.verdict === "no_issue" ? item.verdict : undefined,
        title: typeof item.title === "string" ? item.title : undefined,
        impact: typeof item.impact === "string" ? item.impact : undefined,
      }];
    }).map(finding => applySeverity(finding, severityMap, mappingSource)));
  }

  const result: Finding[] = [];
  let current: { file?: string; line?: number; summary: string; evidence: string[]; sources: string[]; severity?: string; title?: string; question?: string; number?: number; overlap?: number } | undefined;
  const questions = new Map<number, Finding>();
  let section = "";
  const flush = () => {
    if (current?.summary && !ignored(current.summary)) {
      const found: Finding = {
        id: `${reviewer}-${result.length + 1}`, reviewer, summary: current.summary,
        evidence: current.evidence.join("\n"), sources: [current.sources.join("\n")],
        file: current.file, line: current.line, severity: current.severity, title: current.title,
      };
      const overlap = current.overlap ? questions.get(current.overlap) : undefined;
      if (overlap && (!found.file || found.file === overlap.file)) {
        overlap.sources!.push(...found.sources!);
        overlap.evidence += `\n\n${found.evidence}`;
        overlap.severity ??= found.severity;
      } else result.push(found);
      if (section === "vee questions" && current.number) questions.set(current.number, found);
    }
    current = undefined;
  };
  for (const raw of transcript.split("\n")) {
    const text = plain(raw).replace(/^\s*[-•]\s*/, "");
    if (!text || /^```/.test(text)) continue;
    if (ignored(text) || /^#{1,6}\s/.test(text)) {
      flush();
      section = text.replace(/^#{1,6}\s*/, "").replace(/:$/, "").toLowerCase();
      continue;
    }
    const detail = text.match(/^(private rationale|rationale|evidence|proposed question|question|impact):\s*(.*)/i);
    if (detail && current) {
      current.evidence.push(text);
      current.sources.push(raw);
      if ((!current.summary || current.summary === current.question) && /rationale|evidence/i.test(detail[1])) current.summary = detail[2];
      if (!current.summary && /question/i.test(detail[1])) current.summary = current.question = detail[2];
      continue;
    }
    const match = text.match(location), at = anchor(raw);
    const start = /^(?:\d+[.)]\s+|\[P[0-3]\]\s+|P[0-3]:\s*)/i.test(text) || Boolean(match && text.startsWith(match[0]));
    if (start) {
      flush();
      const withoutLink = plain(raw.replace(/\[[^\]]+\]\([^)]+\)/g, "")).replace(/^\s*[-•]\s*/, "").replace(/^P[0-3]:\s*/i, "");
      current = { ...at, summary: claim(withoutLink), evidence: [text], sources: [section, raw],
        title: raw.match(/\[([^\]]+)\]\([^)]+\)/)?.[1]?.replace(/:\d+$/, ""),
        number: Number(text.match(/^(\d+)[.)]/)?.[1]) || undefined,
        overlap: section === "default review" ? Number(text.match(/\boverlaps Vee question (\d+)\b/i)?.[1]) || undefined : undefined,
        severity: text.match(/\b(P[0-3]):/i)?.[1] ?? text.match(/\b(critical|high|medium|low):/i)?.[1]?.toLowerCase() };
    } else if (current && /^\s+/.test(raw)) {
      current.evidence.push(text);
      current.sources.push(raw);
      current.summary += ` ${text}`;
    } else {
      flush(); // Unrecognized prose remains in the raw transcript, not the findings set.
    }
  }
  flush();
  return consolidate(result.map(finding => applySeverity(finding, severityMap, mappingSource)));
}

export type Comparison = { agreements: Finding[][]; disputes: Finding[][]; findings: Finding[] };
export function compare(a: Finding[], b: Finding[]): Comparison {
  const lefts = consolidate(a), rights = consolidate(b);
  const matched = new Set<string>(), agreements: Finding[][] = [], disputes: Finding[][] = [];
  for (const left of lefts) {
    const candidates = rights.filter(right => !matched.has(right.id) && sameConcern(left, right));
    const candidate = candidates.length === 1 ? candidates[0] : undefined;
    const unique = candidate && lefts.filter(other => sameConcern(other, candidate)).length === 1;
    if (!candidate || !unique) { disputes.push([left]); continue; }
    matched.add(candidate.id);
    const conflict = (left.verdict && candidate.verdict && left.verdict !== candidate.verdict)
      || severityConflict(left, candidate);
    // Missing verdicts need the original reviewers' explicit conclusions before confirmation.
    (conflict || !left.verdict || !candidate.verdict ? disputes : agreements).push([left, candidate]);
  }
  for (const right of rights) if (!matched.has(right.id)) disputes.push([right]);
  return { agreements, disputes, findings: [...lefts, ...rights] };
}
