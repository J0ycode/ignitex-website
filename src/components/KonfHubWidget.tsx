import React, { useEffect, useRef } from 'react';

interface KonfHubWidgetProps {
  onPaymentComplete?: () => void;
}

export default function KonfHubWidget({ onPaymentComplete }: KonfHubWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    
    // Clear any existing scripts if re-mounting
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://widget.konfhub.com/widget.js';
    script.setAttribute('button_id', 'btn_4053dd51d1b4');
    script.async = true;
    
    containerRef.current.appendChild(script);

    // Listen for KonfHub widget success events (postMessage)
    const handleMessage = (event: MessageEvent) => {
      // KonfHub typically sends a message on completion
      if (event.origin.includes('konfhub.com')) {
        console.log("KonfHub Event:", event.data);
        // Sometimes it's a string, sometimes an object
        const dataStr = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
        if (dataStr.toLowerCase().includes('success') || dataStr.toLowerCase().includes('completed') || dataStr.toLowerCase().includes('closed')) {
          // If we detect a successful payment or widget close, trigger the callback
          if (onPaymentComplete) {
            onPaymentComplete();
          } else {
            // Fallback just in case
            const params = new URLSearchParams(window.location.search)
            const regId = params.get('id') || 'unknown'
            const team = params.get('team') || 'Your Team'
            window.location.href = `/confirmation?id=${regId}&team=${encodeURIComponent(team)}`
          }
        }
      }
    }
    
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, []);

  return <div ref={containerRef} className="flex justify-center" />;
}
