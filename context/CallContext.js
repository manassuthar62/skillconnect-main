'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { getSupabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import CallScreen from '@/components/CallScreen';

const CallContext = createContext();

export const useCall = () => useContext(CallContext);

export const CallProvider = ({ children }) => {
  const { currentUser } = useAuth();
  
  const [incomingCall, setIncomingCall] = useState(null); // { caller_id, type, offer, caller_name, caller_photo }
  const [activeCall, setActiveCall]     = useState(null); // { user_id, type, status: 'calling'|'connected', isCaller: boolean }
  
  const [localStream, setLocalStream]   = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  
  const pcRef = useRef(null);
  const channelRef = useRef(null);
  const localStreamRef = useRef(null); // Keep a ref for easy cleanup

  // Initialize signaling channel
  useEffect(() => {
    if (!currentUser) return;
    const sb = getSupabase();
    
    // Listen for incoming signaling via our personal channel
    const channel = sb.channel(`webrtc:${currentUser.id}`);
    channelRef.current = channel;

    channel.on('broadcast', { event: 'OFFER' }, async (payload) => {
      // If we're already in a call, we should probably send a BUSY signal, but for now we'll just ignore it.
      if (activeCall || incomingCall) return;
      
      const { offer, type, caller_id, caller_name, caller_photo } = payload.payload;
      setIncomingCall({ caller_id, type, offer, caller_name, caller_photo });
    });

    channel.on('broadcast', { event: 'ANSWER' }, async (payload) => {
      const { answer } = payload.payload;
      if (pcRef.current) {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
          setActiveCall(prev => prev ? { ...prev, status: 'connected' } : null);
        } catch (err) {
          console.error('Error setting remote answer', err);
        }
      }
    });

    channel.on('broadcast', { event: 'ICE_CANDIDATE' }, async (payload) => {
      const { candidate } = payload.payload;
      if (pcRef.current && candidate) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Error adding ICE candidate', err);
        }
      }
    });

    channel.on('broadcast', { event: 'END_CALL' }, () => {
      toast('Call ended', { icon: '📞' });
      cleanupCall();
    });

    channel.subscribe();

    return () => {
      sb.removeChannel(channel);
      cleanupCall(); // safety
    };
  }, [currentUser, activeCall, incomingCall]);

  const sendBroadcast = (targetUserId, event, payload) => {
    const sb = getSupabase();
    const ch = sb.channel(`webrtc:${targetUserId}`);
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        ch.send({
          type: 'broadcast',
          event,
          payload
        }).then(() => {
          // Cleanup this temporary sending channel
          sb.removeChannel(ch);
        });
      }
    });
  };

  const setupWebRTC = async (type, isCaller, targetUserId) => {
    try {
      // 1. Get media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: type === 'video' ? { facingMode: 'user' } : false,
        audio: true
      });
      setLocalStream(stream);
      localStreamRef.current = stream;

      // 2. Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      pcRef.current = pc;

      // 3. Add tracks
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // 4. Handle incoming remote stream
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      // 5. Handle ICE candidates (send to peer)
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendBroadcast(targetUserId, 'ICE_CANDIDATE', { candidate: event.candidate });
        }
      };

      return pc;
    } catch (err) {
      console.error('Failed to get user media', err);
      if (!navigator.mediaDevices || (window.location.protocol === 'http:' && window.location.hostname !== 'localhost')) {
        toast.error('Calling requires HTTPS or localhost. Deploy to Vercel to test on mobile.', { duration: 5000 });
      } else {
        toast.error('Microphone/Camera access denied');
      }
      return null;
    }
  };

  const startCall = async (type, targetUserId) => {
    setActiveCall({ user_id: targetUserId, type, status: 'calling', isCaller: true });
    
    const pc = await setupWebRTC(type, true, targetUserId);
    if (!pc) {
      cleanupCall();
      return;
    }

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      sendBroadcast(targetUserId, 'OFFER', { 
        offer, 
        type, 
        caller_id: currentUser.id,
        caller_name: currentUser.name || currentUser.user_metadata?.name || 'Someone',
        caller_photo: currentUser.photo_url || currentUser.user_metadata?.avatar_url || ''
      });
    } catch (err) {
      console.error('Error creating offer', err);
      cleanupCall();
    }
  };

  const answerCall = async () => {
    if (!incomingCall) return;
    const { caller_id, type, offer } = incomingCall;
    
    setActiveCall({ user_id: caller_id, type, status: 'connected', isCaller: false });
    setIncomingCall(null);
    
    const pc = await setupWebRTC(type, false, caller_id);
    if (!pc) {
      declineCall();
      return;
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      sendBroadcast(caller_id, 'ANSWER', { answer });
    } catch (err) {
      console.error('Error answering call', err);
      cleanupCall();
    }
  };

  const declineCall = () => {
    if (incomingCall) {
      sendBroadcast(incomingCall.caller_id, 'END_CALL', {});
      setIncomingCall(null);
    }
  };

  const endActiveCall = () => {
    if (activeCall) {
      sendBroadcast(activeCall.user_id, 'END_CALL', {});
    }
    cleanupCall();
  };

  const cleanupCall = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setActiveCall(null);
    setIncomingCall(null);
  };

  return (
    <CallContext.Provider value={{ startCall }}>
      {children}
      {/* Global Call UI Overlay */}
      {(activeCall || incomingCall) && (
        <CallScreen 
          incomingCall={incomingCall}
          activeCall={activeCall}
          localStream={localStream}
          remoteStream={remoteStream}
          onAnswer={answerCall}
          onDecline={declineCall}
          onEnd={endActiveCall}
        />
      )}
    </CallContext.Provider>
  );
};
