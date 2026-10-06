import { DownloadIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { MemberAvatar } from "@/components/member-avatar";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DANCE_CARD } from "@/lib/dance-card";
import { loadDanceCard } from "@/lib/dance-card-data";
import { requireMember } from "@/lib/session";

export const metadata: Metadata = { title: "Dance card" };

export default async function MemberDanceCardPage({ params }: PageProps<"/dance-card/[id]">) {
  const me = await requireMember();
  const { id } = await params;
  if (id === me.id) redirect("/dance-card");
  const card = await loadDanceCard(id);
  if (!card) notFound();
  const sections = DANCE_CARD.map((s) => ({
    ...s,
    groups: s.groups
      .map((g) => ({ ...g, fields: g.fields.filter((f) => card.answers[f.key]) }))
      .filter((g) => g.fields.length),
  })).filter((s) => s.groups.length);

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
      {card.updatedAt ? null : (
        <p className="mb-4 text-sm text-muted-foreground">{card.member.name} hasn&apos;t filled in their dance card yet.</p>
      )}
      <div className="space-y-4">
        {sections.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle className="text-base font-bold tracking-wide text-primary uppercase">{section.title}</CardTitle>
              {section.note ? <CardDescription className="italic">({section.note})</CardDescription> : null}
            </CardHeader>
            <CardContent className="space-y-4">
              {section.groups.map((group, i) => (
                <div key={group.title ?? i} className="space-y-2">
                  {group.title ? <h3 className="text-sm font-bold">{group.title}:</h3> : null}
                  {group.fields.map((f) =>
                    f.kind === "numbered" ? (
                      <div key={f.key} className="flex gap-2 text-sm">
                        <span className="w-6 shrink-0 text-right text-muted-foreground">{f.label}</span>
                        <span>{card.answers[f.key]}</span>
                      </div>
                    ) : (
                      <div key={f.key}>
                        <div className="text-xs font-medium text-muted-foreground">{f.label}</div>
                        <div className="text-sm">{card.answers[f.key]}</div>
                      </div>
                    ),
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
