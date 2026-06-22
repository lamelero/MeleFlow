export function TaskSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
      <div className="flex items-start gap-3">
        <div className="mt-1 h-4 w-4 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="flex-1 space-y-2.5">
          <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-1/2 rounded bg-gray-100 dark:bg-gray-800" />
        </div>
        <div className="h-6 w-6 rounded-lg bg-gray-100 dark:bg-gray-800" />
      </div>
    </div>
  );
}

export function HabitsGridSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gray-200 dark:bg-gray-700" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-3 w-1/3 rounded bg-gray-100 dark:bg-gray-800" />
            </div>
          </div>
          <div className="flex justify-center gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <div key={d} className="h-8 w-8 rounded-lg bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function TimerSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-12">
      <div className="h-32 w-32 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
      <div className="h-4 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      <div className="flex gap-3">
        <div className="h-10 w-28 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-700" />
        <div className="h-10 w-28 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
      </div>
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
          <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-3 w-1/4 rounded bg-gray-100 dark:bg-gray-800" />
          </div>
          <div className="h-6 w-16 rounded-lg bg-gray-100 dark:bg-gray-800" />
        </div>
      ))}
    </div>
  );
}
