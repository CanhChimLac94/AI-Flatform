export type OutputFileFormat = "auto" | "txt" | "json" | "md" | "html" | "csv";

const PLACEHOLDER = "Hệ thống đang đợi tín hiệu...";

export function isExportableOutput(value?: string): boolean {
  if (!value?.trim()) return false;
  return value.trim() !== PLACEHOLDER;
}

export function detectOutputFormat(content: string): OutputFileFormat {
  const trimmed = content.trim();
  if (!trimmed) return "txt";

  try {
    JSON.parse(trimmed);
    return "json";
  } catch {
    // not json
  }

  if (/^<!DOCTYPE html|^<html[\s>]/i.test(trimmed) || /<\/(html|body|div|p)>/i.test(trimmed)) {
    return "html";
  }

  if (
    /^#{1,6}\s/m.test(trimmed) ||
    /```[\s\S]*?```/m.test(trimmed) ||
    /^\s*[-*+]\s/m.test(trimmed)
  ) {
    return "md";
  }

  const lines = trimmed.split("\n").filter(Boolean);
  if (lines.length >= 2 && lines.every((line) => line.includes(","))) {
    return "csv";
  }

  return "txt";
}

function resolveFormat(format: OutputFileFormat, content: string): Exclude<OutputFileFormat, "auto"> {
  return format === "auto" ? detectOutputFormat(content) : format;
}

export function prepareOutputContent(content: string, format: OutputFileFormat): string {
  const resolved = resolveFormat(format, content);

  switch (resolved) {
    case "json":
      try {
        return JSON.stringify(JSON.parse(content.trim()), null, 2);
      } catch {
        return JSON.stringify({ output: content }, null, 2);
      }
    case "md":
      if (detectOutputFormat(content) === "md") return content;
      return `# Output\n\n${content}`;
    case "html":
      if (detectOutputFormat(content) === "html") return content;
      return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>Flow Output</title>
</head>
<body>
  <pre>${escapeHtml(content)}</pre>
</body>
</html>`;
    case "csv":
      return content;
    default:
      return content;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const MIME: Record<Exclude<OutputFileFormat, "auto">, string> = {
  txt: "text/plain;charset=utf-8",
  json: "application/json;charset=utf-8",
  md: "text/markdown;charset=utf-8",
  html: "text/html;charset=utf-8",
  csv: "text/csv;charset=utf-8",
};

export function getOutputFileMeta(content: string, format: OutputFileFormat = "auto") {
  const resolved = resolveFormat(format, content);
  return { ext: resolved, mime: MIME[resolved] };
}

export function slugifyOutputName(label: string): string {
  const slug = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return slug || "output";
}

export function downloadOutputFile(
  content: string,
  label: string,
  format: OutputFileFormat = "auto",
): void {
  if (!isExportableOutput(content)) return;

  const prepared = prepareOutputContent(content, format);
  const { ext, mime } = getOutputFileMeta(content, format);
  const filename = `${slugifyOutputName(label)}_${Date.now()}.${ext}`;
  const blob = new Blob([prepared], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function copyOutputToClipboard(content: string): Promise<boolean> {
  if (!isExportableOutput(content)) return false;
  try {
    await navigator.clipboard.writeText(content);
    return true;
  } catch {
    return false;
  }
}

export const EXPORT_FORMAT_OPTIONS: { value: OutputFileFormat; label: string; ext: string }[] = [
  { value: "auto", label: "Tự động", ext: "auto" },
  { value: "txt", label: "Text", ext: "txt" },
  { value: "json", label: "JSON", ext: "json" },
  { value: "md", label: "Markdown", ext: "md" },
  { value: "html", label: "HTML", ext: "html" },
  { value: "csv", label: "CSV", ext: "csv" },
];
