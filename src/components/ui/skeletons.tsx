import { Skeleton } from "#/components/ui/skeleton"

function IssueListSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-6 w-6 rounded-full" />
        </div>
      ))}
    </div>
  )
}

function IssueBoardSkeleton() {
  return (
    <div className="flex gap-4 p-4">
      {Array.from({ length: 3 }).map((_, col) => (
        <div key={col} className="flex w-72 flex-col gap-2">
          <Skeleton className="mb-2 h-6 w-32" />
          {Array.from({ length: 3 }).map((_, card) => (
            <div key={card} className="rounded-lg border p-3">
              <Skeleton className="mb-2 h-4 w-full" />
              <Skeleton className="h-3 w-3/4" />
              <div className="mt-3 flex items-center gap-2">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="ml-auto h-6 w-6 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function IssueTableSkeleton() {
  return (
    <div className="flex flex-col gap-0">
      <div className="flex items-center gap-4 border-b px-4 py-2">
        <Skeleton className="h-3 w-4" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 flex-1" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b px-4 py-3">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-6 w-6 rounded-full" />
        </div>
      ))}
    </div>
  )
}

function ProjectListSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
          <Skeleton className="h-8 w-8 rounded-md" />
          <div className="flex flex-1 flex-col gap-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      ))}
    </div>
  )
}

function StatCardSkeleton() {
  return (
    <div className="rounded-lg border p-4">
      <Skeleton className="mb-2 h-3 w-20" />
      <Skeleton className="mb-1 h-8 w-16" />
      <Skeleton className="h-3 w-24" />
    </div>
  )
}

function MemberListSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex flex-col gap-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="ml-auto h-6 w-14 rounded-full" />
        </div>
      ))}
    </div>
  )
}

export {
  IssueListSkeleton,
  IssueBoardSkeleton,
  IssueTableSkeleton,
  ProjectListSkeleton,
  StatCardSkeleton,
  MemberListSkeleton,
}
