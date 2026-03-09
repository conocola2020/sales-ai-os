export default function DashboardLoading() {
  return (
    <div className="px-8 pt-8 pb-4 animate-pulse">
      <div className="h-8 w-48 bg-gray-800 rounded-lg mb-2" />
      <div className="h-4 w-32 bg-gray-800/60 rounded mb-8" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-gray-900 border border-gray-800 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 bg-gray-900 border border-gray-800 rounded-2xl" />
        <div className="h-64 bg-gray-900 border border-gray-800 rounded-2xl" />
      </div>
    </div>
  )
}
