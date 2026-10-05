import { DownloadIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { MemberAvatar } from "@/components/member-avatar";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadDanceCard } from "@/lib/dance-card-data";
import { requireMember } from "@/lib/session";

export const metadata: Metadata = { title: "Dance card" };

export default async function MemberDanceCardPage({ params }: PageProps<"/dance-card/[id]">) {
  const me = await requireMember();
  const { id } = await params;
  if (id === me.id) redirect("/dance-card");
  const card = await loadDanceCard(id);
  if (!card) notFound();
  const filled = card.template.sections
    .map((s) => ({ ...s, fields: s.fields.filter((f) => card.data[f.key]) }))
    .filter((s) => s.fields.length);

  return (
    <PageContainer>
      <PageHeader
        title={`${card.member.name}'s dance card`}
        back={{ href: `/members/${id}`, label: card.member.name }}
        actions={
          <Button asChild variant="outline">
            <a href={`/api/dance-card/${id}/pdf`}>
              <DownloadIcon /> PDF
            </a>
          </Button>
        }
      />
      <Card className="mb-4">
        <CardContent className="flex items-center gap-4 py-4">
          <MemberAvatar name={card.member.name} src={card.member.photoUrl} className="size-14" />
          <div className="text-sm">
            <div className="text-base font-semibold">{card.member.business}</div>
            <div className="text-muted-foreground">{card.member.category}</div>
          </div>
        </CardContent>
      </Card>
      {filled.length === 0 ? (
        <p className="text-sm text-muted-foreground">{card.member.name} hasn&apos;t filled in their dance card yet.</p>
      ) : (
        <div className="space-y-4">
          {filled.map((s) => (
            <Card key={s.title}>
              <CardHeader>
                <CardTitle className="text-base">{s.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {s.fields.map((f) => (
                  <div key={f.key}>
                    <div className="text-xs font-medium text-muted-foreground">{f.label}</div>
                    <div className="text-sm whitespace-pre-line">{card.data[f.key]}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
