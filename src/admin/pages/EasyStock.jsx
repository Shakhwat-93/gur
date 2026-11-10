import React, { useState, useEffect } from 'react';
import { Layers, Save, CheckCircle, AlertTriangle, PackageCheck, PackageX } from 'lucide-react';
import { useCms } from '../../context/CmsContext';

export default function EasyStock() {
  const { products, saveProduct, showToast } = useCms();
  const [saving, setSaving] = useState(false);
  const [stockList, setStockList] = useState([]);

  useEffect(() => {
    if (products && products.length > 0) {
      setStockList(
        products.map((p) => ({
          id: p.id,
          title: p.title,
          sku: p.sku || `MG-0${p.id}`,
          price: p.price,
          stock_qty: p.stock_qty ?? 150,
          status: p.status || 'active',
          images: p.images || ['/img/file_000000008a508211871f2da956f12e9c.png']
        }))
      );
    }
  }, [products]);

  const handleStockChange = (idx, value) => {
    const updated = [...stockList];
    updated[idx].stock_qty = parseInt(value, 10) || 0;
    setStockList(updated);
  };

  const handleStatusToggle = (idx) => {
    const updated = [...stockList];
    updated[idx].status = updated[idx].status === 'active' ? 'draft' : 'active';
    setStockList(updated);
  };

  const handleSaveStock = async () => {
    setSaving(true);
    try {
      for (const item of stockList) {
        const orig = products.find((p) => p.id === item.id);
        if (orig) {
          await saveProduct({
            ...orig,
            stock_qty: item.stock_qty,
            status: item.status
          });
        }
      }
      showToast('Stock inventory updated successfully');
    } catch (err) {
      console.error(err);
      showToast('Failed to update stock', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="easy-page-wrap">
      <div className="easy-card-header">
        <h2 className="easy-page-title">Stock & Inventory Management</h2>
        <p className="easy-page-desc">
          Manage package inventory counts and toggle availability between In Stock and Out of Stock.
        </p>
      </div>

      <div className="easy-form-stack">
        {stockList.map((item, idx) => (
          <div key={item.id} className="easy-subcard">
            <div className="easy-stock-item-row">
              <img
                src={item.images?.[0] || '/img/file_000000008a508211871f2da956f12e9c.png'}
                alt={item.title}
                className="easy-stock-thumb"
              />
              <div className="easy-stock-info">
                <h3 className="easy-stock-title">{item.title}</h3>
                <div className="easy-stock-meta">
                  <span>SKU: {item.sku}</span>
                  <span>Price: ৳ {item.price}</span>
                </div>
              </div>
              <div className="easy-stock-item-actions">
                <span
                  className={`easy-stock-status-pill ${item.status === 'active' ? 'active' : 'draft'}`}
                >
                  {item.status === 'active' ? 'In Stock' : 'Out of Stock'}
                </span>
                <label className="easy-switch">
                  <input
                    type="checkbox"
                    checked={item.status === 'active'}
                    onChange={() => handleStatusToggle(idx)}
                  />
                  <span className="easy-slider round"></span>
                </label>
              </div>
            </div>

            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f3f4f6' }}>
              <div style={{ maxWidth: '240px' }} className="easy-field-group">
                <label>Current Stock Quantity</label>
                <input
                  type="number"
                  className="easy-input"
                  value={item.stock_qty}
                  onChange={(e) => handleStockChange(idx, e.target.value)}
                  min="0"
                />
              </div>
              {item.stock_qty < 10 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#d97706', fontSize: '13px', marginTop: '6px' }}>
                  <AlertTriangle size={14} />
                  <span>Warning: Low stock inventory alert!</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Submit Button */}
        <div className="easy-submit-wrap">
          <button
            type="button"
            className="easy-save-btn"
            onClick={handleSaveStock}
            disabled={saving}
          >
            <Save size={18} />
            <span>{saving ? 'Saving...' : 'Save Stock Changes'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
