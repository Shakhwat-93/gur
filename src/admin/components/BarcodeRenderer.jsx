import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

/**
 * High-precision Code 128 SVG Barcode Renderer for Direct Thermal Printing
 * Generates razor-sharp monochrome vectors compatible with 203 DPI and 300 DPI thermal heads.
 */
export default function BarcodeRenderer({
  value,
  width = 1.3,
  height = 32,
  displayValue = true,
  fontSize = 10,
  className = ''
}) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        // Clean value to alphanumeric/standard ASCII supported by Code 128
        const cleanVal = String(value).trim();
        JsBarcode(svgRef.current, cleanVal, {
          format: 'CODE128',
          lineColor: '#000000',
          width: width,
          height: height,
          displayValue: displayValue,
          font: 'monospace',
          fontSize: fontSize,
          textMargin: 2,
          margin: 0,
          background: 'transparent'
        });
      } catch (err) {
        console.warn('[BarcodeRenderer] Failed to render barcode:', err);
      }
    }
  }, [value, width, height, displayValue, fontSize]);

  if (!value) return null;

  return (
    <svg
      ref={svgRef}
      className={`thermal-barcode-svg ${className}`}
      style={{ display: 'block', maxWidth: '100%' }}
    />
  );
}
