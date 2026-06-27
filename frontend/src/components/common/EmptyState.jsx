const EmptyState = ({ icon: Icon, title, description, action, actionLabel }) => (
  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
    <div className="w-14 h-14 bg-[#F8F7F4] border border-[#D3D1C7] rounded-2xl flex items-center justify-center mb-4">
      {Icon && <Icon size={24} className="text-[#5F5E5A]" />}
    </div>
    <h3 className="text-base font-semibold text-[#2C2C2A] mb-1">{title}</h3>
    <p className="text-sm text-[#5F5E5A] mb-5 max-w-xs">{description}</p>
    {action && (
      <button
        onClick={action}
        className="bg-[#1D9E75] hover:bg-[#0F6E56] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        {actionLabel}
      </button>
    )}
  </div>
);
export default EmptyState;
