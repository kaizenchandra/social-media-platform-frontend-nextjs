"use client";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/primitives";
import { seekTime } from "./policy";
const clock = (value: number) =>
  `${Math.floor(value / 60)}:${Math.floor(value % 60)
    .toString()
    .padStart(2, "0")}`;
export function MediaPlayer({
  src,
  poster,
  captionSrc,
  transcript,
  title,
  vertical = false,
  onEnded,
}: {
  src: string;
  poster?: string;
  captionSrc?: string;
  transcript: string;
  title: string;
  vertical?: boolean;
  onEnded?: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const captionTrack = useRef<HTMLTrackElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  const [status, setStatus] = useState<
    "loading" | "ready" | "playing" | "buffering" | "ended" | "failed"
  >("loading");
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(0.7);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [captions, setCaptions] = useState(false);
  const [captionError, setCaptionError] = useState(false);
  const [notice, setNotice] = useState("");
  const loaded = (element: HTMLVideoElement) => {
    setDuration(Number.isFinite(element.duration) ? element.duration : 0);
    setStatus(element.paused ? "ready" : "playing");
  };
  useEffect(() => {
    const element = video.current;
    const wrapper = container.current;
    if (!element) return;
    // Restore the source after React development effect replay cleans it up.
    if (element.getAttribute("src") !== src) {
      element.setAttribute("src", src);
      element.load();
    }
    const track = captionTrack.current;
    const captionFailure = () => {
      setCaptionError(true);
      setCaptions(false);
    };
    track?.addEventListener("error", captionFailure);
    const current = ++generation.current;
    const pause = () => {
      element.pause();
    };
    const visibility = () => {
      if (document.hidden) pause();
    };
    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entries) => {
              if (!entries[0]?.isIntersecting) pause();
            },
            { threshold: 0.15 },
          )
        : null;
    if (wrapper) observer?.observe(wrapper);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", pause);
    return () => {
      generation.current = current + 1;
      observer?.disconnect();
      track?.removeEventListener("error", captionFailure);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", pause);
      element.pause();
      element.removeAttribute("src");
      element.load();
    };
  }, [src, captionSrc]);
  async function togglePlayback() {
    const element = video.current;
    if (!element || status === "failed") return;
    if (!element.paused) {
      element.pause();
      return;
    }
    const current = generation.current;
    try {
      await element.play();
      if (current !== generation.current) element.pause();
    } catch {
      if (current === generation.current) {
        setNotice(
          "Playback did not start. Press Play to try again; your browser may require a user gesture.",
        );
        setPlaying(false);
      }
    }
  }
  function changeCaptions() {
    const element = video.current;
    if (!element || !captionSrc || captionError) return;
    const enabled = !captions;
    for (let i = 0; i < element.textTracks.length; i++)
      element.textTracks[i].mode = enabled ? "showing" : "disabled";
    setCaptions(enabled);
  }
  function mute() {
    if (video.current) {
      video.current.muted = !muted;
      setMuted(!muted);
    }
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (container.current?.requestFullscreen)
        await container.current.requestFullscreen();
      else setNotice("Fullscreen is unavailable in this browser.");
    } catch {
      setNotice(
        "Fullscreen could not be opened. Continue in the inline player.",
      );
    }
  }
  function key(event: KeyboardEvent<HTMLDivElement>) {
    if (
      event.target instanceof HTMLElement &&
      (event.target.closest("button,input,select,textarea,a") ||
        event.target.isContentEditable)
    )
      return;
    const element = video.current;
    if (!element) return;
    switch (event.key.toLowerCase()) {
      case " ":
      case "k":
        event.preventDefault();
        void togglePlayback();
        break;
      case "arrowleft":
        event.preventDefault();
        element.currentTime = seekTime(element.currentTime, -5, duration);
        setTime(element.currentTime);
        break;
      case "arrowright":
        event.preventDefault();
        element.currentTime = seekTime(element.currentTime, 5, duration);
        setTime(element.currentTime);
        break;
      case "m":
        event.preventDefault();
        mute();
        break;
      case "c":
        event.preventDefault();
        changeCaptions();
        break;
      case "f":
        event.preventDefault();
        void fullscreen();
        break;
    }
  }
  return (
    <div
      className={`rich-player ${vertical ? "vertical-player" : ""}`}
      ref={container}
      role="region"
      aria-label={`Player: ${title}`}
      tabIndex={0}
      onKeyDown={key}
    >
      <video
        ref={video}
        src={src}
        poster={poster}
        playsInline
        preload="metadata"
        muted={muted}
        aria-label={`Video: ${title}`}
        onLoadedMetadata={(e) => loaded(e.currentTarget)}
        onDurationChange={(e) =>
          setDuration(
            Number.isFinite(e.currentTarget.duration)
              ? e.currentTarget.duration
              : 0,
          )
        }
        onCanPlay={(e) => loaded(e.currentTarget)}
        onWaiting={() => setStatus("buffering")}
        onStalled={() => setStatus("buffering")}
        onPlaying={() => {
          setPlaying(true);
          setStatus("playing");
          setNotice("");
        }}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onVolumeChange={(e) => {
          setMuted(e.currentTarget.muted);
          setVolume(e.currentTarget.volume);
        }}
        onRateChange={(e) => setRate(e.currentTarget.playbackRate)}
        onEnded={() => {
          setPlaying(false);
          setStatus("ended");
          onEnded?.();
        }}
        onError={() => {
          setStatus("failed");
          setPlaying(false);
          video.current?.pause();
        }}
      >
        {captionSrc && (
          <track
            ref={captionTrack}
            kind="captions"
            src={captionSrc}
            srcLang="en"
            label="English"
          />
        )}
      </video>
      {status === "failed" ? (
        <div className="player-failure" role="alert">
          <strong>Media could not be loaded</strong>
          <p>Playback is unavailable. Retry manually or choose another item.</p>
          <Button
            variant="secondary"
            onClick={() => {
              setStatus("loading");
              setNotice("");
              video.current?.load();
            }}
          >
            Retry media
          </Button>
        </div>
      ) : (
        <p className="player-status" role="status">
          {status === "loading"
            ? "Loading media…"
            : status === "buffering"
              ? "Buffering…"
              : status === "ended"
                ? "Playback ended"
                : playing
                  ? "Playing"
                  : "Paused"}
        </p>
      )}
      <div className="player-controls">
        <Button
          variant="secondary"
          disabled={status === "failed"}
          onClick={() => void togglePlayback()}
        >
          {playing ? "Pause" : "Play"}
        </Button>
        <Button variant="secondary" onClick={mute}>
          {muted ? "Unmute" : "Mute"}
        </Button>
        <label>
          Volume
          <input
            aria-label="Video volume"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => {
              if (video.current) {
                video.current.volume = Number(e.target.value);
                video.current.muted = false;
              }
            }}
          />
        </label>
        <label>
          Speed
          <select
            aria-label="Playback speed"
            value={rate}
            onChange={(e) => {
              if (video.current)
                video.current.playbackRate = Number(e.target.value);
            }}
          >
            {[0.5, 1, 1.5, 2].map((speed) => (
              <option key={speed} value={speed}>
                {speed}×
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="secondary"
          disabled={!captionSrc || captionError}
          aria-pressed={captions}
          onClick={changeCaptions}
        >
          Captions {captions ? "on" : "off"}
        </Button>
        <Button variant="secondary" onClick={() => void fullscreen()}>
          Fullscreen
        </Button>
      </div>
      <div className="player-timeline">
        <span>{clock(time)}</span>
        <input
          aria-label="Video position"
          type="range"
          min="0"
          max={duration || 0}
          step=".1"
          value={Math.min(time, duration || 0)}
          disabled={!duration || status === "failed"}
          onChange={(e) => {
            if (video.current) {
              video.current.currentTime = Number(e.target.value);
              setTime(Number(e.target.value));
            }
          }}
        />
        <span>{clock(duration)}</span>
      </div>
      {notice && (
        <p className="player-notice" role="status">
          {notice}
        </p>
      )}
      {captionError && (
        <p className="player-notice" role="status">
          Captions unavailable. The text transcript remains below.
        </p>
      )}
      <details className="player-transcript">
        <summary>Transcript and keyboard controls</summary>
        <p>{transcript}</p>
        <p>
          Focus the player: Space or K to play/pause; arrows seek 5 seconds; M
          mutes; C toggles captions; F opens fullscreen. No autoplay. Playback
          pauses when the tab is hidden or the player leaves the viewport.
        </p>
      </details>
    </div>
  );
}
