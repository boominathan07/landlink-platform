export const fadeUpVariant = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] } },
};

export const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

export const cardVariant = {
  hidden: { opacity: 0, y: 40, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: 'easeOut' } },
};

export const glowPulse = {
  initial: { boxShadow: '0 0 0 rgba(79,142,247,0)' },
  animate: {
    boxShadow: [
      '0 0 0 rgba(79,142,247,0)',
      '0 0 30px rgba(79,142,247,0.4)',
      '0 0 0 rgba(79,142,247,0)',
    ],
    transition: { duration: 2, repeat: Infinity },
  },
};

export const modalVariant = {
  hidden: { opacity: 0, scale: 0.88, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 340, damping: 28 } },
  exit: { opacity: 0, scale: 0.92, y: 10, transition: { duration: 0.2 } },
};
