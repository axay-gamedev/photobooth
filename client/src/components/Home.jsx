import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  Copy,
  Download,
  Mic,
  MicOff,
  PhoneOff,
  RotateCcw,
  Users,
  Volume2,
  VolumeX,
  Heart,
  Sparkles,
  Wand2,
  Images,
  Send,
  Check,
  FlipHorizontal,
} from "lucide-react";
import { useSocket } from "../providers/Socket";
import "./Home.css";

const makeRoomCode = () =>
  Math.random().toString(36).substring(2, 8).toUpperCase();

const Home = () => {
  const socket = useSocket();

  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [inRoom, setInRoom] = useState(false);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("Ready for a session");
  const [error, setError] = useState("");
  const [peerPresent, setPeerPresent] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [speakerOff, setSpeakerOff] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [copied, setCopied] = useState(false);
  const [ready, setReady] = useState(false);
  const [partnerReady, setPartnerReady] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [shotNumber, setShotNumber] = useState(0);
  const [capturing, setCapturing] = useState(false);
  const [stripMode, setStripMode] = useState("strip");
  const [filter, setFilter] = useState("original");
  const [caption, setCaption] = useState("");
  const [secretMessage, setSecretMessage] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [sticker, setSticker] = useState("");
  const [mirror, setMirror] = useState(true);
  const [memories, setMemories] = useState([]);
  const [showMemories, setShowMemories] = useState(false);
  const [shots, setShots] = useState([]);
  const [flash, setFlash] = useState(false);
  const [developing, setDeveloping] = useState(false);
  const [soundOn, setSoundOn] = useState(true);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const peerIdRef = useRef(null);
  const roomIdRef = useRef("");
  const captureRunRef = useRef(0);
  const captureTimerRef = useRef(null);
  const connectedRef = useRef(false);
  const capturingRef = useRef(false);

  const cleanupCall = useCallback(() => {
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    peerIdRef.current = null;
    setPeerPresent(false);
    setConnected(false);
    setInRoom(false);
  }, []);

  const createPeerConnection = useCallback(
    (peerId) => {
      peerIdRef.current = peerId;

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });

      peerConnectionRef.current = pc;

      localStreamRef.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });

      pc.ontrack = (event) => {
        const [stream] = event.streams;
        if (remoteVideoRef.current && stream) {
          remoteVideoRef.current.srcObject = stream;
          setPeerPresent(true);
          connectedRef.current = true;
          setConnected(true);
          setStatus("Connected — you're both in the booth");
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && peerIdRef.current) {
          socket.emit("ice-candidate", {
            target: peerIdRef.current,
            candidate: event.candidate,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "connected") {
          connectedRef.current = true;
          setConnected(true);
          setStatus("Connected — say cheese!");
        } else if (state === "disconnected") {
          connectedRef.current = false;
          setConnected(false);
          setStatus("Connection interrupted");
        } else if (state === "failed") {
          connectedRef.current = false;
          setConnected(false);
          setStatus("Connection failed — try rejoining");
        }
      };

      return pc;
    },
    [socket]
  );

  const startCamera = async () => {
    if (localStreamRef.current) return localStreamRef.current;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: true,
      });

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      return stream;
    } catch (err) {
      setError(
        "Camera or microphone permission was blocked. Allow access and try again."
      );
      throw err;
    }
  };

  const joinRoom = async (code) => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      setError("Enter a room code first.");
      return;
    }

    setError("");

    try {
      await startCamera();
      roomIdRef.current = cleanCode;
      socket.emit("join-room", {
        roomId: cleanCode,
        name: name.trim() || "Guest",
      });
      setInRoom(true);
      setStatus("Waiting for your partner…");
    } catch {
      // Camera error is already displayed.
    }
  };

  const createRoom = async () => {
    const code = makeRoomCode();
    setRoomCode(code);
    await joinRoom(code);
  };

  const leaveRoom = () => {
    cleanupCall();
    setStatus("Ready for a session");
    setPhotoUrl(null);
    setError("");
  };

  const playShutterSound = () => {
    if (!soundOn) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(65, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.16);
    } catch {}
  };

  const captureFrame = async () => {
    const localVideo = localVideoRef.current;
    const remoteVideo = remoteVideoRef.current;

    if (!localVideo || !remoteVideo) return null;

    const waitForFrame = (video) =>
      new Promise((resolve) => {
        if (video.readyState >= 2 && video.videoWidth > 0) {
          resolve();
          return;
        }
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          video.removeEventListener("loadeddata", finish);
          resolve();
        };
        const timer = setTimeout(finish, 2500);
        video.addEventListener("loadeddata", finish, { once: true });
      });

    await Promise.all([
      localVideo.play().catch(() => {}),
      remoteVideo.play().catch(() => {}),
      waitForFrame(localVideo),
      waitForFrame(remoteVideo),
    ]);

    if (
      !localVideo.videoWidth ||
      !localVideo.videoHeight ||
      !remoteVideo.videoWidth ||
      !remoteVideo.videoHeight
    ) {
      return null;
    }

    const canvas = document.createElement("canvas");
    const width = 1200;
    const height = 760;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#f5efe3";
    ctx.fillRect(0, 0, width, height);

    const gap = 14;
    const photoW = (width - 56 - gap) / 2;
    const photoH = height - 148;

    const drawCover = (video, x, y, w, h, mirrored) => {
      const sourceRatio = video.videoWidth / video.videoHeight;
      const targetRatio = w / h;
      let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight;

      if (sourceRatio > targetRatio) {
        sw = video.videoHeight * targetRatio;
        sx = (video.videoWidth - sw) / 2;
      } else {
        sh = video.videoWidth / targetRatio;
        sy = (video.videoHeight - sh) / 2;
      }

      ctx.save();
      if (mirrored) {
        ctx.translate(x + w, y);
        ctx.scale(-1, 1);
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
      } else {
        ctx.drawImage(video, sx, sy, sw, sh, x, y, w, h);
      }
      ctx.restore();
    };

    drawCover(localVideo, 28, 28, photoW, photoH, mirror);

    if (remoteVideo.videoWidth > 0) {
      drawCover(remoteVideo, 28 + photoW + gap, 28, photoW, photoH, false);
    }

    ctx.fillStyle = "#191715";
    ctx.fillRect(0, height - 92, width, 92);
    ctx.fillStyle = "#f5efe3";
    ctx.font = "bold 28px Courier New";
    ctx.textAlign = "left";
    ctx.fillText("PHOTO-BOOTH", 30, height - 48);
    ctx.font = "18px Courier New";
    ctx.textAlign = "right";
    ctx.fillText(new Date().toLocaleDateString(), width - 30, height - 48);

    return canvas.toDataURL("image/jpeg", 0.92);
  };

  const buildFinalPhoto = async (frameShots) => {
    if (!frameShots.length) return null;

    const images = await Promise.all(
      frameShots.map(
        (src) =>
          new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
          })
      )
    );

    const width = stripMode === "polaroid" ? 920 : 760;
    const frameH = stripMode === "single" ? 480 : 430;
    const gap = 18;
    const header = stripMode === "strip" ? 80 : 120;
    const footer = 105;
    const height =
      header +
      images.length * frameH +
      Math.max(0, images.length - 1) * gap +
      footer +
      36;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const filterMap = {
      original: "none",
      bw: "grayscale(1) contrast(1.12)",
      vintage: "sepia(.45) contrast(1.08) saturate(.82)",
      warm: "sepia(.18) saturate(1.25) brightness(1.04)",
      film: "contrast(1.16) saturate(.78)",
    };

    ctx.fillStyle = stripMode === "polaroid" ? "#fffdf8" : "#f5efe3";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#191715";
    ctx.font = "bold 30px Courier New";
    ctx.textAlign = "center";
    ctx.fillText(
      stripMode === "polaroid" ? "A LITTLE MEMORY" : "PHOTO-BOOTH",
      width / 2,
      55
    );

    let y = header;
    images.forEach((img) => {
      ctx.save();
      ctx.filter = filterMap[filter] || "none";
      const targetW = width - 72;
      const targetH = frameH;
      const sourceRatio = img.width / img.height;
      const targetRatio = targetW / targetH;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;

      if (sourceRatio > targetRatio) {
        sw = img.height * targetRatio;
        sx = (img.width - sw) / 2;
      } else {
        sh = img.width / targetRatio;
        sy = (img.height - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 36, y, targetW, targetH);
      ctx.restore();
      y += frameH + gap;
    });

    if (sticker) {
      ctx.font = "52px serif";
      ctx.textAlign = "right";
      ctx.fillText(sticker, width - 45, header + 65);
    }

    ctx.fillStyle = "#191715";
    ctx.font = "bold 19px Courier New";
    ctx.textAlign = "center";
    if (caption.trim()) ctx.fillText(caption.trim().slice(0, 42), width / 2, height - 62);

    ctx.font = "14px Courier New";
    ctx.fillText(
      `${new Date().toLocaleDateString()}  ·  ${new Date().toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}`,
      width / 2,
      height - 32
    );

    return canvas.toDataURL("image/jpeg", 0.94);
  };

  const runCapture = async (startAt = Date.now()) => {
    // Socket.IO callbacks can outlive a React render. Use refs for values
    // that must be current when the server starts the synchronized capture.
    if (capturingRef.current) return;

    const runId = ++captureRunRef.current;
    const wait = Math.max(0, startAt - Date.now());
    if (wait > 0) {
      await new Promise((resolve) => {
        captureTimerRef.current = setTimeout(resolve, wait);
      });
    }
    if (runId !== captureRunRef.current || !connectedRef.current) {
      console.warn("[Photobooth] capture-start arrived before cameras were connected", {
        connected: connectedRef.current,
        runId,
      });
      setStatus("Capture waiting for camera connection…");
      return;
    }

    capturingRef.current = true;
    setCapturing(true);
    setShots([]);
    setShotNumber(0);
    setStatus("Get ready…");

    const localShots = [];

    for (let i = 0; i < 4; i += 1) {
      setShotNumber(i + 1);

      for (let n = 3; n >= 1; n -= 1) {
        setCountdown(n);
        await new Promise((resolve) => setTimeout(resolve, 700));
      }

      setCountdown("📸");
      setFlash(true);
      playShutterSound();

      const frame = await captureFrame();
      if (frame) localShots.push(frame);

      await new Promise((resolve) => setTimeout(resolve, 180));
      setFlash(false);
      setCountdown(null);

      if (i < 3) {
        setStatus(`Shot ${i + 1}/4 captured — pose again!`);
        await new Promise((resolve) => setTimeout(resolve, 900));
      }
    }

    if (!localShots.length) {
      setError("Both cameras need to be visible before taking the photo.");
      setStatus("Capture failed");
      capturingRef.current = false;
      setCapturing(false);
      socket.emit("capture-finished");
      return;
    }

    setDeveloping(true);
    setStatus("Developing your memory…");
    await new Promise((resolve) => setTimeout(resolve, 1300));

    setShots(localShots);
    const finalPhoto = await buildFinalPhoto(localShots);
    setPhotoUrl(finalPhoto);

    const nextMemories = [
      {
        id: Date.now(),
        url: finalPhoto,
        caption: caption || "A little memory",
        date: new Date().toLocaleDateString(),
      },
      ...memories,
    ].slice(0, 20);

    setMemories(nextMemories);
    localStorage.setItem("photobooth-memories", JSON.stringify(nextMemories));
    setDeveloping(false);
    capturingRef.current = false;
    setCapturing(false);
    setReady(false);
    setStatus("Memory captured ✨");
    socket.emit("capture-finished");
  };

  const takePhoto = () => {
    if (!connected || capturing) {
      if (!connected) setError("Wait until both cameras are connected.");
      return;
    }

    setError("");

    // The shutter is the only "ready" action. Both people can press it
    // whenever they want; capture starts automatically once both are ready.
    if (ready) {
      setReady(false);
      socket.emit("set-ready", false);
      setStatus("Ready cancelled — press the shutter when you're ready.");
      return;
    }

    setReady(true);
    socket.emit("set-ready", true);
    setStatus("You're ready — waiting for your partner…");
  };

  const downloadPhoto = () => {
    if (!photoUrl) return;

    if (!secretMessage.trim()) {
      const link = document.createElement("a");
      link.href = photoUrl;
      link.download = `photobooth-${Date.now()}.png`;
      link.click();
      return;
    }

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height + 110;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fffdf8";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      ctx.fillStyle = "#191715";
      ctx.font = "bold 18px Courier New";
      ctx.textAlign = "center";
      ctx.fillText("psst… " + secretMessage.trim().slice(0, 72), canvas.width / 2, canvas.height - 52);
      ctx.font = "12px Courier New";
      ctx.fillText("a little secret, just for you ♡", canvas.width / 2, canvas.height - 25);
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/jpeg", .95);
      link.download = `photobooth-${Date.now()}.jpg`;
      link.click();
    };
    img.src = photoUrl;
  };


  const toggleMirror = () => setMirror((value) => !value);

  const rebuildPhoto = async (nextFilter = filter, nextMode = stripMode) => {
    if (!shots.length) return;
    const oldFilter = filter;
    const oldMode = stripMode;
    setFilter(nextFilter);
    setStripMode(nextMode);
    // Build with explicit state values so the preview updates immediately.
    const originalFilter = filter;
    const originalMode = stripMode;
    setFilter(nextFilter);
    setStripMode(nextMode);
    const images = await Promise.all(shots.map(src => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = src;
    })));
    const width = nextMode === "polaroid" ? 920 : 760;
    const frameH = nextMode === "single" ? 480 : 430;
    const gap = 18;
    const header = nextMode === "strip" ? 80 : 120;
    const footer = 105;
    const height = header + images.length * frameH + Math.max(0, images.length - 1) * gap + footer + 36;
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = nextMode === "polaroid" ? "#fffdf8" : "#f5efe3";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#191715";
    ctx.font = "bold 30px Courier New";
    ctx.textAlign = "center";
    ctx.fillText(nextMode === "polaroid" ? "A LITTLE MEMORY" : "PHOTO-BOOTH", width / 2, 55);
    const filterMap = {original:"none",bw:"grayscale(1) contrast(1.12)",vintage:"sepia(.45) contrast(1.08) saturate(.82)",warm:"sepia(.18) saturate(1.25) brightness(1.04)",film:"contrast(1.16) saturate(.78)"};
    let y = header;
    images.slice(0, nextMode === "single" ? 1 : 4).forEach((img) => {
      ctx.save(); ctx.filter = filterMap[nextFilter] || "none";
      const targetW = width - 72, targetH = frameH, sourceRatio = img.width / img.height, targetRatio = targetW / targetH;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (sourceRatio > targetRatio) { sw = img.height * targetRatio; sx = (img.width - sw) / 2; }
      else { sh = img.width / targetRatio; sy = (img.height - sh) / 2; }
      ctx.drawImage(img, sx, sy, sw, sh, 36, y, targetW, targetH); ctx.restore();
      y += frameH + gap;
    });
    if (sticker) { ctx.font = "52px serif"; ctx.textAlign = "right"; ctx.fillText(sticker, width - 45, header + 65); }
    ctx.fillStyle = "#191715"; ctx.font = "bold 19px Courier New"; ctx.textAlign = "center";
    if (caption.trim()) ctx.fillText(caption.trim().slice(0, 42), width / 2, height - 62);
    ctx.font = "14px Courier New"; ctx.fillText(new Date().toLocaleDateString() + " · " + new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}), width / 2, height - 32);
    setPhotoUrl(canvas.toDataURL("image/jpeg", .94));
    setFilter(originalFilter === nextFilter ? nextFilter : nextFilter);
    setStripMode(originalMode === nextMode ? nextMode : nextMode);
  };

  const copyRoom = async () => {
    if (!roomIdRef.current) return;

    const url = `${window.location.origin}/?room=${roomIdRef.current}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const toggleMute = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (!audioTrack) return;
    audioTrack.enabled = !audioTrack.enabled;
    setMuted(!audioTrack.enabled);
  };

  const toggleCamera = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (!videoTrack) return;
    videoTrack.enabled = !videoTrack.enabled;
    setCameraOff(!videoTrack.enabled);
  };

  const toggleSpeaker = () => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = !remoteVideoRef.current.muted;
      setSpeakerOff(remoteVideoRef.current.muted);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedRoom = params.get("room");
    if (sharedRoom) setRoomCode(sharedRoom.toUpperCase());
  }, []);

  useEffect(() => {
    try {
      setMemories(JSON.parse(localStorage.getItem("photobooth-memories") || "[]"));
    } catch {}
  }, []);

  useEffect(() => {
    if (!shots.length) return;
    // Re-render the final image when the user edits its caption or sticker.
    rebuildPhoto(filter, stripMode);
  }, [caption, sticker]);

  // Always start/attach the local camera as soon as the booth opens.
  // This also covers the case where the stream was created before the <video>
  // element mounted.
  useEffect(() => {
    if (!inRoom) return;

    let cancelled = false;

    const attachCamera = async () => {
      try {
        const stream = await startCamera();
        if (cancelled || !localVideoRef.current) return;

        const video = localVideoRef.current;
        if (video.srcObject !== stream) video.srcObject = stream;
        await video.play().catch(() => {});
      } catch (err) {
        if (!cancelled) {
          console.error("[Photobooth] Camera start failed:", err);
          setError("Camera could not start. Check browser camera permission and reload.");
        }
      }
    };

    attachCamera();

    return () => {
      cancelled = true;
    };
  }, [inRoom]);

  // Keep the video element attached if React remounts it.
  useEffect(() => {
    if (!inRoom || !localVideoRef.current || !localStreamRef.current) return;
    const video = localVideoRef.current;
    if (video.srcObject !== localStreamRef.current) {
      video.srcObject = localStreamRef.current;
    }
    video.play().catch(() => {});
  }, [inRoom, cameraOff]);

  useEffect(() => {
    if (!socket) return;

    const onRoomJoined = ({ participants, isInitiator }) => {
      setInRoom(true);
      setStatus(
        participants.length === 1
          ? "Room ready — waiting for your partner…"
          : "Connecting your cameras…"
      );

      if (isInitiator && participants.length === 1) return;

      if (!isInitiator && participants.length === 2) {
        const peerId = participants.find((id) => id !== socket.id);
        if (!peerId) return;

        const pc = createPeerConnection(peerId);

        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            socket.emit("offer", {
              target: peerId,
              offer: pc.localDescription,
            });
          });
      }
    };

    const onPeerJoined = ({ socketId }) => {
      setPeerPresent(true);
      setStatus("Partner joined — connecting…");
      peerIdRef.current = socketId;
    };

    const onOffer = async ({ sender, offer }) => {
      let pc = peerConnectionRef.current;
      if (!pc) pc = createPeerConnection(sender);

      peerIdRef.current = sender;
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("answer", {
        target: sender,
        answer: pc.localDescription,
      });
    };

    const onAnswer = async ({ answer }) => {
      const pc = peerConnectionRef.current;
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    };

    const onIceCandidate = async ({ candidate }) => {
      const pc = peerConnectionRef.current;
      if (!pc || !candidate) return;

      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("ICE candidate error:", err);
      }
    };

    const onBoothState = ({ participants }) => {
      const me = participants.find((p) => p.id === socket.id);
      const partner = participants.find((p) => p.id !== socket.id);
      setReady(Boolean(me?.ready));
      setPartnerReady(Boolean(partner?.ready));
    };

    const onCaptureStart = ({ startAt }) => {
      if (capturing) return;
      setReady(true);
      setStatus("Both ready — get into position!");
      runCapture(startAt);
    };

    const onReadyError = ({ message }) => {
      setReady(false);
      setStatus(message || "Waiting for your partner…");
      console.warn("[Photobooth] ready rejected:", message);
    };

    const onRoomFull = () => {
      cleanupCall();
      setError("This room already has two people.");
      setStatus("Room full");
    };

    const onPeerLeft = () => {
      peerConnectionRef.current?.close();
      peerConnectionRef.current = null;
      peerIdRef.current = null;

      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

      setPeerPresent(false);
      connectedRef.current = false;
      setConnected(false);
      setStatus("Your partner left — waiting for someone else…");
    };

    socket.on("room-joined", onRoomJoined);
    socket.on("peer-joined", onPeerJoined);
    socket.on("offer", onOffer);
    socket.on("answer", onAnswer);
    socket.on("ice-candidate", onIceCandidate);
    socket.on("room-full", onRoomFull);
    socket.on("booth-state", onBoothState);
    socket.on("capture-start", onCaptureStart);
    socket.on("ready-error", onReadyError);
    socket.on("peer-left", onPeerLeft);

    return () => {
      socket.off("room-joined", onRoomJoined);
      socket.off("peer-joined", onPeerJoined);
      socket.off("offer", onOffer);
      socket.off("answer", onAnswer);
      socket.off("ice-candidate", onIceCandidate);
      socket.off("room-full", onRoomFull);
      socket.off("booth-state", onBoothState);
      socket.off("capture-start", onCaptureStart);
      socket.off("ready-error", onReadyError);
      socket.off("peer-left", onPeerLeft);
    };
  }, [socket, createPeerConnection, cleanupCall]);

  useEffect(() => {
    return () => {
      captureRunRef.current += 1;
      if (captureTimerRef.current) clearTimeout(captureTimerRef.current);
      captureTimerRef.current = null;
      cleanupCall();
    };
  }, [cleanupCall]);

  if (!inRoom) {
    return (
      <main className="home-screen">
        <div className="grain" />
        <section className="polaroid-card landing-card">
          <div className="washi-tape" />

          <div className="viewfinder landing-viewfinder">
            <div className="viewfinder-header">
              <div className="brand">
                <Camera className="brand-icon" size={20} />
                <span className="brand-text">PHOTO-BOOTH v1.001</span>
              </div>
              <div className="rec-dot" />
            </div>

            <div className="landing-content">
              <span className="eyebrow">TWO PEOPLE · ONE FRAME</span>
              <h1>Make a memory.</h1>
              <p>
                Join a private room, see each other live, and take a real
                photobooth picture together.
              </p>

              <div className="input-group">
                <label htmlFor="name">Your name</label>
                <input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="retro-input"
                  placeholder="Alex"
                  maxLength={24}
                />
              </div>

              <div className="input-group">
                <label htmlFor="code">Room code</label>
                <input
                  id="code"
                  value={roomCode}
                  onChange={(e) =>
                    setRoomCode(e.target.value.toUpperCase().slice(0, 8))
                  }
                  className="retro-input code-input"
                  placeholder="ABC123"
                  maxLength={8}
                />
              </div>

              {error && <div className="error-box">{error}</div>}

              <div className="landing-actions">
                <button className="primary-btn" onClick={() => joinRoom(roomCode)}>
                  Join room
                </button>
                <button className="secondary-btn" onClick={createRoom}>
                  Create a room
                </button>
              </div>
            </div>

            <div className="rainbow-strip">
              <div className="stripe-red" />
              <div className="stripe-orange" />
              <div className="stripe-yellow" />
              <div className="stripe-green" />
              <div className="stripe-blue" />
            </div>
          </div>

          <div className="polaroid-footer">
            <div className="caption">
              <span className="handwritten">Snap into the session...</span>
              <span className="date-stamp">
                {new Date().toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
            <Camera size={28} />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="booth-screen">
      <div className="booth-topbar">
        <div>
          <span className="brand-text">PHOTO-BOOTH</span>
          <span className={connected ? "live-pill" : "waiting-pill"}>
            <span className="status-dot" />
            {connected ? "LIVE" : "WAITING"}
          </span>
        </div>

        <button className="room-share" onClick={copyRoom}>
          <Copy size={15} />
          {copied ? "Copied!" : roomIdRef.current}
        </button>
      </div>

      <section className="booth">
        <div className="camera-stage">
          <div className="camera-label local-label">
            <span className="mini-dot" /> {name || "YOU"}
          </div>

          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className={cameraOff ? "video hidden-video" : mirror ? "video mirrored" : "video"}
          />

          <div className="remote-frame">
            {!peerPresent && (
              <div className="waiting-state">
                <Users size={38} />
                <strong>Waiting for your partner</strong>
                <span>Send them the room link.</span>
              </div>
            )}

            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="video remote-video"
            />

            <div className="camera-label remote-label">
              <span className="mini-dot" /> PARTNER
            </div>
          </div>

          {cameraOff && (
            <div className="camera-off-overlay">
              <CameraOff size={42} />
              <span>Camera off</span>
            </div>
          )}
          {countdown !== null && (
            <div className="capture-overlay">
              <div className="shot-label">SHOT {shotNumber} / 4</div>
              <div className="countdown-number">{countdown}</div>
            </div>
          )}
          {flash && <div className="camera-flash" />}
          {developing && (
            <div className="developing-overlay">
              <div className="developing-card">
                <Heart size={28} fill="currentColor" />
                <strong>Developing...</strong>
                <span>Your memory is almost ready</span>
              </div>
            </div>
          )}
        </div>

        <div className="booth-tools">
          <div className={ready ? "tool-btn active ready-indicator" : "tool-btn ready-indicator"}>
            {ready ? <Check size={16} /> : <Sparkles size={16} />}
            {ready ? "YOU'RE READY" : "PRESS SHUTTER TO READY"}
          </div>
          <button className="tool-btn" onClick={toggleMirror} disabled={capturing}>
            <FlipHorizontal size={16} /> {mirror ? "Mirror" : "Normal"}
          </button>
          <button className="tool-btn" onClick={() => setShowMemories(true)}>
            <Images size={16} /> Memories
          </button>
        </div>
        <div className="ready-status">
          <span className={ready ? "ready-dot on" : "ready-dot"} /> You
          <span className={partnerReady ? "ready-dot on" : "ready-dot"} /> Partner
          <span className="ready-copy">
            {ready && partnerReady ? "Both ready — camera starts automatically" : ready ? "Waiting for partner…" : "Press the shutter when ready"}
          </span>
        </div>

        <div className="booth-controls">
          <button className="control-btn" onClick={toggleMute} title="Mute">
            {muted ? <MicOff /> : <Mic />}
          </button>

          <button
            className="shutter"
            onClick={takePhoto}
            type="button"
            title={connected ? "Take photo" : "Take photo — waiting for both cameras"}
          >
            <span />
          </button>

          <button
            className="control-btn"
            onClick={toggleCamera}
            title="Camera"
          >
            {cameraOff ? <CameraOff /> : <Camera />}
          </button>
        </div>

        <div className="secondary-controls">
          <button className="text-control" onClick={() => setSoundOn((value) => !value)}>
            {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
            {soundOn ? "Camera sound" : "Silent"}
          </button>
          <button className="text-control" onClick={toggleSpeaker}>
            {speakerOff ? <VolumeX size={16} /> : <Volume2 size={16} />}
            {speakerOff ? "Partner muted" : "Partner sound"}
          </button>

          <button className="text-control leave" onClick={leaveRoom}>
            <PhoneOff size={16} />
            Leave
          </button>
        </div>

        <p className="booth-status">{status}</p>
      </section>

      {photoUrl && (
        <div className="photo-modal">
          <div className="photo-card editor-card">
            <button className="close-photo" onClick={() => setPhotoUrl(null)} aria-label="Retake">
              <RotateCcw size={18} />
            </button>
            <img className={`photo-preview ${filter}`} src={photoUrl} alt="Your photobooth memory" />

            <div className="editor-section">
              <div className="editor-title"><Wand2 size={15} /> LOOK</div>
              <div className="chip-row">
                {[
                  ["original","Original"],["bw","B&W"],["vintage","Vintage"],["warm","Warm"],["film","Film"]
                ].map(([key,label]) => (
                  <button key={key} className={filter === key ? "chip selected" : "chip"} onClick={() => rebuildPhoto(key, stripMode)}>{label}</button>
                ))}
              </div>
            </div>

            <div className="editor-section">
              <div className="editor-title">FORMAT</div>
              <div className="chip-row">
                {[
                  ["strip","4-shot strip"],["polaroid","Polaroid"],["single","Single"]
                ].map(([key,label]) => (
                  <button key={key} className={stripMode === key ? "chip selected" : "chip"} onClick={() => rebuildPhoto(filter, key)}>{label}</button>
                ))}
              </div>
            </div>

            <div className="editor-section editor-row">
              <input className="caption-input" value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={42} placeholder="Write something..." />
              <button className="sticker-btn" onClick={() => setSticker(sticker ? "" : "❤️")} title="Sticker">❤️</button>
              <button className="sticker-btn" onClick={() => setSticker(sticker === "✨" ? "" : "✨")} title="Sparkle">✨</button>
            </div>

            <div className="editor-section">
              <button className="secret-toggle" onClick={() => setShowSecret(!showSecret)}>
                <Send size={14} /> {showSecret ? "Hide secret message" : "Add a secret message"}
              </button>
              {showSecret && (
                <input className="caption-input secret-input" value={secretMessage} onChange={(e) => setSecretMessage(e.target.value)} maxLength={80} placeholder="psst... something only they should read ❤️" />
              )}
            </div>

            <div className="photo-actions">
              <button className="secondary-btn" onClick={() => { setPhotoUrl(null); setShots([]); }}>Retake</button>
              <button className="primary-btn" onClick={downloadPhoto}>
                <Download size={17} /> Save photo
              </button>
            </div>
          </div>
        </div>
      )}

      {showMemories && (
        <div className="photo-modal" onClick={() => setShowMemories(false)}>
          <div className="memories-card" onClick={(e) => e.stopPropagation()}>
            <div className="memories-header">
              <div><Images size={18} /> <strong>OUR MEMORIES</strong></div>
              <button className="close-memory" onClick={() => setShowMemories(false)}>×</button>
            </div>
            {memories.length ? (
              <div className="memory-grid">
                {memories.map((memory) => (
                  <button key={memory.id} className="memory-item" onClick={() => { setPhotoUrl(memory.url); setShowMemories(false); }}>
                    <img src={memory.url} alt={memory.caption} />
                    <span>{memory.caption}</span>
                    <small>{memory.date}</small>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-memories"><Heart size={32} /><p>Your first memory is waiting.</p></div>
            )}
          </div>
        </div>
      )}

    </main>
  );
};

export default Home;
