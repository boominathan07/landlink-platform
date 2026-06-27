const calculateCommission = (totalAmount, commissionPercent) => {
  return Math.round((totalAmount * commissionPercent) / 100);
};

const calculateOwnerShares = (owners, netAmount) => {
  return owners
    .filter((o) => o.status === 'active')
    .map((o) => ({
      userId: o.userId,
      ownershipPercent: o.ownershipPercent,
      share: Math.round((netAmount * o.ownershipPercent) / 100),
    }));
};

module.exports = { calculateCommission, calculateOwnerShares };
