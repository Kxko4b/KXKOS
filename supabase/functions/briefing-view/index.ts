// briefing-view: read-only daily briefing for the KXKOS "Briefing" app.
//
// Unlike `daily-briefing` it sends NO push notification and it only answers the
// @ts-nocheck
// owner: the caller must be signed in (Supabase Auth) as BRIEFING_OWNER_EMAIL.
// Secrets it uses are the same project secrets daily-briefing already uses.

const SUPABASE_URL = "https://ggewdpazpeoielbqrcgm.supabase.co";
const OWNER = (Deno.env.get("BRIEFING_OWNER_EMAIL") ?? "haleannson@gmail.com").toLowerCase();
const TZ = "Europe/Berlin";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/* ---------------------------------------------------------------- auth */

async function ownerEmail(req) {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  const apikey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: auth, apikey } });
  if (!res.ok) return null;
  const user = await res.json();
  const email = String(user?.email ?? "").toLowerCase();
  const confirmed = Boolean(user?.email_confirmed_at || user?.confirmed_at);
  return email === OWNER && confirmed ? email : null;
}

/* ---------------------------------------------------------------- dates */

function berlinToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date()).replaceAll("-", "");
}

function parseDay(text) {
  if (!/^\d{8}$/.test(text)) throw new Error("date must be YYYYMMDD");
  return { y: Number(text.slice(0, 4)), m: Number(text.slice(4, 6)), d: Number(text.slice(6, 8)) };
}

function isoDay({ y, m, d }) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function berlinOffset({ y, m, d }) {
  const noon = new Date(Date.UTC(y, m - 1, d, 12));
  const name = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, timeZoneName: "longOffset" })
    .formatToParts(noon).find((p) => p.type === "timeZoneName")?.value ?? "GMT+01:00";
  const off = name.replace("GMT", "");
  return off === "" ? "+00:00" : off;
}

function dayLabel(day) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
    .format(new Date(Date.UTC(day.y, day.m - 1, day.d)));
}

function fmtTime(value) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ })
    .format(new Date(value));
}

function berlinKey(date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(date).replaceAll("-", "");
}

/* -------------------------------------------------------------- weather */

function weatherText(code) {
  if (code === 0) return "Clear";
  if (code === 1) return "Mostly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Cloudy";
  if (code >= 45 && code <= 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Showers";
  if (code >= 85 && code <= 86) return "Snow showers";
  if (code >= 95 && code <= 99) return "Thunderstorms";
  return "Unknown";
}

function rainPeriods(times, probs) {
  const out = [];
  let start = null;
  let last = -1;
  const end = (i) => {
    const d = new Date(times[i]);
    d.setHours(d.getHours() + 1);
    return `${start}–${String(d.getHours()).padStart(2, "0")}:00`;
  };
  for (let i = 0; i < times.length; i++) {
    const raining = Number(probs[i] ?? 0) >= 30;
    const hh = String(times[i]).slice(11, 16);
    if (raining) {
      if (start === null) start = hh;
      last = i;
    } else if (start !== null) {
      out.push(end(last));
      start = null;
      last = -1;
    }
  }
  if (start !== null && last >= 0) out.push(end(last));
  return out;
}

async function getWeather(day) {
  const iso = isoDay(day);
  const url = "https://api.open-meteo.com/v1/forecast?" + new URLSearchParams({
    latitude: "50.60",
    longitude: "8.80",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,wind_speed_10m_max",
    hourly: "precipitation_probability",
    timezone: TZ,
    start_date: iso,
    end_date: iso,
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather API returned HTTP ${res.status}`);
  const data = await res.json();
  if (!data.daily) throw new Error("Weather API returned no daily data.");
  const code = data.daily.weather_code?.[0] ?? -1;
  return {
    code,
    text: weatherText(code),
    low: data.daily.temperature_2m_min?.[0] ?? null,
    high: data.daily.temperature_2m_max?.[0] ?? null,
    rainChance: data.daily.precipitation_probability_max?.[0] ?? null,
    wind: data.daily.wind_speed_10m_max?.[0] ?? null,
    rainPeriods: rainPeriods(data.hourly?.time ?? [], data.hourly?.precipitation_probability ?? []),
  };
}

/* ---------------------------------------------------------------- untis */

async function getUntis(dayText) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/untis-test?date=${encodeURIComponent(dayText)}`);
  const text = await res.text();
  if (!res.ok) throw new Error(`untis-test returned HTTP ${res.status}`);
  return JSON.parse(text);
}

function pickTimetable(data) {
  for (const c of [data?.timetable, data?.lessons, data?.data?.timetable, data?.data?.lessons]) {
    if (Array.isArray(c)) return c;
  }
  return [];
}

function pickHomework(data, timetable) {
  for (const c of [data?.homework, data?.homeworks, data?.data?.homework, data?.data?.homeworks]) {
    if (Array.isArray(c)) return c;
  }
  const out = [];
  for (const lesson of timetable) {
    const list = lesson?.homework ?? lesson?.homeworks ?? lesson?.tasks;
    if (Array.isArray(list)) {
      for (const item of list) {
        out.push({ ...item, subject: item?.subject ?? lesson?.subject ?? lesson?.actual ?? lesson?.expected ?? "" });
      }
    }
  }
  return out;
}

function str(v) {
  if (v == null) return "";
  if (typeof v === "object") return String(v.name ?? v.longName ?? v.shortName ?? "");
  return String(v);
}

function lessonView(l) {
  return {
    time: str(l?.time),
    subject: str(l?.expected) || str(l?.subject) || str(l?.actual) || "Lesson",
    teacher: str(l?.substituteTeacher) || str(l?.teacher),
    room: str(l?.room),
    cancelled: Boolean(l?.cancelled),
    changed: Boolean(l?.changed),
  };
}

function homeworkView(h) {
  const text = typeof h === "string" ? h.trim() : String(h?.text ?? h?.description ?? h?.title ?? h?.name ?? h?.task ?? "").trim();
  const subject = typeof h === "string" ? "" : str(h?.subject ?? h?.subjectName).trim();
  return { subject, text };
}

/* ------------------------------------------------------ Google Calendar */

async function getCalendar(day) {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) throw new Error("Google Calendar secrets are missing.");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(`Google token refresh failed: ${tokenData?.error ?? tokenRes.status}`);
  }

  const off = berlinOffset(day);
  const next = new Date(Date.UTC(day.y, day.m - 1, day.d + 1));
  const nextIso = isoDay({ y: next.getUTCFullYear(), m: next.getUTCMonth() + 1, d: next.getUTCDate() });
  const url = "https://www.googleapis.com/calendar/v3/calendars/primary/events?" + new URLSearchParams({
    timeMin: `${isoDay(day)}T00:00:00${off}`,
    timeMax: `${nextIso}T00:00:00${off}`,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "100",
  });
  const res = await fetch(url, { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
  const data = await res.json();
  if (!res.ok) throw new Error("Google Calendar API failed: " + (data?.error?.message ?? res.status));

  return (Array.isArray(data.items) ? data.items : []).map((e) => {
    const allDay = Boolean(e?.start?.date && !e?.start?.dateTime);
    return {
      time: allDay ? "All day" : fmtTime(e?.start?.dateTime),
      title: e?.summary ?? "Calendar event",
      location: e?.location ?? "",
    };
  });
}

/* ---------------------------------------------------------- IServ exams */

function icsValue(block, field) {
  for (const line of block.split("\n")) {
    if (line.startsWith(field + ":") || line.startsWith(field + ";")) {
      const colon = line.indexOf(":");
      if (colon === -1) continue;
      return line.slice(colon + 1).replace(/\\,/g, ",").replace(/\;/g, ";").replace(/\\\\/g, "\\").replace(/\\n/g, "\n").trim();
    }
  }
  return null;
}

function icsStart(value) {
  const v = value.trim();
  if (/^\d{8}$/.test(v)) return { key: v, allDay: true, date: null };
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) return null;
  const date = m[7]
    ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]))
    : new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`);
  return m[7] ? { key: berlinKey(date), allDay: false, date } : { key: `${m[1]}${m[2]}${m[3]}`, allDay: false, date, floating: `${m[4]}:${m[5]}` };
}

async function getExams(dayText) {
  const url = Deno.env.get("ISERV_EXAM_CALENDAR_URL");
  if (!url) throw new Error("ISERV_EXAM_CALENDAR_URL secret is missing.");
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) throw new Error(`IServ returned HTTP ${res.status}`);
  if (!text.includes("BEGIN:VCALENDAR")) throw new Error("IServ did not return ICS data.");

  const blocks = text.replace(/\r?\n[ \t]/g, "").split("BEGIN:VEVENT");
  const exams = [];
  for (let i = 1; i < blocks.length; i++) {
    const start = icsStart(icsValue(blocks[i], "DTSTART") ?? "");
    if (!start || start.key !== dayText) continue;
    exams.push({
      time: start.allDay ? "All day" : start.floating ?? fmtTime(start.date),
      title: icsValue(blocks[i], "SUMMARY") || "Exam",
      location: icsValue(blocks[i], "LOCATION") || "",
      description: icsValue(blocks[i], "DESCRIPTION") || "",
    });
  }
  return exams;
}

/* -------------------------------------------------------- request counts */

async function getRequestCounts() {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) throw new Error("Service key missing.");
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const count = async (status) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/requests?select=id&status=eq.${encodeURIComponent(status)}`, { headers });
    if (!res.ok) throw new Error(`Could not load ${status} requests: HTTP ${res.status}`);
    const rows = await res.json();
    return Array.isArray(rows) ? rows.length : 0;
  };
  const [pending, inProgress] = await Promise.all([count("Pending"), count("In Progress")]);
  return { pending, inProgress };
}

/* ------------------------------------------------------------------ main */

async function component(name, fn) {
  try {
    return { name, ok: true, data: await fn() };
  } catch (error) {
    return { name, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "GET") return json({ error: "Method not allowed." }, 405);

  const email = await ownerEmail(req);
  if (!email) return json({ error: "Not allowed." }, 403);

  try {
    const url = new URL(req.url);
    const dayText = url.searchParams.get("date") ?? berlinToday();
    const day = parseDay(dayText);

    const [untis, calendar, weather, exams, requests] = await Promise.all([
      component("webuntis", () => getUntis(dayText)),
      component("google-calendar", () => getCalendar(day)),
      component("weather", () => getWeather(day)),
      component("iserv-exams", () => getExams(dayText)),
      component("requests", () => getRequestCounts()),
    ]);

    const timetable = untis.ok ? pickTimetable(untis.data) : [];
    const lessons = timetable.map(lessonView);
    const homework = (untis.ok ? pickHomework(untis.data, timetable) : []).map(homeworkView).filter((h) => h.text);

    const errors = {};
    for (const c of [untis, calendar, weather, exams, requests]) if (!c.ok) errors[c.name] = c.error;

    return json({
      date: dayText,
      dateLabel: dayLabel(day),
      generatedAt: new Date().toISOString(),
      weather: weather.ok ? weather.data : null,
      changes: lessons.filter((l) => l.cancelled || l.changed),
      lessons,
      homework,
      exams: exams.ok ? exams.data : [],
      calendar: calendar.ok ? calendar.data : [],
      requests: requests.ok ? requests.data : null,
      errors,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 400);
  }
});
