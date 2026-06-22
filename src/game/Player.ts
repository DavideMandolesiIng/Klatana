export type PlayerColor = 'RED' | 'BLUE' | 'WHITE' | 'ORANGE' | 'GREEN' | 'PURPLE';

export const PLAYER_COLORS: Record<PlayerColor, { name: string, hex: string }> = {
    RED: { name: 'Red', hex: '#dc2626' },
    BLUE: { name: 'Blue', hex: '#2563eb' },
    WHITE: { name: 'White', hex: '#f8fafc' },
    ORANGE: { name: 'Orange', hex: '#ea580c' },
    GREEN: { name: 'Green', hex: '#16a34a' },
    PURPLE: { name: 'Purple', hex: '#9333ea' }
};

export interface PlayerData {
    peerId: string;
    username: string;
    color: PlayerColor | null; // null if they haven't picked yet
    isHost: boolean;
}
