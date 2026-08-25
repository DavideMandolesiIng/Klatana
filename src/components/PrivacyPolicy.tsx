import React from 'react';
import { ArrowLeft, Shield } from 'lucide-react';
import wavesBg from '/assets/textures/waves-background.webp?url';

interface PrivacyPolicyProps {
  onBack: () => void;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-[#2c7873] text-[#3b2a1a] p-4 selection:bg-[#a37941]/30"
      style={{
        backgroundImage: `url(${wavesBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}>
      <div className="max-w-3xl mx-auto bg-gradient-to-br from-[#fcf7ec] to-[#e4cdad] rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.5)] overflow-hidden border-4 border-[#a37941]">

        <div className="p-6 border-b-2 border-[#d3be9a] bg-gradient-to-b from-[#ffffff] to-[#f4e6cd] sticky top-0 backdrop-blur-sm z-10 flex items-center justify-between shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
          <div className="flex items-center space-x-3">
            <Shield className="w-8 h-8 text-[#a37941]" />
            <h1 className="text-2xl font-bold text-[#2c1d10]">Privacy Policy</h1>
          </div>
          <button
            onClick={onBack}
            className="flex items-center space-x-2 text-[#865913] hover:text-[#a37941] transition-colors font-bold"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Menu</span>
          </button>
        </div>

        <div className="p-8 space-y-8 text-[#3b2a1a] leading-relaxed text-sm md:text-base">

          <section>
            <p className="mb-4">
              <strong>Last updated:</strong> August, 2026
            </p>
            <p>
              Welcome to <strong>Klatana</strong>, a web-based, multiplayer, free, and open-source board game. Your privacy is important to us. This policy explains what data is collected, how it is used, and why. Klatana was designed with the goal of collecting <strong>the least amount of personal data possible</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#2c1d10] mb-3 border-b border-[#d3be9a] pb-1">1. Data Collected and Collection Methods</h2>
            <p className="mb-2">When you use Klatana, the following technical information is processed:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>IP Address:</strong> As a Peer-to-Peer (P2P) multiplayer game, your IP address is used to establish a direct connection with other players via the WebRTC protocol. Additionally, your IP address is visible to the infrastructure services (Firebase and PeerJS server) in order to route network traffic and enstablish connections.</li>
              <li><strong>Session ID (Peer ID):</strong> When creating or joining a game, a temporary unique identifier is generated. This ID is necessary to allow communication between devices.</li>
              <li><strong>Lobby State:</strong> If you host a game, a unique 4-letter code and your temporary Peer ID are recorded on our backend Firebase database.</li>
            </ul>
            <p className="mt-4 text-[#865913] font-bold">Klatana DOES NOT collect:</p>
            <ul className="list-none space-y-1 mt-2">
              <li>❌ Real names, email addresses, passwords, or contact information.</li>
              <li>❌ Data for advertising tracking or user profiling.</li>
              <li>❌ Banking, credit card, or payment data (donations are securely handled off-site by PayPal).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#2c1d10] mb-3 border-b border-[#d3be9a] pb-1">2. Purpose of Processing</h2>
            <p>The data indicated above are used <strong>exclusively</strong> to allow the technical operation of the game:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Synchronize game states between players.</li>
              <li>Manage the creation of and access to lobbies (rooms).</li>
              <li>Ensure a stable connection between host and clients.</li>
            </ul>
            <p className="mt-3">The processing of this data is based on the legitimate technical interest in being able to provide you with the requested service (the game itself).</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#2c1d10] mb-3 border-b border-[#d3be9a] pb-1">3. Data Retention</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Lobbies and Peer IDs on Firebase:</strong> The data of the hosted game are <strong>automatically and immediately deleted</strong> as soon as the host disconnects, ends the game, or closes the browser tab.</li>
              <li>No data related to games or the network identity of users is permanently retained.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#2c1d10] mb-3 border-b border-[#d3be9a] pb-1">4. Third-Party Services</h2>
            <p className="mb-2">Klatana relies on external services to function, which act as data processors and may apply their own privacy policies for technical matters:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Google Firebase:</strong> Used to temporarily store lobbies and host the front-end scripts.</li>
              <li><strong>PeerJS Server:</strong> An open-source service used solely for "signaling", which is the initial handshake to discover the P2P host.</li>
              <li><strong>PayPal:</strong> Used to process voluntary donations. If you choose to donate, you will be redirected to PayPal's platform. Your transaction and payment data are processed by PayPal according to their Privacy Statement. We do not collect or store any payment information.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#2c1d10] mb-3 border-b border-[#d3be9a] pb-1">5. Cookies and Similar Technologies</h2>
            <p>
              Klatana relies exclusively on <strong>Local Storage (LocalStorage)</strong> to store your game settings, your in-game username, and temporarily generated Peer IDs to allow you to reconnect to an ongoing game in case you accidentally close the page. There are no profiling, marketing, or client-side tracking cookies managed directly by the app.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#2c1d10] mb-3 border-b border-[#d3be9a] pb-1">6. Your Rights (GDPR)</h2>
            <p className="mb-2">
              As a user residing in the European Union (GDPR), you have the right to access your data, request its deletion, or object to its processing.
            </p>
            <p>
              However, since <strong>Klatana does not retain long-term identifiers or logs traceable to you once the session ends</strong>, there is no persistent database containing your data. "Deletion" occurs automatically at the end of each game you play.
            </p>
            <p>
              For privacy inquiries, contact davide.mandolesi.ing@gmail.com
            </p>
          </section>

        </div>
      </div>
    </div>
  );
};
