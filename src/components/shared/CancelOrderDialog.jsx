import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/useToast';
import { insertRow } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { XCircle, AlertCircle, ShoppingBag, Package, MapPin } from 'lucide-react';

const makeTimestamp = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ${d.getHours()}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export function CancelOrderDialog({ open, onClose, item, stageName, onSuccess }) {
  const { toast } = useToast();
  const [cancelQty, setCancelQty] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const totalQty = Number(item?.totalQuantity || item?.quantity || 0);
  const poNumber = item?.poNumber || '';
  const vendorName = item?.vendorName || '';
  const serialNo = item?.serialNo || item?.['Serial No'] || item?.['Serial NO'] || item?.srNo || item?.['Sr No'] || '';
  const location = item?.location || '';

  useEffect(() => {
    if (open) {
      setCancelQty('');
      setErrorMsg('');
      setIsSubmitting(false);
    }
  }, [open, item]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const qty = parseInt(cancelQty, 10);

    if (isNaN(qty) || qty <= 0) {
      setErrorMsg('Cancel quantity must be greater than 0.');
      return;
    }

    if (qty > totalQty) {
      setErrorMsg(`Cancel quantity cannot exceed total quantity (${totalQty.toLocaleString()}).`);
      return;
    }

    try {
      setIsSubmitting(true);
      const timestamp = makeTimestamp();

      // Column order: Timestamp | Serial No | PO Number | Vendor Name | Total Quantity | Stage Name | Cancel Qty
      const rowData = [
        timestamp,
        serialNo,
        poNumber,
        vendorName,
        totalQty,
        stageName,
        qty,
      ];

      await insertRow('Cancel', rowData);
      toast(`Cancellation of ${qty} units for PO ${poNumber} recorded successfully!`, 'success');

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err) {
      console.error('[CancelOrderDialog] Error:', err);
      toast(`Failed to record cancellation: ${err.message}`, 'error');
      setErrorMsg(err.message || 'Failed to submit cancellation request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-[460px] bg-card border-border shadow-xl rounded-2xl p-6">
        <DialogHeader className="text-left mb-2">
          <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
            <XCircle className="h-5 w-5 text-rose-500" />
            Cancel Purchase Order
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Specify the quantity to cancel. This record will be stored in the Cancel log.
          </DialogDescription>
        </DialogHeader>

        {item && (
          <form onSubmit={handleSubmit} className="space-y-4 py-2 text-left">
            <div className="rounded-xl border border-border bg-neutral-50/50 dark:bg-neutral-900/30 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <ShoppingBag className="h-3.5 w-3.5" /> PO Number
                </span>
                <span className="font-bold text-primary">{poNumber}</span>
              </div>
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-muted-foreground">Vendor</span>
                <span className="font-medium text-foreground">{vendorName || '—'}</span>
              </div>
              {serialNo && (
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Serial No</span>
                  <span className="font-medium text-foreground">{serialNo}</span>
                </div>
              )}
              {location && (
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Location
                  </span>
                  <span className="font-medium text-foreground">{location}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5" /> Total Quantity
                </span>
                <span className="font-semibold text-foreground">{totalQty.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-xs sm:text-sm pt-1 border-t border-border/60">
                <span className="text-muted-foreground">Current Stage</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
                  {stageName}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cancelQty" className="text-xs font-semibold text-foreground">
                Cancel Quantity <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="cancelQty"
                type="number"
                min="1"
                max={totalQty}
                placeholder={`Enter quantity (1 to ${totalQty})`}
                value={cancelQty}
                onChange={(e) => {
                  setCancelQty(e.target.value);
                  setErrorMsg('');
                }}
                disabled={isSubmitting}
                className="rounded-xl border-input bg-background"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                Allowed range: 1 – {totalQty.toLocaleString()}
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 flex items-center gap-2 text-rose-700 dark:text-rose-400 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <DialogFooter className="mt-6 gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
                className="border-border rounded-xl cursor-pointer"
              >
                Close
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !cancelQty}
                className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl cursor-pointer gap-1.5"
              >
                {isSubmitting ? (
                  'Saving...'
                ) : (
                  <>
                    <XCircle className="h-4 w-4" /> Confirm Cancel
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
