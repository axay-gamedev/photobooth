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

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const peerIdRef = useRef(null);
  const roomIdRef = useRef("");

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
          setConnected(true);
          setStatus("Connected — say cheese!");
        } else if (state === "disconnected") {
          setConnected(false);
          setStatus("Connection interrupted");
        } else if (state === "failed") {
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

  const takePhoto = async () => {
    const localVideo = localVideoRef.current;
    const remoteVideo = remoteVideoRef.current;

    console.log("[Photobooth] Shutter clicked", {
      localReadyState: localVideo?.readyState,
      localWidth: localVideo?.videoWidth,
      localHeight: localVideo?.videoHeight,
      remoteReadyState: remoteVideo?.readyState,
      remoteWidth: remoteVideo?.videoWidth,
      remoteHeight: remoteVideo?.videoHeight,
      connected,
    });

    if (!localVideo || !remoteVideo) {
      setError("Camera preview is not ready yet.");
      setStatus("Camera not ready");
      return;
    }

    setError("");
    setStatus("Capturing your photo…");

    // Wait until both video elements have decoded an actual frame.
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

    try {
      await Promise.all([
        localVideo.play().catch(() => {}),
        remoteVideo.play().catch(() => {}),
        waitForFrame(localVideo),
        waitForFrame(remoteVideo),
      ]);
    } catch (err) {
      console.error("Photo capture preparation failed:", err);
    }

    if (
      !localVideo.videoWidth ||
      !localVideo.videoHeight ||
      !remoteVideo.videoWidth ||
      !remoteVideo.videoHeight
    ) {
      console.warn("[Photobooth] Shutter blocked: both camera frames are not ready", {
        localWidth: localVideo.videoWidth,
        localHeight: localVideo.videoHeight,
        remoteWidth: remoteVideo.videoWidth,
        remoteHeight: remoteVideo.videoHeight,
        connected,
      });
      setStatus("Waiting for both camera frames…");
      setError("Both camera videos need to be visible before taking the photo.");
      return;
    }

    const canvas = document.createElement("canvas");
    const width = 1200;
    const height = 760;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      setError("Could not create the photo canvas.");
      return;
    }

    ctx.fillStyle = "#f5efe3";
    ctx.fillRect(0, 0, width, height);

    const gap = 14;
    const photoW = (width - 56 - gap) / 2;
    const photoH = height - 148;

    const drawCover = (video, x, y, w, h, mirror = true) => {
      const sourceRatio = video.videoWidth / video.videoHeight;
      const targetRatio = w / h;

      let sx = 0;
      let sy = 0;
      let sw = video.videoWidth;
      let sh = video.videoHeight;

      if (sourceRatio > targetRatio) {
        sw = video.videoHeight * targetRatio;
        sx = (video.videoWidth - sw) / 2;
      } else {
        sh = video.videoWidth / targetRatio;
        sy = (video.videoHeight - sh) / 2;
      }

      ctx.save();

      if (mirror) {
        ctx.translate(x + w, y);
        ctx.scale(-1, 1);
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
      } else {
        ctx.drawImage(video, sx, sy, sw, sh, x, y, w, h);
      }

      ctx.restore();
    };

    // Your camera is mirrored; the partner's camera is shown naturally.
    drawCover(localVideo, 28, 28, photoW, photoH, true);
    drawCover(
      remoteVideo,
      28 + photoW + gap,
      28,
      photoW,
      photoH,
      false
    );

    ctx.fillStyle = "#191715";
    ctx.fillRect(0, height - 92, width, 92);

    ctx.fillStyle = "#f5efe3";
    ctx.font = "bold 28px Courier New";
    ctx.textAlign = "left";
    ctx.fillText("PHOTO-BOOTH", 30, height - 48);

    ctx.font = "18px Courier New";
    ctx.textAlign = "right";
    ctx.fillText(new Date().toLocaleDateString(), width - 30, height - 48);

    try {
      const image = canvas.toDataURL("image/png");

      if (!image || image === "data:,") {
        throw new Error("Canvas returned an empty image.");
      }

      setPhotoUrl(image);
      setStatus("Photo captured! ✨");
    } catch (err) {
      console.error("Photo creation failed:", err);
      setError("Could not create the photo. Check the browser console.");
      setStatus("Photo capture failed");
    }
  };

  const downloadPhoto = () => {
    if (!photoUrl) return;

    const link = document.createElement("a");
    link.href = photoUrl;
    link.download = `photobooth-${Date.now()}.png`;
    link.click();
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

  // The camera stream can be created before the booth video element mounts.
  // Re-attach it after React renders the booth so the local video actually receives frames.
  useEffect(() => {
    if (!inRoom || !localVideoRef.current || !localStreamRef.current) return;

    const video = localVideoRef.current;
    video.srcObject = localStreamRef.current;

    video.play().catch((err) => {
      console.warn("[Photobooth] Local video autoplay failed:", err);
    });
  }, [inRoom]);

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
      setConnected(false);
      setStatus("Your partner left — waiting for someone else…");
    };

    socket.on("room-joined", onRoomJoined);
    socket.on("peer-joined", onPeerJoined);
    socket.on("offer", onOffer);
    socket.on("answer", onAnswer);
    socket.on("ice-candidate", onIceCandidate);
    socket.on("room-full", onRoomFull);
    socket.on("peer-left", onPeerLeft);

    return () => {
      socket.off("room-joined", onRoomJoined);
      socket.off("peer-joined", onPeerJoined);
      socket.off("offer", onOffer);
      socket.off("answer", onAnswer);
      socket.off("ice-candidate", onIceCandidate);
      socket.off("room-full", onRoomFull);
      socket.off("peer-left", onPeerLeft);
    };
  }, [socket, createPeerConnection, cleanupCall]);

  useEffect(() => {
    return () => cleanupCall();
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
            className={cameraOff ? "video hidden-video" : "video mirrored"}
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
          <button className="text-control" onClick={toggleSpeaker}>
            {speakerOff ? <VolumeX size={16} /> : <Volume2 size={16} />}
            {speakerOff ? "Sound off" : "Sound on"}
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
          <div className="photo-card">
            <button
              className="close-photo"
              onClick={() => setPhotoUrl(null)}
              aria-label="Retake"
            >
              <RotateCcw size={18} />
            </button>

            <img src={photoUrl} alt="Your photobooth memory" />

            <div className="photo-actions">
              <button className="secondary-btn" onClick={() => setPhotoUrl(null)}>
                Retake
              </button>
              <button className="primary-btn" onClick={downloadPhoto}>
                <Download size={17} />
                Save photo
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default Home;
