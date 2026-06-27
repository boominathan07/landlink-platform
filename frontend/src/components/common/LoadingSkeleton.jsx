const Skeleton = ({ className }) => (
  <div className={`bg-[#E8E7E3] rounded animate-pulse ${className}`} />
);

export const StatCardSkeleton = () => (
  <div className="bg-white border border-[#D3D1C7] rounded-xl p-5 shadow-card">
    <Skeleton className="h-3 w-20 mb-3" />
    <Skeleton className="h-7 w-16" />
  </div>
);

export const ProjectCardSkeleton = () => (
  <div className="bg-white border border-[#D3D1C7] rounded-xl p-5 shadow-card">
    <Skeleton className="h-5 w-32 mb-2" />
    <Skeleton className="h-3 w-24 mb-4" />
    <Skeleton className="h-1.5 w-full mb-3" />
    <div className="flex gap-2">
      <Skeleton className="h-5 w-20 rounded-full" />
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
  </div>
);

export const PlotGridSkeleton = ({ count = 35 }) => (
  <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(8, minmax(0, 1fr))' }}>
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton key={i} className="aspect-square rounded" />
    ))}
  </div>
);

export const TableRowSkeleton = ({ cols = 5 }) => (
  <tr>
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <Skeleton className="h-4 w-full" />
      </td>
    ))}
  </tr>
);

export default Skeleton;
