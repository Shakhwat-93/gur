import React, { useState, useEffect, useRef } from 'react';
import { Lock, X, Check, AlertCircle } from 'lucide-react';

export default function PinModal({ isOpen, onClose, onSuccess }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [shake, setShake] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError(false);
      setErrorMessage('');
      setShake(false);
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (pin === '3232') {
      setError(false);
      onSuccess();
    } else {
      setError(true);
      setErrorMessage('Incorrect PIN. Please try again.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPin('');
      if (inputRef.current) inputRef.current.focus();
    }
  };

  return (
    <div
      className="adm-modal-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px'
      }}
    >
      <div
        className={`adm-pin-modal ${shake ? 'hbz-shake' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '380px',
          background: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          padding: '28px 24px',
          boxSizing: 'border-box',
          position: 'relative',
          textAlign: 'center'
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: '#f1f5f9',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#64748b',
            transition: 'all 0.15s ease'
          }}
          title="Close"
        >
          <X size={16} />
        </button>

        {/* Lock Icon */}
        <div
          style={{
            width: '54px',
            height: '54px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
            border: '2px solid #fed7aa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto',
            color: '#ea580c'
          }}
        >
          <Lock size={26} />
        </div>

        <h3 style={{ margin: '0 0 6px 0', fontSize: '19px', fontWeight: 700, color: '#111827' }}>
          Security PIN Required
        </h3>
        <p style={{ margin: '0 0 20px 0', fontSize: '13.5px', color: '#64748b', lineHeight: 1.5 }}>
          Enter the 4-digit PIN to reveal revenue metrics.
        </p>

        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '8px 12px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#dc2626',
              fontSize: '13px',
              fontWeight: 500,
              marginBottom: '16px'
            }}
          >
            <AlertCircle size={15} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              maxLength={4}
              pattern="[0-9]*"
              value={pin}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                setPin(val);
                if (error) setError(false);
              }}
              placeholder="••••"
              style={{
                width: '180px',
                padding: '12px 16px',
                fontSize: '28px',
                fontWeight: 700,
                textAlign: 'center',
                letterSpacing: '12px',
                border: error ? '2px solid #ef4444' : '2px solid #e2e8f0',
                borderRadius: '12px',
                outline: 'none',
                background: '#f8fafc',
                color: '#1e293b',
                transition: 'all 0.15s ease',
                boxShadow: error ? '0 0 0 3px rgba(239, 68, 68, 0.15)' : 'none'
              }}
              onFocus={(e) => {
                if (!error) e.target.style.borderColor = '#ea580c';
              }}
              onBlur={(e) => {
                if (!error) e.target.style.borderColor = '#e2e8f0';
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '11px 16px',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                color: '#475569',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pin.length === 0}
              style={{
                flex: 1,
                padding: '11px 16px',
                borderRadius: '10px',
                border: 'none',
                background: pin.length > 0 ? 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)' : '#cbd5e1',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 600,
                cursor: pin.length > 0 ? 'pointer' : 'not-allowed',
                boxShadow: pin.length > 0 ? '0 4px 12px rgba(234, 88, 12, 0.3)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              Unlock
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
