export default function LeadsLoading() {
  return (
    <div className="px-8 pt-8 pb-4 animate-pulse">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-7 w-40 bg-gray-800 rounded-lg mb-2" />
          <div className="h-4 w-24 bg-gray-800/60 rounded" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-36 bg-gray-800 rounded-xl" />
          <div className="h-10 w-28 bg-gray-800 rounded-xl" />
        </div>
      </div>
      <div className="flex gap-3 mb-4">
        <div className="h-10 flex-1 bg-gray-800 rounded-xl" />
        <div className="h-10 w-32 bg-gray-800 rounded-xl" />
        <div className="h-10 w-32 bg-gray-800 rounded-xl" />
      </div>
      <div className="space-y-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-900 border border-gray-800 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
