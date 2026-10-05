import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import { loadDanceCard } from "@/lib/dance-card-data";
import { getCurrentMember } from "@/lib/session";
import { formatDate } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// BNI brand: BNI Red header, Granite Grey labels, Helvetica (built into PDF readers).
const RED = "#CF2030";
const GRANITE = "#64666A";
const LIGHT = "#F2F2F2";
const BORDER = "#C8C8C8";

const s = StyleSheet.create({
  page: { paddingBottom: 36, fontFamily: "Helvetica", fontSize: 10, color: "#111111" },
  header: { backgroundColor: RED, color: "#FFFFFF", paddingVertical: 14, paddingHorizontal: 28 },
  brand: { fontSize: 9, letterSpacing: 1.5, fontFamily: "Helvetica-Bold" },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginTop: 2 },
  body: { paddingHorizontal: 28, paddingTop: 16 },
  who: { flexDirection: "row", justifyContent: "space-between", backgroundColor: LIGHT, padding: 12, marginBottom: 14, borderRadius: 4 },
  name: { fontSize: 15, fontFamily: "Helvetica-Bold" },
  muted: { color: GRANITE },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: RED, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 },
  field: { borderBottomWidth: 0.5, borderBottomColor: BORDER, paddingVertical: 5 },
  label: { fontSize: 8, color: GRANITE, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  value: { fontSize: 10, lineHeight: 1.35 },
  footer: { position: "absolute", bottom: 14, left: 28, right: 28, fontSize: 8, color: GRANITE, flexDirection: "row", justifyContent: "space-between" },
});

export async function GET(_req: Request, ctx: RouteContext<"/api/dance-card/[memberId]/pdf">) {
  if (!(await getCurrentMember())) return new Response("Unauthorized", { status: 401 });
  const { memberId } = await ctx.params;
  const card = await loadDanceCard(memberId);
  if (!card) return new Response("Not found", { status: 404 });
  const m = card.member;

  const pdf = await renderToBuffer(
    <Document title={`${m.name} — 1-to-1 Dance Card`} author="BNI Dheeras">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.brand}>BNI DHEERAS · MADURAI</Text>
          <Text style={s.title}>1-to-1 Dance Card</Text>
        </View>
        <View style={s.body}>
          <View style={s.who}>
            <View>
              <Text style={s.name}>{m.name}</Text>
              <Text>{[m.business, m.category].filter(Boolean).join(" · ")}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              {m.phone ? <Text>{m.phone}</Text> : null}
              <Text style={s.muted}>{m.email}</Text>
              {m.website ? <Text style={s.muted}>{m.website.replace(/^https?:\/\//, "")}</Text> : null}
            </View>
          </View>
          {card.template.sections.map((section) => (
            <View key={section.title} style={s.section} wrap={false}>
              <Text style={s.sectionTitle}>{section.title}</Text>
              {section.fields.map((f) => (
                <View key={f.key} style={s.field}>
                  <Text style={s.label}>{f.label}</Text>
                  <Text style={s.value}>{card.data[f.key] || " "}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
        <View style={s.footer} fixed>
          <Text>BNI Dheeras chapter app · Givers Gain®</Text>
          <Text>{formatDate(new Date())}</Text>
        </View>
      </Page>
    </Document>,
  );

  const filename = `dance-card-${m.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
