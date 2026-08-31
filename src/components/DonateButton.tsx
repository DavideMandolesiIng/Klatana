import React, { useState } from 'react';
import { Heart, X, HandHeart } from 'lucide-react';

export const DonateButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 md:bottom-6 md:left-6 z-[100] bg-[#d15431] text-[#fdf7e1] p-3 rounded-full shadow-lg border-2 border-[#5e1e0c] hover:bg-[#e05b36] hover:scale-105 active:scale-95 transition-all flex items-center justify-center animate-bounce"
        title="Support the project"
      >
        <Heart className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 md:bottom-6 md:left-6 z-[100] bg-[#f4e6cd] border-2 border-[#d3be9a] rounded-xl p-4 shadow-[0_10px_25px_rgba(0,0,0,0.5),inset_0_2px_4px_rgba(255,255,255,0.4)] w-72 flex flex-col gap-3 transition-all duration-300">
      <div className="flex justify-between items-start">
        <h3 className="text-[#2c1d10] font-black uppercase text-sm drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)] flex items-center gap-2">
          <HandHeart className="w-5 h-5 text-[#d15431]" />
          Support Klatana
        </h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-[#865913] hover:text-[#d15431] transition-colors p-1"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <p className="text-xs text-[#63503b] font-semibold leading-relaxed">
        I work hard to independently create and maintain Klatana, so that everyone can play it for free.
      </p>
      <p className="text-xs text-[#63503b] font-semibold leading-relaxed">
        If you enjoy it, consider making a donation to support the project via PayPal!
      </p>

      <a
        href="https://paypal.me/davidemandolesi"
        target="_blank"
        rel="noopener noreferrer"
        className="w-full bg-gradient-to-b from-[#3ca956] via-[#2f8a43] to-[#1c552a] hover:from-[#4ac565] hover:to-[#226834] border-t border-[#64dc7f] border-b-[4px] border-[#113118] text-[#f7efd8] font-bold py-2.5 px-4 rounded-lg shadow-[0_4px_6px_rgba(0,0,0,0.3)] transition-transform active:translate-y-[2px] active:border-b-[2px] active:mb-[2px] flex items-center justify-center gap-2"
        onClick={() => setIsOpen(false)} // Optionally auto-close on click
      >
        <Heart className="w-4 h-4 fill-current drop-shadow-md" />
        <span className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]">Support via PayPal</span>
      </a>
    </div>
  );
};
