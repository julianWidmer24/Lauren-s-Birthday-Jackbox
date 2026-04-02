'use client';

import { useRouter } from 'next/navigation';
import FloralDecor from '@/components/shared/FloralDecor';

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <FloralDecor variant="full" />

      <div className="text-center max-w-md w-full space-y-8 relative z-10">
        <div>
          <p className="text-3xl mb-2 select-none">{'\u{1F33F}\u{1F43E}\u{1F338}'}</p>
          <h1 className="text-5xl font-black mb-2 bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent leading-tight">
            Lit Games for Lauren
          </h1>
          <p className="text-primary-200/80 text-lg">{`Cozy multiplayer fun \u{1F43F}\u{FE0F}`}</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => router.push('/host')}
            className="btn-primary w-full text-xl py-4"
          >
            {'\u{1F33B}'} Host a Game
          </button>

          <button
            onClick={() => router.push('/play')}
            className="btn-secondary w-full text-xl py-4"
          >
            {'\u{1F344}'} Join a Game
          </button>
        </div>

        <p className="text-primary-300/50 text-sm">
          {`One screen hosts. Phones are controllers. \u{1F33E}`}
        </p>
      </div>
    </div>
  );
}
