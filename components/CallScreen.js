import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff } from 'lucide-react';

export default function CallScreen({ 
  incomingCall, 
  activeCall, 
  localStream, 
  remoteStream, 
  onAnswer, 
  onDecline, 
  onEnd 
}) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  // Attach streams to video elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(t => t.enabled = isMuted);
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(t => t.enabled = isVideoOff);
      setIsVideoOff(!isVideoOff);
    }
  };

  // 1. INCOMING CALL RINGING UI
  if (incomingCall) {
    const isVideo = incomingCall.type === 'video';
    return (
      <div className="call-overlay">
        <div className="call-ringing-card">
          <div className="ring-pulse">
            {incomingCall.caller_photo ? (
              <Image src={incomingCall.caller_photo} alt="" width={80} height={80} className="avatar pulse-avatar" />
            ) : (
              <div className="avatar-placeholder pulse-avatar" style={{width: 80, height: 80, fontSize: 32}}>
                {incomingCall.caller_name?.[0] || '?'}
              </div>
            )}
          </div>
          <h2 style={{color: '#fff', marginTop: 16}}>{incomingCall.caller_name}</h2>
          <p style={{color: 'var(--t2)', marginBottom: 32}}>Incoming {isVideo ? 'Video' : 'Audio'} Call...</p>
          
          <div style={{display: 'flex', gap: 32}}>
            <button className="call-btn decline" onClick={onDecline}>
              <PhoneOff size={28} />
            </button>
            <button className="call-btn answer" onClick={onAnswer}>
              {isVideo ? <Video size={28} /> : <Phone size={28} />}
            </button>
          </div>
        </div>

        <style jsx>{`
          .call-overlay {
            position: fixed; inset: 0; z-index: 1000;
            background: rgba(0,0,0,0.85); backdrop-filter: blur(10px);
            display: flex; align-items: center; justify-content: center;
          }
          .call-ringing-card {
            display: flex; flex-direction: column; align-items: center;
          }
          .ring-pulse {
            position: relative; width: 100px; height: 100px; display: flex; align-items: center; justify-content: center;
          }
          .pulse-avatar {
            border: 3px solid var(--accent); z-index: 2;
          }
          .ring-pulse::before {
            content: ''; position: absolute; inset: -20px;
            border-radius: 50%; background: var(--accent); opacity: 0.3;
            animation: pulse 1.5s infinite; z-index: 1;
          }
          @keyframes pulse {
            0% { transform: scale(0.8); opacity: 0.5; }
            100% { transform: scale(1.5); opacity: 0; }
          }
          .call-btn {
            width: 64px; height: 64px; border-radius: 50%; border: none; cursor: pointer;
            display: flex; align-items: center; justify-content: center; color: #fff;
            transition: transform 0.2s; box-shadow: 0 4px 15px rgba(0,0,0,0.3);
          }
          .call-btn:hover { transform: scale(1.05); }
          .call-btn.decline { background: #ef4444; }
          .call-btn.answer { background: #22c55e; }
        `}</style>
      </div>
    );
  }

  // 2. ACTIVE CALL UI (Ongoing or Outgoing)
  if (activeCall) {
    const isVideo = activeCall.type === 'video';
    const isCalling = activeCall.status === 'calling';

    return (
      <div className="call-overlay active-call-bg">
        {/* Remote Video (Full Screen) */}
        {isVideo && (
          <video 
            ref={remoteVideoRef} 
            autoPlay 
            playsInline 
            className="remote-video" 
            style={{ display: remoteStream ? 'block' : 'none' }}
          />
        )}

        {/* Local Video (Floating Picture-in-Picture) */}
        {isVideo && localStream && (
          <div className="local-video-container">
            <video ref={localVideoRef} autoPlay playsInline muted className="local-video" />
          </div>
        )}

        <div className="call-info-top">
          <h2>{isCalling ? 'Calling...' : 'In Call'}</h2>
          <p>{isVideo ? 'Video' : 'Audio'} secured connection</p>
        </div>

        <div className="call-controls-bottom">
          <button className={`control-btn ${isMuted ? 'off' : ''}`} onClick={toggleMute}>
            {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
          </button>
          
          {isVideo && (
            <button className={`control-btn ${isVideoOff ? 'off' : ''}`} onClick={toggleVideo}>
              {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
            </button>
          )}

          <button className="control-btn end-call" onClick={onEnd}>
            <PhoneOff size={28} />
          </button>
        </div>

        <style jsx>{`
          .call-overlay {
            position: fixed; inset: 0; z-index: 1000;
            display: flex; flex-direction: column;
          }
          .active-call-bg { background: #111; }
          .remote-video {
            position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 1;
          }
          .local-video-container {
            position: absolute; top: 120px; right: 20px; width: 100px; height: 140px;
            border-radius: 12px; overflow: hidden; z-index: 5;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5); border: 2px solid rgba(255,255,255,0.2);
            background: #000;
          }
          .local-video {
            width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1);
          }
          .call-info-top {
            position: absolute; top: 0; left: 0; right: 0; z-index: 5;
            padding: 40px 20px 20px; background: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent);
            color: #fff; text-align: center;
          }
          .call-info-top h2 { font-size: 24px; font-weight: 500; margin-bottom: 4px; }
          .call-info-top p { font-size: 14px; opacity: 0.8; }
          
          .call-controls-bottom {
            position: absolute; bottom: 0; left: 0; right: 0; z-index: 5;
            padding: 40px 20px 60px; background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
            display: flex; justify-content: center; gap: 24px; align-items: center;
          }
          .control-btn {
            width: 56px; height: 56px; border-radius: 50%;
            background: rgba(255,255,255,0.2); border: none; color: #fff;
            display: flex; justify-content: center; align-items: center;
            backdrop-filter: blur(5px); cursor: pointer; transition: all 0.2s;
          }
          .control-btn.off { background: rgba(255,255,255,0.8); color: #000; }
          .control-btn.end-call { width: 64px; height: 64px; background: #ef4444; }
          .control-btn:hover { transform: scale(1.05); }
        `}</style>
      </div>
    );
  }

  return null;
}
