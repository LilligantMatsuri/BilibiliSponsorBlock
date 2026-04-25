/** @jest-environment jsdom */

describe("video listeners", () => {
    function installConfigMock(disableSkipping: boolean): void {
        jest.doMock("../src/config", () => ({
            __esModule: true,
            default: {
                config: {
                    disableSkipping,
                },
            },
        }));
    }

    beforeEach(() => {
        jest.resetModules();
        installConfigMock(true);
        jest.doMock("../src/content/danmakuSkip", () => ({
            danmakuForSkip: jest.fn(),
        }));
        jest.doMock("../src/utils/logger", () => ({
            logDebug: jest.fn(),
        }));
        jest.doMock("../src/utils/video", () => ({
            getVideoID: jest.fn(() => "BV1test"),
        }));
    });

    test("video ready and duration changes only emit player events", async () => {
        const { createContentApp } = await import("../src/content/app");
        const { CONTENT_EVENTS } = await import("../src/content/app/events");
        const { durationChangeListener, videoOnReadyListener } = await import("../src/content/videoListeners");
        const app = createContentApp();
        const video = document.createElement("video");
        const emitted: string[] = [];

        app.bus.on(CONTENT_EVENTS.PLAYER_VIDEO_READY, ({ video: eventVideo }) => {
            expect(eventVideo).toBe(video);
            emitted.push(CONTENT_EVENTS.PLAYER_VIDEO_READY);
        });
        app.bus.on(CONTENT_EVENTS.PLAYER_DURATION_CHANGED, ({ video: eventVideo }) => {
            expect(eventVideo).toBe(video);
            emitted.push(CONTENT_EVENTS.PLAYER_DURATION_CHANGED);
        });

        expect(() => videoOnReadyListener({ target: video } as unknown as Event)).not.toThrow();
        expect(() => durationChangeListener({ target: video } as unknown as Event)).not.toThrow();
        expect(emitted).toEqual([
            CONTENT_EVENTS.PLAYER_VIDEO_READY,
            CONTENT_EVENTS.PLAYER_DURATION_CHANGED,
        ]);
    });

    test("playback event callbacks emit facts without skip command handlers", async () => {
        jest.resetModules();
        installConfigMock(false);
        jest.doMock("../src/content/danmakuSkip", () => ({
            danmakuForSkip: jest.fn(),
        }));
        jest.doMock("../src/utils/logger", () => ({
            logDebug: jest.fn(),
        }));
        jest.doMock("../src/utils/video", () => ({
            getVideoID: jest.fn(() => "BV1test"),
        }));

        const { createContentApp } = await import("../src/content/app");
        const { CONTENT_EVENTS } = await import("../src/content/app/events");
        const { setupVideoListeners } = await import("../src/content/videoListeners");
        const app = createContentApp();
        const video = document.createElement("video");
        const emitted: string[] = [];

        for (const eventName of [
            CONTENT_EVENTS.PLAYER_RATE_CHANGED,
            CONTENT_EVENTS.PLAYER_PLAY,
            CONTENT_EVENTS.PLAYER_PLAYING,
            CONTENT_EVENTS.PLAYER_SEEKING,
            CONTENT_EVENTS.PLAYER_PAUSE,
            CONTENT_EVENTS.PLAYER_WAITING,
        ]) {
            app.bus.on(eventName, () => {
                emitted.push(eventName);
            });
        }

        const unregisterInitialSchedule = app.commands.register("skip/startSchedule", () => undefined);
        setupVideoListeners(video);
        unregisterInitialSchedule();

        Object.defineProperty(video, "readyState", { configurable: true, value: HTMLMediaElement.HAVE_ENOUGH_DATA });
        Object.defineProperty(video, "paused", { configurable: true, value: false });
        video.currentTime = 5;

        expect(() => {
            video.dispatchEvent(new Event("ratechange"));
            video.dispatchEvent(new Event("play"));
            video.dispatchEvent(new Event("playing"));
            video.dispatchEvent(new Event("seeking"));
            video.dispatchEvent(new Event("pause"));
            video.dispatchEvent(new Event("waiting"));
        }).not.toThrow();

        expect(emitted).toEqual([
            CONTENT_EVENTS.PLAYER_RATE_CHANGED,
            CONTENT_EVENTS.PLAYER_PLAY,
            CONTENT_EVENTS.PLAYER_PLAYING,
            CONTENT_EVENTS.PLAYER_SEEKING,
            CONTENT_EVENTS.PLAYER_PAUSE,
            CONTENT_EVENTS.PLAYER_WAITING,
        ]);
    });
});
