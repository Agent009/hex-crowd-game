import React from 'react';

export const BoltLogo: React.FC = () => {
  return (
    <div className="fixed top-[8rem] left-4 z-20">
      <a
        href="https://bolt.new/"
        target="_blank"
        rel="noopener noreferrer"
        className="block transition-transform hover:scale-205 active:scale-200"
        title="Powered by Bolt"
      >
        <img
          src="/src/assets/black_circle_360x360.png"
          alt="Bolt"
          className="w-12 h-12 rounded-full shadow-lg border-2 border-white/20 hover:border-white/40 transition-all duration-200"
        />
      </a>
    </div>
  );
};