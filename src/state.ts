export type SpawnedPipe = Readonly<{
    gap_y: number;
    gap_height: number;
    time: number;
    spawnedAt: number; // Date.now()
}>;
// State processing
export type Pipe = Readonly<{
    gap_y: number;
    gap_height: number;
    time: number;
}>;
export type GhostFrame = Readonly<{ x: number; y: number }>;

export type GhostTape = Readonly<{
    frames: ReadonlyArray<GhostFrame>;
    deathScore: number;
}>;
export type State = Readonly<{
    lives: number;
    position: { x: number; y: number };
    score: number;
    gameEnd: boolean;
    velocity: number;
    pipesData: ReadonlyArray<SpawnedPipe>;
    collided: boolean;
    ghosts: ReadonlyArray<Readonly<{ x: number; y: number; visible: boolean }>>;
    tape: ReadonlyArray<GhostFrame>;
}>;