import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  KeyRound,
  Mail,
  Sparkles
} from 'lucide-react';
import { login, getLockoutState } from '../authService';
import { useCms } from '../../context/CmsContext';
import './adminLogin.css';

export default function AdminLogin({ onLoginSuccess, onNavigateStore }) {
  const { siteSettings } = useCms();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shake, setShake] = useState(false);
  const [lockoutSec, setLockoutSec] = useState(0);

  // Check lockout on mount and poll countdown if locked
  useEffect(() => {
    const checkLock = () => {
      const state = getLockoutState();
      if (state.isLocked) {
        setLockoutSec(state.remainingSeconds);
      } else {
        setLockoutSec(0);
      }
    };
    checkLock();
    const interval = setInterval(checkLock, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setErrorMessage('অনুগ্রহ করে অ্যাডমিন পাসওয়ার্ড লিখুন।');
      triggerShake();
      return;
    }

    if (lockoutSec > 0) return;

    setIsSubmitting(true);
    setErrorMessage('');

    setTimeout(() => {
      const res = login(email, password, rememberMe);
      setIsSubmitting(false);

      if (res.success) {
        onLoginSuccess();
      } else {
        setErrorMessage(res.message);
        triggerShake();
      }
    }, 300);
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const isLocked = lockoutSec > 0;

  return (
    <div className="hbz-login-wrapper">
      {/* Background Ambience Elements */}
      <div className="hbz-login-bg-glow glow-1" />
      <div className="hbz-login-bg-glow glow-2" />

      {/* Top Header Return Button */}
      <div className="hbz-login-topbar">
        <button
          type="button"
          onClick={onNavigateStore}
          className="hbz-login-back-btn"
          title="Return to public landing page"
        >
          <ArrowLeft size={16} />
          <span>ল্যান্ডিং পেজে ফিরে যান</span>
        </button>
      </div>

      <div className={`hbz-login-card ${shake ? 'hbz-shake' : ''}`}>
        {/* Brand & Security Header */}
        <div className="hbz-login-header">
          <div className="hbz-login-badge">
            <ShieldCheck size={14} className="hbz-badge-icon" />
            <span>ম্যাংগো গার্ডেন অ্যাডমিন পোর্টাল</span>
          </div>

          <h1 className="hbz-login-title">
            {siteSettings?.store_name || 'ম্যাংগো গার্ডেন'} অ্যাডমিন
          </h1>
          <p className="hbz-login-subtitle">
            অর্ডার, ডেলিভারি ও ওয়েবসাইট কনফিগারেশন অ্যাক্সেস করতে আপনার ইমেইল ও পাসওয়ার্ড দিন।
          </p>
        </div>

        {/* Error / Lockout Alert */}
        {isLocked ? (
          <div className="hbz-login-alert alert-locked">
            <Lock size={16} />
            <span>অতিরিক্ত ভুল চেষ্টার কারণে অ্যাডমিন লক হয়েছে। অপেক্ষা করুন: <strong>{lockoutSec}s</strong></span>
          </div>
        ) : errorMessage ? (
          <div className="hbz-login-alert alert-error">
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="hbz-login-form">
          {/* Email Input */}
          <div className="hbz-input-group">
            <label htmlFor="hbz-email" className="hbz-input-label">
              অ্যাডমিন ইমেইল (Email)
            </label>
            <div className="hbz-input-box">
              <span className="hbz-input-icon">
                <Mail size={18} />
              </span>
              <input
                id="hbz-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                disabled={isLocked || isSubmitting}
                placeholder="আপনার ইমেইল অ্যাড্রেস লিখুন"
                className="hbz-input-field"
                autoComplete="username"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="hbz-input-group">
            <label htmlFor="hbz-passcode" className="hbz-input-label">
              অ্যাডমিন পাসওয়ার্ড (Password)
            </label>
            <div className="hbz-input-box">
              <span className="hbz-input-icon">
                <Lock size={18} />
              </span>
              <input
                id="hbz-passcode"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                disabled={isLocked || isSubmitting}
                placeholder="আপনার পাসওয়ার্ড লিখুন"
                className="hbz-input-field"
                autoFocus
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="hbz-toggle-visibility"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Remember Me Option */}
          <div className="hbz-login-options">
            <label className="hbz-checkbox-label">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="hbz-checkbox-input"
              />
              <span>এই ব্রাউজারে লগইন মনে রাখুন (Remember Me)</span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLocked || isSubmitting}
            className={`hbz-submit-btn ${isSubmitting ? 'loading' : ''}`}
          >
            {isSubmitting ? (
              <span className="hbz-btn-spinner" />
            ) : (
              <>
                <span>লগইন করুন</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Security Footnote */}
        <div className="hbz-login-footer">
          <div className="hbz-footer-shield">
            <Sparkles size={13} color="#16a34a" />
            <span>Protected by End-to-End Session Encryption & Brute-Force Rate Limiting</span>
          </div>
        </div>
      </div>
    </div>
  );
}
