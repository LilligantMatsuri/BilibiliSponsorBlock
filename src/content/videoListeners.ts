import Config from "../config";
import { addCleanupListener } from "../utils/cleanup";
import { getVideoID } from "../utils/video";
import { getContentApp } from "./app";
import { CONTENT_EVENTS } from "./app/events";
import { danmakuForSkip } from "./danmakuSkip";
import { contentState } from "./state";

let playbackRateCheckInterval: NodeJS.Timeout | null = null;
let lastPlaybackSpeed = 1;
let setupVideoListenersFirstTime = true;

/**
 * Triggered every time the video duration changes.
 * This happens when the resolution changes or at random time to clear memory.
 */
export function durationChangeListener(event?: Event): void {
    const video = (event?.target as HTMLVideoElement) || (document.querySelector("video") as HTMLVideoElement | null);
    if (!video) return;

    getContentApp().bus.emit(CONTENT_EVENTS.PLAYER_DURATION_CHANGED, { video }, { source: "videoListeners.durationChange" });
}

/**
 * Triggered once the video is ready.
 * This is mainly to attach to embedded players who don't have a video element visible.
 */
export function videoOnReadyListener(event?: Event): void {
    const video = (event?.target as HTMLVideoElement) || (document.querySelector("video") as HTMLVideoElement | null);
    if (!video) return;

    getContentApp().bus.emit(CONTENT_EVENTS.PLAYER_VIDEO_READY, { video }, { source: "videoListeners.videoOnReady" });
}

export function setupVideoListeners(video: HTMLVideoElement): void {
    if (!video) return;

    const app = getContentApp();

    video.addEventListener("loadstart", videoOnReadyListener);
    video.addEventListener("durationchange", durationChangeListener);

    if (setupVideoListenersFirstTime) {
        addCleanupListener(() => {
            video.removeEventListener("loadstart", videoOnReadyListener);
            video.removeEventListener("durationchange", durationChangeListener);
        });
    }

    if (!Config.config.disableSkipping) {
        danmakuForSkip();

        contentState.switchingVideos = false;

        const rateChangeListener = () => {
            app.bus.emit(CONTENT_EVENTS.PLAYER_RATE_CHANGED, { video, playbackRate: video.playbackRate }, { source: "videoListeners.rateChange" });
        };
        video.addEventListener("ratechange", rateChangeListener);
        video.addEventListener("videoSpeed_ratechange", rateChangeListener);

        const playListener = () => {
            if (video.readyState <= HTMLMediaElement.HAVE_CURRENT_DATA && video.currentTime === 0) return;

            app.bus.emit(CONTENT_EVENTS.PLAYER_PLAY, { video }, { source: "videoListeners.play" });
        };
        video.addEventListener("play", playListener);

        const playingListener = () => {
            app.bus.emit(CONTENT_EVENTS.PLAYER_PLAYING, { video }, { source: "videoListeners.playing" });

            if (playbackRateCheckInterval) clearInterval(playbackRateCheckInterval);
            lastPlaybackSpeed = video.playbackRate;

            if (document.body.classList.contains("vsc-initialized")) {
                playbackRateCheckInterval = setInterval(() => {
                    if ((!getVideoID() || video.paused) && playbackRateCheckInterval) {
                        clearInterval(playbackRateCheckInterval);
                        return;
                    }

                    if (video.playbackRate !== lastPlaybackSpeed) {
                        lastPlaybackSpeed = video.playbackRate;

                        rateChangeListener();
                    }
                }, 2000);
            }
        };
        video.addEventListener("playing", playingListener);

        const seekingListener = () => {
            app.bus.emit(CONTENT_EVENTS.PLAYER_SEEKING, { video }, { source: "videoListeners.seeking" });
        };
        video.addEventListener("seeking", seekingListener);

        const stoppedPlayback = () => {
            if (playbackRateCheckInterval) clearInterval(playbackRateCheckInterval);
        };
        const pauseListener = () => {
            app.bus.emit(CONTENT_EVENTS.PLAYER_PAUSE, { video }, { source: "videoListeners.pause" });

            stoppedPlayback();
        };
        video.addEventListener("pause", pauseListener);
        const waitingListener = () => {
            app.bus.emit(CONTENT_EVENTS.PLAYER_WAITING, { video }, { source: "videoListeners.waiting" });

            stoppedPlayback();
        };
        video.addEventListener("waiting", waitingListener);

        void app.commands.execute("skip/startSchedule", {});

        if (setupVideoListenersFirstTime) {
            addCleanupListener(() => {
                video.removeEventListener("play", playListener);
                video.removeEventListener("playing", playingListener);
                video.removeEventListener("seeking", seekingListener);
                video.removeEventListener("ratechange", rateChangeListener);
                video.removeEventListener("videoSpeed_ratechange", rateChangeListener);
                video.removeEventListener("pause", pauseListener);
                video.removeEventListener("waiting", waitingListener);

                if (playbackRateCheckInterval) clearInterval(playbackRateCheckInterval);
            });
        }
    }

    setupVideoListenersFirstTime = false;
}
