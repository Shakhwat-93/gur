import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/**
 * High-contrast QR Code Renderer for Direct Thermal Printing
 * Generates crisp 1-bit monochrome data URLs optimized for thermal paper scanners.
 */
export default function QrCodeRenderer({
  value,
  size = 54,
  className = ''
}) {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    let isMounted = true;
    if (value) {
      QRCode.toDataURL(String(value).trim(), {
        width: size * 2, // 2x density for razor-sharp thermal rendering
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'M'
      })
        .then((url) => {
          if (isMounted) setDataUrl(url);
        })
        .catch((err) => {
          console.warn('[QrCodeRenderer] Failed to generate QR:', err);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [value, size]);

  if (!value || !dataUrl) {
    return <div style={{ width: size, height: size }} />;
  }

  return (
    <img
      src={dataUrl}
      alt={`QR Code: ${value}`}
      className={`thermal-qrcode-img ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        display: 'block',
        imageRendering: 'pixelated'
      }}
    />
  );
}
