const StatusBadge = ({ status }) => {
  const config = {
    available:    { bg: '#E1F5EE', text: '#0F6E56', label: 'Available' },
    booked:       { bg: '#FAEEDA', text: '#BA7517', label: 'Booked' },
    sold:         { bg: '#D3D1C7', text: '#444441', label: 'Sold' },
    hold:         { bg: '#EEEDFE', text: '#534AB7', label: 'On Hold' },
    not_for_sale: { bg: '#F8F7F4', text: '#D3D1C7', label: 'Not for Sale' },
    active:       { bg: '#E1F5EE', text: '#0F6E56', label: 'Active' },
    pending:      { bg: '#FAEEDA', text: '#BA7517', label: 'Pending' },
    approved:     { bg: '#E1F5EE', text: '#0F6E56', label: 'Approved' },
    rejected:     { bg: '#FCEBEB', text: '#A32D2D', label: 'Rejected' },
    completed:    { bg: '#E6F1FB', text: '#185FA5', label: 'Completed' },
    invited:      { bg: '#FAEEDA', text: '#BA7517', label: 'Invited' },
    revoked:      { bg: '#F8F7F4', text: '#D3D1C7', label: 'Revoked' },
  };
  const c = config[status] || config.active;
  return (
    <span
      style={{ background: c.bg, color: c.text }}
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
    >
      {c.label}
    </span>
  );
};
export default StatusBadge;
