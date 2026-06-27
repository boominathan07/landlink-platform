export default function AnimatedBackground() {
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        overflow: 'hidden',
        background: 'var(--bg-primary, #050816)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '20%',
          left: '10%',
          width: 600,
          height: 600,
          background: 'radial-gradient(circle, rgba(79,142,247,0.12) 0%, transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(40px)',
          animation: 'pulse 8s ease-in-out infinite',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '20%',
          right: '10%',
          width: 500,
          height: 500,
          background: 'radial-gradient(circle, rgba(123,94,167,0.1) 0%, transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(40px)',
          animation: 'pulse 10s ease-in-out infinite 2s',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(rgba(79,142,247,0.03) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(79,142,247,0.03) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />
    </div>
  );
}
