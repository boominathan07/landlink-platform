const StatCard = ({ label, value, icon: Icon, color = 'default', trend, onClick }) => {
  const colors = {
    default: { bg: 'bg-white', text: 'text-[#2C2C2A]', icon: 'bg-[#F8F7F4] text-[#5F5E5A]' },
    green:   { bg: 'bg-white', text: 'text-[#1D9E75]', icon: 'bg-[#E1F5EE] text-[#0F6E56]' },
    amber:   { bg: 'bg-white', text: 'text-[#BA7517]', icon: 'bg-[#FAEEDA] text-[#BA7517]' },
    blue:    { bg: 'bg-white', text: 'text-[#185FA5]', icon: 'bg-[#E6F1FB] text-[#185FA5]' },
    purple:  { bg: 'bg-white', text: 'text-[#534AB7]', icon: 'bg-[#EEEDFE] text-[#534AB7]' },
  };
  const c = colors[color] || colors.default;

  return (
    <div
      onClick={onClick}
      className={`${c.bg} border border-[#D3D1C7] rounded-xl p-5 shadow-card
        hover:shadow-card-hover transition-all duration-200
        ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-[#5F5E5A] uppercase tracking-wide">{label}</p>
        {Icon && (
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.icon}`}>
            <Icon size={16} />
          </div>
        )}
      </div>
      <p className={`text-2xl font-semibold ${c.text}`}>{value}</p>
      {trend && (
        <p className="text-xs text-[#5F5E5A] mt-1">{trend}</p>
      )}
    </div>
  );
};
export default StatCard;
