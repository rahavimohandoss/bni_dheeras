import { describe, expect, it } from "vitest";
import type { FormField } from "@/db/schema";
import { approximatePoint, formatDistance, haversineM } from "@/lib/attendance/geo";
import { toCsv } from "@/lib/csv";
import { normalizePhone, parseLoginId, parseLooseDate, whatsappLink } from "@/lib/format";
import { validateAnswers } from "@/lib/forms";
import { CAPABILITIES, ROLE_KEYS, capabilitiesFor, capsCover, hasFullAccess, roleConflict } from "@/lib/permissions";
import { istToDate, startOfIstDay, toIstDateInput, toIstTimeInput } from "@/lib/time";
import { youtubeEmbedUrl } from "@/lib/video";

describe("IST time helpers", () => {
  it("converts IST wall-clock time to UTC and back", () => {
    const d = istToDate("2026-10-08", "07:00");
    expect(d.toISOString()).toBe("2026-10-08T01:30:00.000Z");
    expect(toIstDateInput(d)).toBe("2026-10-08");
    expect(toIstTimeInput(d)).toBe("07:00");
  });

  it("uses the IST calendar day, not UTC's", () => {
    const lateNight = new Date("2026-10-07T20:00:00Z"); // 01:30 IST on the 8th
    expect(toIstDateInput(lateNight)).toBe("2026-10-08");
    expect(startOfIstDay(lateNight).toISOString()).toBe("2026-10-07T18:30:00.000Z");
  });
});

describe("separation of duties", () => {
  it("blocks one person from approving devices AND doing manual check-ins", () => {
    expect(roleConflict(["lvh", "attendance_coordinator"])).not.toBeNull();
    expect(roleConflict(["lvh_captain", "secretary_treasurer"])).not.toBeNull();
    expect(roleConflict(["lvh", "lvh_captain"])).toBeNull();
    expect(roleConflict(["attendance_coordinator", "membership_committee"])).toBeNull();
  });

  it("admin gets every capability; plain members get none", () => {
    expect(capabilitiesFor([], true).has("settings.manage")).toBe(true);
    expect(capabilitiesFor([], false).size).toBe(0);
    expect(capabilitiesFor(["lvh"], false).has("devices.approve")).toBe(false);
    expect(ROLE_KEYS.length).toBeGreaterThan(5);
  });

  it("the President has exactly the same access as Admin", () => {
    expect(capabilitiesFor(["president"], false)).toEqual(capabilitiesFor([], true));
    expect(capabilitiesFor(["president"], false).size).toBe(CAPABILITIES.length);
    expect(hasFullAccess(["president"], false)).toBe(true);
    expect(hasFullAccess(["vice_president", "secretary_treasurer"], false)).toBe(false);
    // Like Admin, the President is outside the separation-of-duties rule.
    expect(roleConflict(["president"])).toBeNull();
    expect(roleConflict(["president", "lvh", "attendance_coordinator"])).toBeNull();
  });

  it("only lets Head Table reset passwords of people who can't do more than them", () => {
    const vp = capabilitiesFor(["vice_president"], false);
    const secretary = capabilitiesFor(["secretary_treasurer"], false);
    const president = capabilitiesFor(["president"], false);
    expect(vp.has("members.reset_password")).toBe(true);
    expect(secretary.has("members.reset_password")).toBe(true);
    expect(capabilitiesFor(["lvh_captain"], false).has("members.reset_password")).toBe(false);
    expect(capsCover(vp, capabilitiesFor([], false))).toBe(true);
    expect(capsCover(vp, capabilitiesFor(["education_coordinator"], false))).toBe(true);
    expect(capsCover(vp, secretary)).toBe(false);
    expect(capsCover(vp, president)).toBe(false);
    expect(capsCover(secretary, vp)).toBe(true);
    expect(capsCover(secretary, capabilitiesFor([], true))).toBe(false);
    expect(capsCover(president, capabilitiesFor([], true))).toBe(true);
  });
});

describe("login IDs", () => {
  it("accepts a mobile number or an email", () => {
    expect(parseLoginId(" 98400 12345 ")).toEqual({ phone: "+919840012345" });
    expect(parseLoginId("+91 98400-12345")).toEqual({ phone: "+919840012345" });
    expect(parseLoginId("Arun@Dheeras.Test ")).toEqual({ email: "arun@dheeras.test" });
    expect(parseLoginId("")).toBeNull();
    expect(parseLoginId("arun")).toBeNull();
    expect(parseLoginId("12345")).toBeNull();
  });
});

describe("member data helpers", () => {
  it("normalises Indian mobile numbers", () => {
    expect(normalizePhone("98400 12345")).toBe("+919840012345");
    expect(normalizePhone("09840012345")).toBe("+919840012345");
    expect(normalizePhone("+91 98400-12345")).toBe("+919840012345");
    expect(normalizePhone("")).toBeNull();
    expect(whatsappLink("+919840012345")).toBe("https://wa.me/919840012345");
  });

  it("reads BNI-style dates", () => {
    expect(parseLooseDate("2025-01-15")).toBe("2025-01-15");
    expect(parseLooseDate("15/01/2025")).toBe("2025-01-15");
    expect(parseLooseDate("5-1-2025")).toBe("2025-01-05");
    expect(parseLooseDate("31/02/2025")).toBeNull();
    expect(parseLooseDate("Jan 2025")).toBeNull();
  });
});

describe("location privacy", () => {
  it("'area only' moves the pin by at most ~400 m", () => {
    const home = { lat: 9.93127, lng: 78.12133 };
    const shown = approximatePoint(home);
    expect(haversineM(home, shown)).toBeLessThan(400);
    expect(shown).not.toEqual(home);
  });

  it("formats distances for people", () => {
    expect(formatDistance(64)).toBe("60 m");
    expect(formatDistance(3240)).toBe("3.2 km");
    expect(formatDistance(18_400)).toBe("18 km");
  });
});

describe("form answers", () => {
  const fields: FormField[] = [
    { id: "name", type: "short_text", label: "Name", required: true },
    { id: "phone", type: "phone", label: "Phone", required: true },
    { id: "rating", type: "rating", label: "Rating", required: false },
    { id: "join", type: "single_choice", label: "Join?", required: false, options: ["Yes", "No"] },
    { id: "topics", type: "multi_choice", label: "Topics", required: false, options: ["A", "B"] },
  ];

  it("accepts valid answers and drops unknown keys", () => {
    const r = validateAnswers(fields, { name: "Ravi", phone: "98400 12345", rating: "5", join: "Yes", topics: ["A"], extra: "x" });
    expect(r).toEqual({ data: { name: "Ravi", phone: "9840012345", rating: "5", join: "Yes", topics: ["A"] } });
  });

  it("rejects missing required answers and values outside the options", () => {
    expect(validateAnswers(fields, { phone: "9840012345" })).toHaveProperty("error");
    expect(validateAnswers(fields, { name: "R", phone: "9840012345", join: "Maybe" })).toHaveProperty("error");
    expect(validateAnswers(fields, { name: "R", phone: "9840012345", rating: "9" })).toHaveProperty("error");
  });
});

describe("CSV export", () => {
  it("quotes properly and neutralises spreadsheet formulas", () => {
    const csv = toCsv([["Name", "Note"], ["A, B", '=HYPERLINK("x")']]);
    expect(csv).toContain('"A, B"');
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });
});

describe("video links", () => {
  it("embeds YouTube links only", () => {
    expect(youtubeEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(youtubeEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
    expect(youtubeEmbedUrl("https://vimeo.com/123")).toBeNull();
  });
});
