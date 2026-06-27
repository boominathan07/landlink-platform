export const STATUS_LABELS = {
  available: 'Available',
  booked: 'Booked',
  sold: 'Sold',
  hold: 'On Hold',
  not_for_sale: 'N/A',
};

function parseNumeric(val) {
  if (val == null || val === '') return null;
  const num = Number(val);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function pickMeterValue(plot, keys) {
  for (const key of keys) {
    const val = parseNumeric(plot[key]);
    if (val != null) return val;
  }
  const dims = plot.dimensions || plot.size || plot.measurements;
  if (dims && typeof dims === 'object') {
    for (const key of keys) {
      const val = parseNumeric(dims[key]);
      if (val != null) return val;
    }
  }
  return null;
}

function fmtMeters(val) {
  return val != null ? `${Number(val).toFixed(2)} m` : '—';
}

export function getPlotTooltipMetrics(plot) {
  if (!plot) {
    return {
      plotNumber: '—',
      width: '—',
      length: '—',
      areaSqM: '—',
      areaSqFt: '—',
      cent: '—',
      status: 'Available',
    };
  }

  const widthKeys = ['widthMeters', 'width_meters', 'width_m', 'widthM', 'width', 'Width', 'w'];
  const lengthKeys = ['lengthMeters', 'length_meters', 'length_m', 'lengthM', 'length', 'Length', 'l', 'h'];

  let widthM = pickMeterValue(plot, widthKeys);
  let lengthM = pickMeterValue(plot, lengthKeys);

  const cent = plot.cents ?? plot.cent ?? null;
  let areaSqM =
    parseNumeric(plot.areaSqMeters) ??
    parseNumeric(plot.area_sqm) ??
    null;
  let areaSqFt =
    parseNumeric(plot.areaSqFeet) ??
    parseNumeric(plot.areaSqft) ??
    parseNumeric(plot.area) ??
    null;

  if (areaSqM == null && areaSqFt != null) {
    areaSqM = Number((areaSqFt / 10.7639).toFixed(2));
  }
  if (areaSqFt == null && areaSqM != null) {
    areaSqFt = Number((areaSqM * 10.7639).toFixed(2));
  }
  if (areaSqFt == null && cent != null) {
    areaSqFt = Number((cent * 435.6).toFixed(2));
  }
  if (areaSqM == null && areaSqFt != null) {
    areaSqM = Number((areaSqFt / 10.7639).toFixed(2));
  }

  if (widthM == null && lengthM != null && areaSqM != null) {
    widthM = Number((areaSqM / lengthM).toFixed(2));
  }
  if (lengthM == null && widthM != null && areaSqM != null) {
    lengthM = Number((areaSqM / widthM).toFixed(2));
  }
  if (widthM == null && lengthM == null && areaSqM != null) {
    const side = Math.sqrt(areaSqM);
    widthM = Number(side.toFixed(2));
    lengthM = Number(side.toFixed(2));
  }

  return {
    plotNumber: plot.plotNumber,
    width: fmtMeters(widthM),
    length: fmtMeters(lengthM),
    areaSqM: areaSqM != null ? `${Number(areaSqM).toFixed(2)} Sq.Mtr` : '—',
    areaSqFt: areaSqFt != null ? `${Number(areaSqFt).toFixed(2)} Sq.Ft` : '—',
    cent: cent != null ? Number(cent).toFixed(2) : '—',
    status: STATUS_LABELS[plot.status] || plot.status || 'Available',
  };
}

export const PLOT_STATUS = {
  available: {
    bg: 'var(--primary-light)',
    text: 'var(--primary-dark)',
    border: 'var(--primary)',
    label: 'Available',
  },
  booked: {
    bg: 'var(--amber-light)',
    text: 'var(--amber)',
    border: 'var(--amber)',
    label: 'Booked',
  },
  sold: {
    bg: 'var(--red-light)',
    text: 'var(--red)',
    border: 'var(--red)',
    label: 'Sold',
  },
  hold: {
    bg: 'var(--purple-light)',
    text: 'var(--purple)',
    border: 'var(--purple)',
    label: 'On Hold',
  },
  selected: {
    bg: 'var(--primary)',
    text: '#FFFFFF',
    border: 'var(--primary)',
    label: 'Selected',
  },
  not_for_sale: {
    bg: 'rgba(148, 163, 184, 0.12)',
    text: 'var(--muted)',
    border: 'var(--muted)',
    label: 'Not For Sale',
  },
}

export const getPlotFill = (status, selected = false) => {
  if (selected) return PLOT_STATUS.selected
  return PLOT_STATUS[status] || PLOT_STATUS.available
}
