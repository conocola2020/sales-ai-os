export default function Loading() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-8 bg-gray-800 rounded-xl w-48" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-28 bg-gray-900 rounded-2xl border border-gray-800" />
        ))}
      </div>
      <div className="h-64 bg-gray-900 rounded-2xl border border-gray-800" />
    </div>
  )
}
