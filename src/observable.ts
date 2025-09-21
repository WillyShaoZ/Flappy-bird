import {
    Reducer,
    Rect,
    pxPerMs,
    Birb,
    Viewport,
    Constants,
    createRngStreamFromSource,
    tick$,
} from "./util";

import { State } from "./state";
import { Observable, map, share } from "rxjs";

const rng$ = createRngStreamFromSource(tick$)(Date.now() & 0x7fffffff).pipe(
    share(),
); //get a velocity which is [10,30], it can be change
const hitsBounds = (s: State): { topHit: boolean; bottomHit: boolean } => {
    const yTop = s.position.y - Birb.HEIGHT / 2;
    const yBot = s.position.y + Birb.HEIGHT / 2;
    return { topHit: yTop <= 0, bottomHit: yBot >= Viewport.CANVAS_HEIGHT };
}; //judge whether the bird hit the canvas edge(top or bottom).

const birdRect = (s: State): Rect => ({
    x0: s.position.x - Birb.WIDTH / 2,
    x1: s.position.x + Birb.WIDTH / 2,
    y0: s.position.y - Birb.HEIGHT / 2,
    y1: s.position.y + Birb.HEIGHT / 2,
});//get the x,y of 4 angle

const rectsOverlap = (a: Rect, b: Rect): boolean =>
    a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0; //just check whether there are any overlap between two rectangle

type PipeHitFlags = Readonly<{ topPipeHit: boolean; bottomPipeHit: boolean }>; //judge whether a have some parts are inside b.

//check if hitting the pipe
const collides = (s: State, now: number): PipeHitFlags => {
    const bird = birdRect(s);

    return s.pipesData.reduce<PipeHitFlags>(
        (acc, p) => {
            const e = Math.max(0, now - p.spawnedAt);
            const x = Viewport.CANVAS_WIDTH - e * pxPerMs;

            const gapCenterY = p.gap_y * Viewport.CANVAS_HEIGHT;
            const gapH = p.gap_height * Viewport.CANVAS_HEIGHT;

            const topH = Math.max(0, gapCenterY - gapH / 2);
            const bottomY = gapCenterY + gapH / 2;
            const bottomH = Math.max(0, Viewport.CANVAS_HEIGHT - bottomY);

            const topRect: Rect = {
                x0: x,
                x1: x + Constants.PIPE_WIDTH,
                y0: 0,
                y1: topH,
            }; //get the data of top pipe
            const bottomRect: Rect = {
                x0: x,
                x1: x + Constants.PIPE_WIDTH,
                y0: bottomY,
                y1: bottomY + bottomH,
            }; // get the data of the bottom pipe

            return {
                topPipeHit: acc.topPipeHit || rectsOverlap(bird, topRect),
                bottomPipeHit:
                    acc.bottomPipeHit || rectsOverlap(bird, bottomRect),
            };
        },
        { topPipeHit: false, bottomPipeHit: false },
    );
};

//handle collision
export const collision$: Observable<Reducer> = rng$.pipe(
    map(
        (r): Reducer =>
            (s: State): State => {
                const mag = (r + 2) * 5; // calculate velocity due to elasticity in range[10,30]
                const now = Date.now();

                const { topPipeHit, bottomPipeHit } = collides(s, now);
                const { topHit, bottomHit } = hitsBounds(s);

                const hitPipes = topPipeHit || bottomPipeHit;//hit any pipe?
                const hitBounds = topHit || bottomHit;//hit top or bottom?
                const hit = hitPipes || hitBounds;//did the bird hit anything?

                const dir =
                    Number(topPipeHit || topHit) -
                    Number(bottomPipeHit || bottomHit);//check the direction of the hitting the result would be(if hit the bottom(pipes or bounds) -1 or(if hit the top(pipes or bounds)) 1
                const transition = Number(!s.collided && hit); //only when the bird from no collision to hit sth, it would be true

                const newLives = Math.max(0, s.lives - transition);
                const newVelocity =
                    s.velocity * (1 - transition) + dir * mag * transition;//if collision happened, changing the velocity: the direction of the velocity is based on the direction of hitting and generate the magnitude of the velocity by using rng.

                return {
                    ...s,
                    collided: hit,
                    lives: newLives,
                    gameEnd: newLives <= 0 || s.gameEnd,
                    velocity: newVelocity,
                };//update the game state.
            },
    ),
);
