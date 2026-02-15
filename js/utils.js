export function toDateInputValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function toDateTimeInputValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function withDayOffset(baseDate = new Date(), offset = 0) {
  const next = new Date(baseDate);
  next.setDate(next.getDate() + offset);
  return next;
}

export function withHourOffset(baseDate = new Date(), offset = 0) {
  const next = new Date(baseDate);
  next.setHours(next.getHours() + offset);
  return next;
}

export function formatDate(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
}

export function formatDateTime(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export function escapeHtml(input = "") {
  return String(input)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function numberOrNull(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export function buildChartUrl(source = "") {
  const url = new URL("./data-chart.html", window.location.href);
  if (source) url.searchParams.set("from", source);
  return `${url.pathname}${url.search}`;
}
