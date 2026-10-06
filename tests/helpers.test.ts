import { describe, expect, it } from "vitest";
import { approximatePoint, formatDistance, haversineM } from "@/lib/geo";
import { isToday, nextMonth } from "@/lib/celebrations";
import { toCsv } from "@/lib/csv";
import { normalizePhone, parseLoginId, parseLooseDate, whatsappLink } from "@/lib/format";
import { pageFromParam, pageHref, paginate } from "@/lib/pagination";
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

  it("measures distances in metres (Near me)", () => {
    // ~111 m per 0.001 degree of latitude.
    const shop = { lat: 9.9195, lng: 78.1193 };
    expect(haversineM(shop, { lat: shop.lat + 0.001, lng: shop.lng })).toBeCloseTo(111.2, 0);
  });

  it("formats distances for people", () => {
    expect(formatDistance(64)).toBe("60 m");
    expect(formatDistance(3240)).toBe("3.2 km");
    expect(formatDistance(18_400)).toBe("18 km");
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

describe("pagination", () => {
  it("reads ?page= safely and clamps to the last page", () => {
    expect(pageFromParam(undefined)).toBe(1);
    expect(pageFromParam("3")).toBe(3);
    expect(pageFromParam(["2", "5"])).toBe(2);
    expect(pageFromParam("-1")).toBe(1);
    expect(pageFromParam("abc")).toBe(1);
    expect(paginate(9, 45, 20)).toEqual({ page: 3, pageCount: 3, offset: 40 });
    expect(paginate(1, 0, 20)).toEqual({ page: 1, pageCount: 1, offset: 0 });
  });

  it("keeps filters in page links and drops page=1", () => {
    expect(pageHref("/admin/audit", { f: "role" }, 2)).toBe("/admin/audit?f=role&page=2");
    expect(pageHref("/admin/audit", { f: undefined }, 1)).toBe("/admin/audit");
  });
});

describe("celebrations", () => {
  const birthday = (month: number, day: number) =>
    ({ memberId: "m", name: "A", photoUrl: null, kind: "birthday", month, day }) as const;

  it("knows today's celebrations, including 29 February in other years", () => {
    expect(isToday(birthday(10, 6), { year: 2026, month: 10, day: 6 })).toBe(true);
    expect(isToday(birthday(10, 7), { year: 2026, month: 10, day: 6 })).toBe(false);
    expect(isToday(birthday(2, 29), { year: 2026, month: 2, day: 28 })).toBe(true);
    expect(isToday(birthday(2, 29), { year: 2028, month: 2, day: 28 })).toBe(false);
    expect(nextMonth(12)).toBe(1);
    expect(nextMonth(10)).toBe(11);
  });
});
