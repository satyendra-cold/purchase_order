import { useState } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  Plus, 
  Search, 
  MapPin, 
  User, 
  Clock, 
  Trash2, 
  Copy, 
  Map, 
  AlertCircle,
  Hash,
  ShoppingBag,
  FilePlus2,
  Edit2
} from 'lucide-react';

const SEED_POS = [
  {
    poNumber: '6123510002178',
    vendorName: 'Blinkit',
    totalQuantity: 250,
    location: 'RAIPUR',
    address: 'Plot 45, Urla Industrial Area, Raipur, CG - 492003',
    createdBy: 'Admin User',
    timestamp: '2026-06-18T07:04:32.214Z'
  },
  {
    poNumber: '4478410002562',
    vendorName: 'Zepto',
    totalQuantity: 120,
    location: 'DURG',
    address: 'Gate 2, Bhilai Steel Plant Industrial Area, Durg, CG - 491001',
    createdBy: 'Jane Doe',
    timestamp: '2026-06-18T07:04:24.647Z'
  }
];

const SEED_VENDORS = [
  {
    id: '1',
    name: 'Blinkit',
    phone: '9876543210'
  },
  {
    id: '2',
    name: 'Zepto',
    phone: '9876543211'
  },
  {
    id: '1781765658987',
    name: 'Instamart',
    phone: '9876543210'
  }
];

export function GeneratePOPage() {
  const { currentUser } = useAuth();
  const { toast } = useToast();

  // Local storage lists
  const [purchaseOrders, setPurchaseOrders] = useLocalStorage('procureflow_generated_pos', SEED_POS);
  const [locations, setLocations] = useLocalStorage('procureflow_locations', ['RAIPUR', 'DURG', 'BILASPUR']);
  const [vendors] = useLocalStorage('procureflow_vendors', SEED_VENDORS);

  // Search & filter
  const [searchTerm, setSearchTerm] = useState('');

  // Dialog / Modal Visibility & Mode Control
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingOriginalPoNumber, setEditingOriginalPoNumber] = useState('');

  // Form Fields
  const [poNumber, setPoNumber] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [totalQuantity, setTotalQuantity] = useState('');
  const [location, setLocation] = useState('');
  const [address, setAddress] = useState('');

  // Inline location creator states (within modal Form)
  const [isAddingLocInline, setIsAddingLocInline] = useState(false);
  const [newLocationInput, setNewLocationInput] = useState('');
  const [locError, setLocError] = useState('');

  // Get active vendors list
  const activeVendors = vendors;

  // Helper to suggest next PO Number
  const suggestPoNumber = (currentList = purchaseOrders) => {
    const prefix = 'PO-2026-';
    const numbers = currentList
      .map(po => po.poNumber)
      .filter(num => num.startsWith(prefix))
      .map(num => parseInt(num.replace(prefix, ''), 10))
      .filter(num => !isNaN(num));

    const nextIndex = numbers.length > 0 ? Math.max(...numbers) + 1 : 3;
    return `${prefix}${String(nextIndex).padStart(3, '0')}`;
  };

  // Open modal for creating new PO
  const handleOpenAddPoModal = () => {
    setIsEditing(false);
    setPoNumber(suggestPoNumber(purchaseOrders));
    setEditingOriginalPoNumber('');
    setVendorName('');
    setTotalQuantity('');
    setLocation('');
    setAddress('');
    setIsAddingLocInline(false);
    setNewLocationInput('');
    setLocError('');
    setIsFormOpen(true);
  };

  // Open modal for editing existing PO
  const handleOpenEditPoModal = (po) => {
    setIsEditing(true);
    setPoNumber(po.poNumber);
    setEditingOriginalPoNumber(po.poNumber);
    setVendorName(po.vendorName);
    setTotalQuantity(String(po.totalQuantity));
    setLocation(po.location);
    setAddress(po.address);
    setIsAddingLocInline(false);
    setNewLocationInput('');
    setLocError('');
    setIsFormOpen(true);
  };

  // Handle vendor dropdown changes
  const handleVendorChange = (selectedName) => {
    setVendorName(selectedName);
  };

  // Inline location creator submit
  const handleAddLocationInline = (e) => {
    e.preventDefault();
    setLocError('');

    const formattedLoc = newLocationInput.trim().toUpperCase();
    if (!formattedLoc) {
      setLocError('Location name cannot be empty.');
      return;
    }

    if (locations.map(l => l.toUpperCase()).includes(formattedLoc)) {
      setLocError('Location constant already exists.');
      return;
    }

    const updatedLocations = [...locations, formattedLoc];
    setLocations(updatedLocations);
    setLocation(formattedLoc); // auto-select the location
    setIsAddingLocInline(false);
    setNewLocationInput('');
    toast(`Location constant "${formattedLoc}" added!`, 'success');
  };

  // Submit PO form (supports Create and Edit)
  const handleSubmitPo = (e) => {
    e.preventDefault();

    if (!poNumber.trim()) {
      toast('Please enter a PO Number.', 'error');
      return;
    }

    // Check PO Number uniqueness ONLY if generating a new record
    if (!isEditing) {
      const poExists = purchaseOrders.some(
        po => po.poNumber.trim().toLowerCase() === poNumber.trim().toLowerCase()
      );
      if (poExists) {
        toast(`PO Number "${poNumber.trim()}" is already in use. Please enter a unique PO Number.`, 'error');
        return;
      }
    }

    if (!vendorName.trim()) {
      toast('Please select a Vendor.', 'error');
      return;
    }

    const qty = parseInt(totalQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      toast('Total Quantity must be a valid positive integer.', 'error');
      return;
    }

    if (!location) {
      toast('Please select a Location.', 'error');
      return;
    }

    if (!address.trim()) {
      toast('Please enter the Address.', 'error');
      return;
    }

    if (isEditing) {
      // Check if PO Number changed, and if so, check if new PO number is unique
      if (poNumber.trim().toLowerCase() !== editingOriginalPoNumber.trim().toLowerCase()) {
        const poExists = purchaseOrders.some(
          po => po.poNumber.trim().toLowerCase() === poNumber.trim().toLowerCase()
        );
        if (poExists) {
          toast(`PO Number "${poNumber.trim()}" is already in use. Please enter a unique PO Number.`, 'error');
          return;
        }
      }

      // Edit mode: update existing entry matching original key
      const updatedPOs = purchaseOrders.map(po => 
        po.poNumber === editingOriginalPoNumber 
          ? {
              ...po,
              poNumber: poNumber.trim(), // save new PO number
              vendorName: vendorName.trim(),
              totalQuantity: qty,
              location,
              address: address.trim(),
              timestamp: new Date().toISOString() // Refresh edit timestamp
            }
          : po
      );
      setPurchaseOrders(updatedPOs);
      toast(`Purchase Order ${poNumber} updated successfully!`, 'success');
    } else {
      // Create mode: add new entry
      const newPO = {
        poNumber: poNumber.trim(),
        vendorName: vendorName.trim(),
        totalQuantity: qty,
        location,
        address: address.trim(),
        createdBy: currentUser ? (currentUser.name || currentUser.username) : 'System',
        timestamp: new Date().toISOString()
      };
      setPurchaseOrders([newPO, ...purchaseOrders]);
      toast(`Purchase Order ${newPO.poNumber} generated successfully!`, 'success');
    }
    
    setIsFormOpen(false); // Close Modal
  };

  // Delete PO Record
  const handleDeletePo = (poNo) => {
    if (window.confirm(`Are you sure you want to delete purchase order ${poNo}?`)) {
      setPurchaseOrders(purchaseOrders.filter(po => po.poNumber !== poNo));
      toast(`Purchase Order ${poNo} deleted successfully.`, 'success');
    }
  };

  // Copy PO details to clipboard
  const handleCopyPo = (po) => {
    const details = `PO Number: ${po.poNumber}\nVendor: ${po.vendorName}\nQty: ${po.totalQuantity}\nLocation: ${po.location}\nAddress: ${po.address}\nCreated By: ${po.createdBy}\nDate: ${formatTimestamp(po.timestamp)}`;
    navigator.clipboard.writeText(details)
      .then(() => toast(`Copied details of ${po.poNumber} to clipboard!`, 'success'))
      .catch(() => toast('Failed to copy text', 'error'));
  };

  // Format Date Helper
  const formatTimestamp = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('en-IN', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return isoString;
    }
  };

  // Filter purchase orders
  const filteredPOs = purchaseOrders.filter(po => 
    po.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    po.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    po.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    po.createdBy.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-300">
      
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="text-left">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            Generate Purchase Order
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Audit existing purchase orders, add custom locations, and generate official records.
          </p>
        </div>
      </div>

      {/* Main Table View Card (Full Width) */}
      <Card className="border-border bg-card shadow-sm rounded-2xl">
        <CardHeader className="py-4 px-4 md:px-6 border-b border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search POs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 rounded-xl border-input bg-background h-9 text-xs sm:text-sm max-w-xs"
              />
            </div>
            <div className="text-xs text-muted-foreground hidden md:inline-block">
              Total: {filteredPOs.length} record(s)
            </div>
          </div>

          <Button
            onClick={handleOpenAddPoModal}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 self-end sm:self-center rounded-xl cursor-pointer shadow-sm text-xs sm:text-sm py-2 px-4 h-9"
          >
            <Plus className="h-4 w-4" />
            Add PO
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader className="bg-neutral-50/50 dark:bg-neutral-900/10 border-b border-border">
                <TableRow>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider pl-4 md:pl-6 py-3 text-left">PO Number</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Vendor Name</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Total Quantity</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Location</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Address</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Created By</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Timestamp</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-right pr-4 md:pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPOs.length > 0 ? (
                  filteredPOs.map((po) => (
                    <TableRow key={po.poNumber} className="hover:bg-accent/40 border-b border-border transition-colors">
                      
                      {/* PO Number */}
                      <TableCell className="pl-4 md:pl-6 py-4 text-left font-semibold text-primary text-xs sm:text-sm">
                        {po.poNumber}
                      </TableCell>

                      {/* Vendor Name */}
                      <TableCell className="py-4 text-left text-xs sm:text-sm font-medium text-foreground">
                        {po.vendorName}
                      </TableCell>

                      {/* Total Quantity */}
                      <TableCell className="py-4 text-left font-bold text-xs sm:text-sm text-foreground">
                        {po.totalQuantity.toLocaleString()}
                      </TableCell>

                      {/* Location Badge */}
                      <TableCell className="py-4 text-left">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-border">
                          <MapPin className="h-2.5 w-2.5 text-muted-foreground" />
                          {po.location}
                        </span>
                      </TableCell>

                      {/* Address */}
                      <TableCell className="py-4 text-left text-xs text-muted-foreground max-w-[150px] truncate" title={po.address}>
                        {po.address}
                      </TableCell>

                      {/* Created By Staff */}
                      <TableCell className="py-4 text-left">
                        <span className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          {po.createdBy}
                        </span>
                      </TableCell>

                      {/* Formatted Date */}
                      <TableCell className="py-4 text-left">
                        <span className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          {formatTimestamp(po.timestamp)}
                        </span>
                      </TableCell>

                      {/* Action buttons */}
                      <TableCell className="py-4 text-right pr-4 md:pr-6">
                        <div className="flex items-center justify-end gap-1.5 font-normal">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopyPo(po)}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg cursor-pointer"
                            title="Copy details"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEditPoModal(po)}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg cursor-pointer"
                            title="Edit details"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeletePo(po.poNumber)}
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                            title="Delete Record"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>

                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-muted-foreground text-sm">
                      No purchase orders found. Click "Add PO" to generate your first record!
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Generate PO Dialog Modal */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent onPointerDownOutside={(e) => e.preventDefault()} className="sm:max-w-[500px] bg-card border-border shadow-xl rounded-2xl p-6">
          <form onSubmit={handleSubmitPo}>
            <DialogHeader className="text-left mb-4">
              <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                <FilePlus2 className="h-5 w-5 text-primary" />
                {isEditing ? 'Edit Purchase Order' : 'Generate Purchase Order'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                {isEditing 
                  ? ''
                  : 'Enter purchasing details to create a persistent purchase order record.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              
              {/* Row 1: PO Number */}
              <div className="space-y-1.5 text-left">
                <Label htmlFor="poNumber" className="text-xs font-semibold text-muted-foreground pl-0.5 flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5" />
                  PO Number*
                </Label>
                <Input
                  id="poNumber"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  placeholder="e.g. PO-2026-003"
                  className="rounded-xl bg-background border-input"
                  required
                />
              </div>

              {/* Row 2: Vendor Name (Dropdown) */}
              <div className="space-y-1.5 text-left">
                <Label htmlFor="vendorName" className="text-xs font-semibold text-muted-foreground pl-0.5 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  Vendor Name*
                </Label>
                {activeVendors.length > 0 ? (
                  <Select value={vendorName} onValueChange={handleVendorChange}>
                    <SelectTrigger className="w-full border-input rounded-xl bg-background text-left text-xs h-10">
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {activeVendors.map((vendor) => (
                        <SelectItem key={vendor.id} value={vendor.name} className="text-xs focus:bg-accent cursor-pointer">
                          {vendor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-xs text-muted-foreground p-3 border rounded-xl border-dashed">
                    No active vendors found. Please add vendors in Settings.
                  </div>
                )}
              </div>

              {/* Row 3: Total Quantity */}
              <div className="space-y-1.5 text-left">
                <Label htmlFor="totalQuantity" className="text-xs font-semibold text-muted-foreground pl-0.5 flex items-center gap-1.5">
                  <ShoppingBag className="h-3.5 w-3.5" />
                  Total Quantity*
                </Label>
                <Input
                  id="totalQuantity"
                  type="number"
                  min="1"
                  value={totalQuantity}
                  onChange={(e) => setTotalQuantity(e.target.value)}
                  placeholder="e.g. 250"
                  className="rounded-xl bg-background border-input"
                  required
                />
              </div>

              {/* Row 4: Location Dropdown + Inline constant adder */}
              <div className="space-y-1.5 text-left">
                <div className="flex justify-between items-center mb-0.5">
                  <Label htmlFor="location" className="text-xs font-semibold text-muted-foreground pl-0.5 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    Location*
                  </Label>
                  {!isAddingLocInline && (
                    <button
                      type="button"
                      onClick={() => {
                        setLocError('');
                        setNewLocationInput('');
                        setIsAddingLocInline(true);
                      }}
                      className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer focus:outline-none"
                    >
                      <Plus className="h-3 w-3" /> Add Location
                    </button>
                  )}
                </div>

                {isAddingLocInline ? (
                  <div className="space-y-2 p-3 rounded-xl border border-border bg-neutral-50/50 dark:bg-neutral-900/10 animate-in slide-in-from-top-1 duration-200">
                    <div className="flex gap-2">
                      <Input
                        value={newLocationInput}
                        onChange={(e) => setNewLocationInput(e.target.value)}
                        placeholder="e.g. BILASPUR"
                        className="rounded-xl bg-background border-input uppercase text-xs h-9 flex-1"
                        required
                      />
                      <Button
                        type="button"
                        onClick={handleAddLocationInline}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs rounded-xl px-3 h-9 cursor-pointer"
                      >
                        Add
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsAddingLocInline(false)}
                        className="border-border hover:bg-accent text-xs rounded-xl px-3 h-9 cursor-pointer"
                      >
                        Cancel
                      </Button>
                    </div>
                    {locError && (
                      <p className="text-[10px] text-destructive font-medium flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" /> {locError}
                      </p>
                    )}
                  </div>
                ) : (
                  <Select value={location} onValueChange={setLocation}>
                    <SelectTrigger className="w-full border-input rounded-xl bg-background text-left text-xs h-10">
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {locations.map((loc) => (
                        <SelectItem key={loc} value={loc} className="text-xs focus:bg-accent cursor-pointer">
                          {loc}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Row 5: Address */}
              <div className="space-y-1.5 text-left">
                <Label htmlFor="address" className="text-xs font-semibold text-muted-foreground pl-0.5 flex items-center gap-1.5">
                  <Map className="h-3.5 w-3.5" />
                  Address*
                </Label>
                <textarea
                  id="address"
                  rows="3"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Enter shipping or delivery address..."
                  className="w-full min-w-0 rounded-xl border border-input bg-transparent px-3 py-2 text-xs sm:text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
                  required
                />
              </div>

            </div>

            <DialogFooter className="mt-6 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsFormOpen(false)}
                className="border-border hover:bg-accent rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl cursor-pointer"
              >
                {isEditing ? 'Save Changes' : 'Generate PO'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
