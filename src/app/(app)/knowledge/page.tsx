import { requireUser } from "@/lib/auth";
import { can } from "@/lib/iam";
import { documentService } from "@/services/document-service";
import { KnowledgeWorkbench } from "@/components/knowledge/workbench";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const user = await requireUser();
  const documents = await documentService.list(user);
  return (
    <KnowledgeWorkbench
      documents={documents.map((d) => ({
        id: d.id,
        title: d.title,
        documentType: d.documentType,
        status: d.status,
        chunkCount: d.chunkCount,
      }))}
      canWriteFiles={can(user, "documents.write")}
      canDeleteFiles={can(user, "documents.delete")}
    />
  );
}
