-- DropIndex
DROP INDEX "workflow_states_teamId_name_key";

-- AlterTable
ALTER TABLE "workflow_states" ADD COLUMN     "projectId" TEXT;

-- AddForeignKey
ALTER TABLE "workflow_states" ADD CONSTRAINT "workflow_states_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
