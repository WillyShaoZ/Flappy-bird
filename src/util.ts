import { State } from "./state";
import { Observable, interval, map, scan } from "rxjs";

export type Key = "Space";

export type Rect = Readonly<{ x0: number; y0: number; x1: number; y1: number }>;
export const Birb = {
    WIDTH: 42,
    HEIGHT: 30,
} as const;
export const Viewport = {
    CANVAS_WIDTH: 600,
    CANVAS_HEIGHT: 400,
} as const;
export const Constants = {
    PIPE_WIDTH: 50,
    TICK_RATE_MS: 50, // Might need to change this!
    GRAVITY: 1,
    VELOCITY: -10,
    PIPE_SPEED: 6,
    SEED: 1234,
} as const;
/**
 * Updates the state by proceeding with one time step.
 *
 * @param s Current state
 * @returns Updated state
 */
const tick = (s: State) => s;
export type Reducer = typeof tick;
/**
 * Creates an SVG element with the given properties.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/SVG/Element for valid
 * element names and properties.
 *
 * @param namespace Namespace of the SVG element
 * @param name SVGElement name
 * @param props Properties to set on the SVG element
 * @returns SVG element
 */
export const createSvgElement = (
    namespace: string | null,
    name: string,
    props: Record<string, string> = {},
): SVGElement => {
    const elem = document.createElementNS(namespace, name) as SVGElement;
    Object.entries(props).forEach(([k, v]) => elem.setAttribute(k, v));
    return elem;
};
/**
 * Brings an SVG element to the foreground.
 * @param elem SVG element to bring to the foreground
 */
export const bringToForeground = (elem: SVGElement): void => {
    elem.parentNode?.appendChild(elem);
};

/**
 * Displays a SVG element on the canvas. Brings to foreground.
 * @param elem SVG element to display
 */
export const show = (elem: SVGElement): void => {
    elem.setAttribute("visibility", "visible");
    bringToForeground(elem);
};

/**
 * Hides a SVG element on the canvas.
 * @param elem SVG element to hide
 */
export const hide = (elem: SVGElement): void => {
    elem.setAttribute("visibility", "hidden");
};

abstract class RNG {
    private static m = 0x80000000; // 2^31
    private static a = 1103515245;
    private static c = 12345;

    public static hash = (seed: number): number =>
        (RNG.a * seed + RNG.c) % RNG.m;

    public static scale = (hash: number): number =>
        (2 * hash) / (RNG.m - 1) - 1; // in [-1, 1]
}

export function createRngStreamFromSource<T>(source$: Observable<T>) {
    return function createRngStream(seed: number = 0): Observable<number> {
        const randomNumberStream = source$.pipe(
            scan((currentSeed, _) => RNG.hash(currentSeed), seed),
            map(nextSeed => RNG.scale(nextSeed)),
        );

        return randomNumberStream;
    };
}
export const tick$: Observable<number> = interval(Constants.TICK_RATE_MS);
export const pxPerMs = Constants.PIPE_SPEED / Constants.TICK_RATE_MS;
