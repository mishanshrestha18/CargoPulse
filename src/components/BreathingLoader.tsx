export default function BreathingLoader({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className={`${sizeClasses[size]} relative`}>
        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full border-4 border-blue-200 dark:border-blue-800 animate-[breathe_2s_ease-in-out_infinite]" />

        {/* Middle ring */}
        <div className="absolute inset-2 rounded-full border-4 border-blue-400 dark:border-blue-600 animate-[breathe_2s_ease-in-out_infinite_0.3s]" />

        {/* Inner circle */}
        <div className="absolute inset-4 rounded-full bg-blue-600 dark:bg-blue-500 animate-[breathe_2s_ease-in-out_infinite_0.6s]" />
      </div>

      <style jsx>{`
        @keyframes breathe {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(0.85);
            opacity: 0.6;
          }
        }
      `}</style>
    </div>
  );
}
