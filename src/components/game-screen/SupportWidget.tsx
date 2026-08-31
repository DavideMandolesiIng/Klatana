import React, { useState, useRef, useEffect } from 'react';
import { Heart, X, HandHeart } from 'lucide-react';

interface SupportWidgetProps {
    className?: string;
    compact?: boolean;
}

export const SupportWidget: React.FC<SupportWidgetProps> = ({ className = '', compact = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const widgetRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (widgetRef.current && !widgetRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div ref={widgetRef} className={`relative pointer-events-auto ${className}`}>
            <button
                onClick={() => setIsOpen(prev => !prev)}
                className="px-2.5 py-1 md:px-3 md:py-1.5 bg-[#d15431]/90 hover:bg-[#e05b36] text-[#fdf7e1] backdrop-blur rounded-lg text-[10px] md:text-xs font-bold shadow-lg border-2 border-[#5e1e0c] hover:scale-105 active:scale-95 transition-all flex items-center gap-1 md:gap-1.5 cursor-pointer whitespace-nowrap"
                title="Support Klatana"
            >
                <Heart className="w-3.5 h-3.5 fill-current text-[#fdf7e1] animate-pulse shrink-0" />
                <span className="uppercase tracking-wider">
                    {compact ? 'Support' : 'Support Klatana'}
                </span>
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 z-[100] bg-[#f4e6cd] border-2 border-[#d3be9a] rounded-xl p-4 shadow-[0_10px_25px_rgba(0,0,0,0.5),inset_0_2px_4px_rgba(255,255,255,0.4)] w-72 flex flex-col gap-3 transition-all duration-300 text-left">
                    <div className="flex justify-between items-start">
                        <h3 className="text-[#2c1d10] font-black uppercase text-sm drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)] flex items-center gap-2">
                            <HandHeart className="w-5 h-5 text-[#d15431]" />
                            Support Klatana
                        </h3>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-[#865913] hover:text-[#d15431] transition-colors p-1 cursor-pointer"
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
                        onClick={() => setIsOpen(false)}
                    >
                        <Heart className="w-4 h-4 fill-current drop-shadow-md" />
                        <span className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]">Support via PayPal</span>
                    </a>
                </div>
            )}
        </div>
    );
};
