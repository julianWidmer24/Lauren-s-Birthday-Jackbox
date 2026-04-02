'use client';

interface ConnectionStatusProps {
  isConnected: boolean;
}

export default function ConnectionStatus({ isConnected }: ConnectionStatusProps) {
  if (isConnected) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-red-600/90 text-white text-center py-2 text-sm font-medium z-50 backdrop-blur-sm">
      Reconnecting...
    </div>
  );
}
