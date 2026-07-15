export type PlayerColor = 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN' | 'AQUA' | 'BLUE' | 'PURPLE' | 'PINK' | 'WHITE' | 'BLACK';

export const PLAYER_COLORS: Record<PlayerColor, { name: string, hex: string }> = {
    RED: { name: 'Red', hex: '#dc2626' },
    ORANGE: { name: 'Orange', hex: '#ea580c' },
    YELLOW: { name: 'Yellow', hex: '#ffff00' },
    GREEN: { name: 'Green', hex: '#16a34a' },
    AQUA: { name: 'Aqua', hex: '#00ffff' },
    BLUE: { name: 'Blue', hex: '#2563eb' },
    PURPLE: { name: 'Purple', hex: '#9333ea' },
    PINK: { name: 'Pink', hex: '#d534d5' },
    WHITE: { name: 'White', hex: '#f8fafc' },
    BLACK: { name: 'Black', hex: '#404040' }
};

export interface PlayerData {
    peerId: string;
    username: string;
    color: PlayerColor | null; // null if they haven't picked yet
    isHost: boolean;
    playerId?: string;
}
