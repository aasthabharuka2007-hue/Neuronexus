export function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="aspect-video bg-slate-200 dark:bg-slate-800" />
      <div className="space-y-3 p-4">
        <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800/80" />
        <div className="h-3 w-5/6 rounded bg-slate-100 dark:bg-slate-800/80" />
        <div className="flex gap-2 pt-2">
          <div className="h-9 flex-1 rounded-xl bg-slate-200 dark:bg-slate-800" />
          <div className="h-9 flex-1 rounded-xl bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>
    </div>
  )
}
