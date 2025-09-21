/**
 * Inside this file you will use the classes and functions from rx.js
 * to add visuals to the svg element in index.html, animate them, and make them interactive.
 *
 * Study and complete the tasks in observable exercises first to get ideas.
 *
 * Course Notes showing Asteroids in FRP: https://tgdwyer.github.io/asteroids/
 *
 * You will be marked on your functional programming style
 * as well as the functionality that you implement.
 *
 * Document your code!
 */

import "./style.css";

import {
    Observable,
    catchError,
    filter,
    fromEvent,
    interval,
    map,
    merge,
    scan,
    switchMap,
    take,
    timer,
    from,
    mergeMap,
    takeWhile,
    withLatestFrom,
    repeatWhen,
    zipWith,
    BehaviorSubject,
} from "rxjs";
import { fromFetch } from "rxjs/fetch";
import { Pipe, SpawnedPipe, GhostFrame, GhostTape, State } from "./state";
import { Key } from "./util";
import {
    tick$,
    Reducer,
    pxPerMs,
    Constants,
    Birb,
    Viewport,
    hide,
    show,
    bringToForeground,
    createSvgElement,
} from "./util";
import { collision$ } from "./observable";
/** Constants */
const tapes$ = new BehaviorSubject<ReadonlyArray<GhostTape>>([]);

const initialState: State = {
    lives: 3,
    position: { x: Viewport.CANVAS_WIDTH * 0.3, y: Viewport.CANVAS_HEIGHT / 2 },
    score: 0,
    gameEnd: false,
    velocity: 0,
    pipesData: [],
    collided: false,
    ghosts: [],
    tape: [],
};

const restartClicks$: Observable<MouseEvent> = fromEvent<MouseEvent>(
    document.body,
    "mousedown",
);

const pipeX = (p: SpawnedPipe, now: number) =>
    Viewport.CANVAS_WIDTH - Math.max(0, now - p.spawnedAt) * pxPerMs;

const pipeCenterX = (p: SpawnedPipe, now: number) =>
    pipeX(p, now) + Constants.PIPE_WIDTH / 2;

const score$: Observable<Reducer> = tick$.pipe(
    //emits every TICK_RATE_MS
    withLatestFrom(tapes$), //pairs each tick with the current ghost archive.
    map(([, archive]) => (s: State): State => {
        const now = Date.now();
        const passedCount = s.pipesData
            .map(p => pipeCenterX(p, now))
            .filter(xOfPipe => xOfPipe < s.position.x).length; //calculate how many pipes have been passed.

        const ghosts = (s.ghosts ?? []).map((g, i) => ({
            ...g,
            visible: passedCount <= (archive[i]?.deathScore ?? -1),
        })); //change the visibility based on whether passedCount of the ghost bird <= deathScore

        return { ...s, score: passedCount, ghosts };
    }),
); //update the marks and also check the position of the ghost bird to check the

const render = (): ((s: State) => void) => {
    // Canvas elements
    const gameOver = document.querySelector("#gameOver") as SVGElement;
    const container = document.querySelector("#main") as HTMLElement;

    // Text fields
    const livesText = document.querySelector("#livesText") as HTMLElement;
    const scoreText = document.querySelector("#scoreText") as HTMLElement;

    const svg = document.querySelector("#svgCanvas") as SVGSVGElement;

    svg.setAttribute(
        "viewBox",
        `0 0 ${Viewport.CANVAS_WIDTH} ${Viewport.CANVAS_HEIGHT}`,
    );
    // Add birb to the main grid canvas
    const birdImg = createSvgElement(svg.namespaceURI, "image", {
        href: "assets/birb.png",
        x: `${Viewport.CANVAS_WIDTH * 0.3 - Birb.WIDTH / 2}`,
        y: `${Viewport.CANVAS_HEIGHT / 2 - Birb.HEIGHT / 2}`,
        width: `${Birb.WIDTH}`,
        height: `${Birb.HEIGHT}`,
    });
    svg.appendChild(birdImg);

    const ghostLayer = createSvgElement(svg.namespaceURI, "g", {});
    svg.appendChild(ghostLayer);
    // Draw a static pipe as a demonstration

    const pipesLayer = createSvgElement(svg.namespaceURI, "g", {});

    svg.appendChild(pipesLayer);

    const overLay = createSvgElement(svg.namespaceURI, "g", {}); //create a top layer for sth cover on the top
    svg.appendChild(overLay);

    // Move the existing #gameOver into the overlay and start hidden
    overLay.appendChild(gameOver);
    hide(gameOver);
    /**
     * Renders the current state to the canvas.
     *
     * In MVC terms, this updates the View using the Model.
     *
     * @param s Current state
     */
    return (s: State) => {
        birdImg.setAttribute("x", `${s.position.x - Birb.WIDTH / 2}`);
        birdImg.setAttribute("y", `${s.position.y - Birb.HEIGHT / 2}`);
        scoreText.textContent = `${s.score}`;
        livesText.textContent = `${s.lives}`;

        const now = Date.now();

        // clear the pipe layer completely
        pipesLayer.innerHTML = "";
        const prevEnded = overLay.getAttribute("data-ended") === "1";
        const nowEnded = !!s.gameEnd;
        const saveNow = nowEnded && !prevEnded; // one-time trigger when the game switches from not-ended to ended
        overLay.setAttribute("data-ended", String(nowEnded)); //set a top layer so that game over to ensure there is nothing will be shown above the game over.

        saveNow &&
            tapes$.next([
                ...tapes$.value,
                { frames: s.tape, deathScore: s.score },
            ]); //save the ghost bird data into tapes if the game switches from not-ended to ended

        // clear the ghost layer completely
        ghostLayer.innerHTML = "";

        (s.ghosts ?? []).forEach(g => {
            const img = createSvgElement(svg.namespaceURI, "image", {
                href: "assets/birb.png",
                x: `${g.x - Birb.WIDTH / 2}`,
                y: `${g.y - Birb.HEIGHT / 2}`,
                width: `${Birb.WIDTH}`,
                height: `${Birb.HEIGHT}`,
                opacity: "0.3",
                visibility: g.visible ? "visible" : "hidden", //only be visible when it is visible
            }); //create ghost bird html element
            ghostLayer.appendChild(img);
        }); //emit each ghost based on the

        // rebuild all visible pipes fresh from state
        s.pipesData
            .map(p => {
                const elapsedMs = Math.max(0, now - p.spawnedAt); //check the time If the time has not yet reached the pipeline's appear time.
                const x = Viewport.CANVAS_WIDTH - elapsedMs * pxPerMs; //define the x position of the pipe should be in current moment
                const gapCenterY = p.gap_y * Viewport.CANVAS_HEIGHT; //get the y centre of the pipe gap
                const gapH = p.gap_height * Viewport.CANVAS_HEIGHT; //get the height of the pipe gap
                const topH = gapCenterY - gapH / 2; // get the height of the top pipe
                const bottomY = gapCenterY + gapH / 2; // y-position of the top edge of the bottom pipe
                const bottomH = Viewport.CANVAS_HEIGHT - bottomY; // height of the bottom pipe
                return { x, topH, bottomY, bottomH };
            })
            .filter(v => v.x + Constants.PIPE_WIDTH >= 0)
            .forEach(({ x, topH, bottomY, bottomH }) => {
                const top = createSvgElement(svg.namespaceURI, "rect", {
                    x: `${x}`,
                    y: "0",
                    width: `${Constants.PIPE_WIDTH}`,
                    height: `${topH}`,
                    fill: "green",
                });
                const bottom = createSvgElement(svg.namespaceURI, "rect", {
                    x: `${x}`,
                    y: `${bottomY}`,
                    width: `${Constants.PIPE_WIDTH}`,
                    height: `${bottomH}`,
                    fill: "green",
                });
                pipesLayer.appendChild(top);
                pipesLayer.appendChild(bottom);
            });
        bringToForeground(overLay);
        s.gameEnd ? show(gameOver) : hide(gameOver);
    };
};

const parsePipes = (
    csv: string,
): ReadonlyArray<Pipe> => //read csv to get the details of pipes.
    csv
        .trim()
        .split("\n")
        .slice(1)
        .map(line => {
            const [gap_y, gap_height, time] = line.split(",").map(Number);
            return { gap_y, gap_height, time };
        });

export const state$ = (csvContents: string): Observable<State> => {
    /** User input */

    const key$ = fromEvent<KeyboardEvent>(document, "keypress");
    const fromKey = (keyCode: Key) =>
        key$.pipe(filter(({ code }) => code === keyCode));
    const flap$ = fromKey("Space").pipe(
        map(() => (s: State) => ({
            ...s,
            velocity: Constants.VELOCITY,
        })),
    );

    const schedule: Pipe[] = [...parsePipes(csvContents)]; //read the data in the CSV file

    const spawnPipes$: Observable<Reducer> = from(schedule).pipe(
        mergeMap((p: Pipe) =>
            timer(p.time * 1000).pipe(
                map(
                    (): Reducer => (s: State) => ({
                        ...s,
                        pipesData: [
                            ...s.pipesData,
                            {
                                gap_y: p.gap_y,
                                gap_height: p.gap_height,
                                time: p.time,
                                spawnedAt: Date.now(),
                            },
                        ],
                    }),
                ),
            ),
        ),
    ); //generate pipe based on whether the time of the pipe is reached.

    /** Determines the rate of time steps */

    const ghostReplay$: Observable<Reducer> = tapes$.pipe(
        take(1), // snapshot archive at start of THIS run
        switchMap(archive =>
            merge(
                ...archive.map((tape, idx) =>
                    from(tape.frames as ReadonlyArray<GhostFrame>).pipe(
                        zipWith(interval(Constants.TICK_RATE_MS)), // pace
                        map(([frame]) => (s: State): State => {
                            const len = Math.max(s.ghosts.length, idx + 1);
                            const ghosts = Array.from(
                                { length: len },
                                (_, i) =>
                                    i === idx
                                        ? {
                                              x: frame.x,
                                              y: frame.y,
                                              visible:
                                                  s.ghosts[i]?.visible ?? true,
                                          }
                                        : (s.ghosts[i] ?? {
                                              x: -9999,
                                              y: -9999,
                                              visible: false,
                                          }), //this part is to avoid the current s.ghost[i] does not exists
                            );
                            return { ...s, ghosts };
                        }),
                    ),
                ),
            ),
        ),
    );

    const physics$: Observable<Reducer> = tick$.pipe(
        map(() => (s: State): State => {
            const newVelocity = s.velocity + Constants.GRAVITY; //upload velocity which is affected by the gravity
            const newY = s.position.y + newVelocity; //upload the position of the bird base on the new velocity.

            const frame: GhostFrame = { x: s.position.x, y: newY };
            const newTape = s.gameEnd ? s.tape : [...s.tape, frame]; // if the game is ended then store the tape

            return {
                ...s,
                velocity: newVelocity,
                position: { ...s.position, y: newY },
                tape: newTape,
            };
        }),
    );
    const totalPipes = schedule.length;
    const endWhenAllPipesPassed$: Observable<Reducer> = tick$.pipe(
        map(
            () =>
                (s: State): State => ({
                    ...s,
                    gameEnd: s.gameEnd || s.score >= totalPipes,
                }),
        ),
    );
    return merge(
        flap$,
        physics$,
        spawnPipes$,
        collision$,
        score$,
        ghostReplay$,
        endWhenAllPipesPassed$,
    ).pipe(
        scan((s, reducer) => reducer(s), initialState),
        takeWhile(s => !s.gameEnd, true),
        repeatWhen(() => restartClicks$),
    );
};

// The following simply runs your main function on window load.  Make sure to leave it in place.
// You should not need to change this, beware if you are.
if (typeof window !== "undefined") {
    const { protocol, hostname, port } = new URL(import.meta.url);
    const baseUrl = `${protocol}//${hostname}${port ? `:${port}` : ""}`;
    const csvUrl = `${baseUrl}/assets/map.csv`;

    // Get the file from URL
    const csv$ = fromFetch(csvUrl).pipe(
        switchMap(response => {
            if (response.ok) {
                return response.text();
            } else {
                throw new Error(`Fetch error: ${response.status}`);
            }
        }),
        catchError(err => {
            console.error("Error fetching the CSV file:", err);
            throw err;
        }),
    );

    // Observable: wait for first user click
    const click$ = fromEvent(document.body, "mousedown").pipe(take(1));

    csv$.pipe(
        switchMap(contents =>
            // On click - start the game
            click$.pipe(switchMap(() => state$(contents))),
        ),
    ).subscribe(render());
}
