/** Route-level loading state for the authenticated area. */
export default function AppLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="skeleton h-4 w-32 rounded" />
        <div className="skeleton h-7 w-64 rounded" />
      </div>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="skeleton h-72 rounded-2xl lg:col-span-2" />
        <div className="skeleton h-72 rounded-2xl" />
      </div>
    </div>
  );
}
