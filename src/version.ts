export interface ChangelogRelease {
  version: string;
  date: string;
  title: string;
  description?: string;
  changes: {
    type: 'feature' | 'improvement' | 'fix' | 'balance';
    text: string;
  }[];
}

export const APP_VERSION = 'V00.00.00';
export const APP_VERSION_CODE = '0.0.0';

export const CHANGELOG_HISTORY: ChangelogRelease[] = [
  {
    version: 'V00.00.00',
    date: '31 Agosto 2026',
    title: 'Initial Production Release (Beta)',
    description: 'Prima versione di produzione di Klatana, gioco di strategia da tavolo multiplayer basato su WebRTC e Firebase.',
    changes: [
      { type: 'feature', text: 'Multiplayer P2P tramite WebRTC & PeerJS con supporto Host/Client fino a 4 giocatori.' },
      { type: 'feature', text: 'Generazione procedurale della mappa ad esagoni con risorse bilanciate.' },
      { type: 'feature', text: 'Sistema di costruzione: Strade, Case, Fortezze e Carte Azione.' },
      { type: 'feature', text: 'Commercio dinamico tra giocatori e con la banca/porti marittimi.' },
      { type: 'feature', text: 'Gestione del Ninja (Predone), furto di risorse e controllo del limite carte.' },
      { type: 'feature', text: 'Lobby interattiva con chat in tempo reale e personalizzazione regole.' },
      { type: 'improvement', text: 'Interfaccia responsive adatta sia a desktop che a dispositivi mobile.' },
      { type: 'improvement', text: 'Effetti sonori e controllo volume audio integrato.' }
    ]
  }
];
