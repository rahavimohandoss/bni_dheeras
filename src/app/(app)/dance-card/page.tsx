import { DownloadIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MemberAvatar } from "@/components/member-avatar";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { loadDanceCard } from "@/lib/dance-card-data";
import { requireMember } from "@/lib/session";
import { formatDateTime } from "@/lib/time";
import { DanceCardForm } from "./dance-card-form";

export const metadata: Metadata = { title: "My dance card" };

export default async function MyDanceCardPage() {
  const me = await requireMember();
  const card = await loadDanceCard(me.id);
  if (!card) notFound();
  return (
    <PageContainer>
      <PageHeader
        title="My 1-to-1 dance card"
        description={
          card.updatedAt
            ? `Last saved ${formatDateTime(card.updatedAt)}. Other members can view it before a 1-to-1.`
            : "Fill it in once; other members can view it before a 1-to-1."
        }
        actions={
          <Button asChild variant="outline">
            <a href={`/api/dance-card/${me.id}/pdf`}>
              <DownloadIcon /> Download PDF
            </a>
          </Button>
        }
      />
      <Card className="mb-4">
        <CardContent className="flex items-center gap-4 py-4">
          <MemberAvatar name={card.member.name} src={card.member.photoUrl} className="size-14" />
          <div className="text-sm">
            <div className="text-base font-semibold">{card.member.name}</div>
            <div>
              {card.member.business}
              {card.member.category ? ` · ${card.member.category}` : ""}
            </div>
            <div className="text-muted-foreground">
              {[card.member.phone, card.member.email].filter(Boolean).join(" · ")}
            </div>
          </div>
        </CardContent>
      </Card>
      <DanceCardForm template={card.template} initial={card.data} />
    </PageContainer>
  );
}
