import React from 'react';
import { ArrowLeft, Sparkles, History, CheckCircle2, Wrench, ShieldAlert } from 'lucide-react';
import { APP_VERSION, CHANGELOG_HISTORY } from '../version';
import wavesBg from '/assets/textures/waves-background.webp?url';

interface ChangelogProps {
  onBack: () => void;
}

export const Changelog: React.FC<ChangelogProps> = ({ onBack }) => {
  return (
    <div
      className="min-h-screen bg-[#2c7873] text-[#3b2a1a] p-4 selection:bg-[#a37941]/30 font-sans"
      style={{
        backgroundImage: `url(${wavesBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="max-w-3xl mx-auto bg-gradient-to-br from-[#fcf7ec] to-[#e4cdad] rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.5)] overflow-hidden border-4 border-[#a37941] my-4 md:my-8">
        {/* Header */}
        <div className="p-4 md:p-6 border-b-2 border-[#d3be9a] bg-gradient-to-b from-[#ffffff] to-[#f4e6cd] sticky top-0 backdrop-blur-sm z-10 flex items-center justify-between shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
          <div className="flex items-center space-x-3">
            <History className="w-7 h-7 md:w-8 md:h-8 text-[#a37941]" />
            <div>
              <h1 className="text-xl md:text-2xl font-black text-[#2c1d10] tracking-wide">
                Changelog
              </h1>
              <span className="text-xs font-bold text-[#865913]">
                Current: <span className="text-[#2c773e] font-black">{APP_VERSION}</span>
              </span>
            </div>
          </div>
          <button
            onClick={onBack}
            className="flex items-center space-x-2 text-[#865913] hover:text-[#a37941] transition-colors font-bold px-3 py-1.5 rounded-lg border-2 border-[#d3be9a] bg-[#f8efe0] hover:bg-[#ede0c6] active:scale-95"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">Back to Menu</span>
          </button>
        </div>

        {/* Releases List */}
        <div className="p-4 md:p-8 space-y-6">
          {CHANGELOG_HISTORY.map((release) => (
            <div
              key={release.version}
              className="bg-[#f7eedc] border-2 border-[#d3be9a] rounded-xl p-5 md:p-6 shadow-[inset_0_2px_4px_rgba(0,0,0,0.04),0_4px_10px_rgba(0,0,0,0.06)]"
            >
              {/* Release Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#dec59f] pb-3 mb-4">
                <div className="flex items-center gap-3">
                  <span className="bg-[#2f8a43] text-[#f7efd8] text-sm md:text-base font-black px-3 py-1 rounded-lg border border-[#175225] shadow-sm tracking-wider">
                    {release.version}
                  </span>
                  <h2 className="text-lg md:text-xl font-black text-[#2c1d10]">
                    {release.title}
                  </h2>
                </div>
                <span className="text-xs font-bold text-[#7d6549] uppercase tracking-wider">
                  {release.date}
                </span>
              </div>

              {release.description && (
                <p className="text-sm text-[#5c4936] font-medium mb-4 leading-relaxed">
                  {release.description}
                </p>
              )}

              {/* Changes List */}
              <div className="space-y-2">
                {release.changes.map((change, idx) => {
                  let badgeColor = 'bg-[#408a55] text-white border-[#27663a]';
                  let label = 'Feature';
                  let Icon = Sparkles;

                  if (change.type === 'improvement') {
                    badgeColor = 'bg-[#b8862d] text-white border-[#845b14]';
                    label = 'Improvement';
                    Icon = CheckCircle2;
                  } else if (change.type === 'fix') {
                    badgeColor = 'bg-[#c2412b] text-white border-[#8a2412]';
                    label = 'Fix';
                    Icon = Wrench;
                  } else if (change.type === 'balance') {
                    badgeColor = 'bg-[#4a6bb3] text-white border-[#2c4785]';
                    label = 'Balance';
                    Icon = ShieldAlert;
                  }

                  return (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 text-xs md:text-sm text-[#3b2a1a] bg-[#fbf6ed] p-2.5 rounded-lg border border-[#e4d3b6]"
                    >
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border flex-shrink-0 ${badgeColor}`}
                      >
                        <Icon className="w-3 h-3" />
                        {label}
                      </span>
                      <span className="font-semibold leading-relaxed pt-0.5">
                        {change.text}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gradient-to-b from-[#ede0c6] to-[#dfcda2] border-t-2 border-[#d3be9a] text-center">
          <p className="text-[11px] text-[#63503b] font-semibold">
            Klatana &bull; Version tracking system
          </p>
        </div>
      </div>
    </div>
  );
};
