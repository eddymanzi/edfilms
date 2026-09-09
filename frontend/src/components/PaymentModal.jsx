import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, API_URL } from '../utils/api';
import { getCustomerReference } from '../utils/customerReference';

const TERMINAL_STATUSES = ['SUCCESS', 'FAILED', 'CANCELLED', 'EXPIRED'];

function maskPhone(phone) {
  return phone ? phone.slice(0, 2) + '•'.repeat(phone.length - 4) + phone.slice(-2) : '';
}

function PaymentModal({ movie, action = 'watch', onClose, onSuccess }) {
  const [step, setStep] = useState('form');
  const [phone, setPhone] = useState('');
  const [paymentId, setPaymentId] = useState(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);
  const submittingRef = useRef(false);
  const pollRef = useRef(null);

  const price = movie?.priceRwf || movie?.price_rwf || 0;
  const customerReference = getCustomerReference();

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    if (step === 'checking' && paymentId) {
      checkStatus(paymentId);
      return;
    }
    if (step === 'checking' && status && TERMINAL_STATUSES.includes(status)) {
      setStep(status === 'SUCCESS' ? 'success' : 'failed');
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
  }, [step, paymentId, status]);

  const checkStatus = (id) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await apiFetch(`/api/payments/${id}/status`);
        const newStatus = res?.data?.status;
        setStatus(newStatus);
        if (TERMINAL_STATUSES.includes(newStatus)) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setStep(newStatus === 'SUCCESS' ? 'success' : 'failed');
          if (newStatus === 'SUCCESS' && onSuccess) onSuccess(res.data);
        }
      } catch (err) {
        setError(err.message);
      }
    }, 3000);
  };

  const handleContinue = async (e) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    setChecking(true);

    try {
      const res = await apiFetch('/api/payments/initiate', {
        method: 'POST',
        body: {
          movieId: movie.id,
          customerReference,
          phoneNumber: phone
        }
      });

      const payment = res?.data;
      if (!payment || !payment.id) throw new Error('Could not create payment');

      setPaymentId(payment.id);
      setStep('checking');
      checkStatus(payment.id);
    } catch (err) {
      setError(err.message);
      setStep('failed');
    } finally {
      submittingRef.current = false;
      setChecking(false);
    }
  };

  const handleTryAgain = () => {
    setError(null);
    setStatus(null);
    setPaymentId(null);
    setStep('form');
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const posterUrl = movie?.poster ? `${API_URL}/api/posters/${movie.poster}` : null;

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && step === 'form') onClose(); }}>
      <div className="payment-modal" role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>

        <div className="payment-modal-hero">
          <div className="payment-modal-poster">
            {posterUrl ? <img src={posterUrl} alt={movie?.title} /> : <div className="poster-placeholder">No Poster</div>}
          </div>
          <div className="payment-modal-summary">
            <h3>{movie?.title}</h3>
            <div className="payment-modal-price">
              <span className="access-badge access-paid">{action === 'watch' ? 'PAID • WATCH' : 'PAID • DOWNLOAD'}</span>
              <strong>{Number(price).toLocaleString()} RWF</strong>
            </div>
            {step === 'form' && <p className="payment-modal-note">Pay securely with Mobile Money (MoMo)</p>}
          </div>
        </div>

        {step === 'form' && (
          <div className="payment-modal-body">
            <form onSubmit={handleContinue}>
              <label>MoMo Phone Number</label>
              <input
                type="tel"
                inputMode="numeric"
                placeholder="07XXXXXXXX"
                value={phone}
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^0-9]/g, '');
                  setPhone(digits.slice(0, 10));
                }}
                pattern="07[0-9]{8}"
                maxLength={10}
                required
              />
              <p className="hint">Enter your mobile money number. You will approve the payment on your phone.</p>

              {error && <div className="payment-error">{error}</div>}

              <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={checking || !/^07[0-9]{8}$/.test(phone)}>
                {checking ? 'Starting payment...' : 'CONTINUE PAYMENT'}
              </button>
            </form>
          </div>
        )}

        {step === 'checking' && (
          <div className="payment-modal-body payment-confirm">
            <div className="payment-spinner"><div className="spinner"></div></div>
            <h4>Payment request sent.</h4>
            <p>Please approve the payment on your phone.</p>
            <p className="payment-checking">Checking payment{error ? <span> — {error}</span> : ''}...</p>
            <p className="hint">Customer: {maskPhone(phone)}</p>
          </div>
        )}

        {step === 'success' && (
          <div className="payment-modal-body payment-result">
            <div className="payment-success-icon">✓</div>
            <h4>Payment successful.</h4>
            <p>Your movie is now unlocked.</p>
            <div className="payment-result-actions">
              <Link to={`/watch/${movie?.slug}?unlock=1`} className="btn btn-primary">
                WATCH NOW
              </Link>
              {movie?.downloadAccess !== 'FREE' && movie?.download_access !== 'FREE' ? (
                null
              ) : (
                <Link to={`/watch/${movie?.slug}?unlock=1&download=1`} className="btn btn-outline">
                  DOWNLOAD
                </Link>
              )}
            </div>
          </div>
        )}

        {step === 'failed' && (
          <div className="payment-modal-body payment-result">
            <div className="payment-failed-icon">×</div>
            <h4>Payment failed.</h4>
            <p>{error || 'The payment was unsuccessful. Please try again.'}</p>
            <div className="payment-result-actions">
              <button className="btn btn-primary" onClick={handleTryAgain}>TRY AGAIN</button>
              <button className="btn btn-outline" onClick={onClose}>Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PaymentModal;