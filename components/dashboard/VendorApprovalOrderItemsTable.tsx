'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Edit2, Save, X, Loader2, Eye, ChevronDown, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import type { OrderItem } from '@/lib/tableExtractor';

interface VendorApprovalOrderItemsTableProps {
  items: OrderItem[];
  selectedItemIds: Set<string>;
  onSelectedItemsChange: (selectedIds: Set<string>) => void;
  approvalId: string;
  isEditMode: boolean;
  onEditModeChange: (editMode: boolean) => void;
  canEdit: boolean;
  onSaveSuccess?: () => void;
  saving?: boolean;
  onSavingChange?: (saving: boolean) => void;
  isVendor?: boolean;
}

interface ItemWithId extends OrderItem {
  id: string;
  negotiatedVendorAmount?: number | string;
}

export default function VendorApprovalOrderItemsTable({
  items,
  selectedItemIds,
  onSelectedItemsChange,
  approvalId,
  isEditMode,
  onEditModeChange,
  canEdit,
  onSaveSuccess,
  saving = false,
  onSavingChange,
  isVendor = false,
}: VendorApprovalOrderItemsTableProps) {
  const { toast } = useToast();
  const initialSelectedItemIdsRef = useRef<Set<string>>(new Set());
  const [showMainCategories, setShowMainCategories] = useState(true);
  const [showSubCategories, setShowSubCategories] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isAmountEditMode, setIsAmountEditMode] = useState(false);
  const [editedItems, setEditedItems] = useState<Map<string, ItemWithId>>(new Map());
  // Map of orderItemId -> orderApprovalItemId for saving amounts
  const [orderApprovalItemIdMap, setOrderApprovalItemIdMap] = useState<Map<string, string>>(new Map());

  // Convert items to have IDs
  const itemsWithIds = useMemo(() => {
    return items.map((item, index) => {
      const itemId = ('id' in item && typeof (item as any).id === 'string' && (item as any).id)
        ? (item as any).id
        : `item-${index}`;
      return {
        ...item,
        id: itemId,
      } as ItemWithId;
    });
  }, [items]);

  // Filter items: only show selected items when not in edit mode, and respect show/hide category settings
  const displayItems = useMemo(() => {
    let filtered: ItemWithId[];
    
    if (isEditMode) {
      // Select/Deselect mode: show all items (but still respect category visibility)
      filtered = itemsWithIds;
    } else if (isAmountEditMode) {
      // Amount Edit mode: show only selected items and their parent categories
      const selectedIds = new Set(selectedItemIds);
      const neededCategories = new Set<string>();
      const neededSubcategories = new Set<string>();
      
      // First pass: identify which categories are needed
      let currentMainCategory: string | null = null;
      let currentSubCategory: string | null = null;
      
      for (const item of itemsWithIds) {
        if (item.type === 'maincategory') {
          currentMainCategory = item.id;
          currentSubCategory = null;
        } else if (item.type === 'subcategory') {
          currentSubCategory = item.id;
        } else if (item.type === 'item' && selectedIds.has(item.id)) {
          if (currentMainCategory) neededCategories.add(currentMainCategory);
          if (currentSubCategory) neededSubcategories.add(currentSubCategory);
        }
      }
      
      // Second pass: filter items
      filtered = itemsWithIds.filter((item) => {
        if (item.type === 'maincategory') {
          return neededCategories.has(item.id);
        } else if (item.type === 'subcategory') {
          return neededSubcategories.has(item.id);
        } else if (item.type === 'item') {
          return selectedIds.has(item.id);
        }
        return false;
      });
    } else {
      // View mode: show only selected items and their parent categories
      const selectedIds = new Set(selectedItemIds);
      const neededCategories = new Set<string>();
      const neededSubcategories = new Set<string>();
      
      // First pass: identify which categories are needed
      let currentMainCategory: string | null = null;
      let currentSubCategory: string | null = null;
      
      for (const item of itemsWithIds) {
        if (item.type === 'maincategory') {
          currentMainCategory = item.id;
          currentSubCategory = null;
        } else if (item.type === 'subcategory') {
          currentSubCategory = item.id;
        } else if (item.type === 'item' && selectedIds.has(item.id)) {
          if (currentMainCategory) neededCategories.add(currentMainCategory);
          if (currentSubCategory) neededSubcategories.add(currentSubCategory);
        }
      }
      
      // Second pass: filter items
      filtered = itemsWithIds.filter((item) => {
        if (item.type === 'maincategory') {
          return neededCategories.has(item.id);
        } else if (item.type === 'subcategory') {
          return neededSubcategories.has(item.id);
        } else if (item.type === 'item') {
          return selectedIds.has(item.id);
        }
        return false;
      });
    }
    
    // Apply show/hide category filters
    return filtered.filter((item) => {
      if (item.type === 'maincategory') {
        return showMainCategories;
      } else if (item.type === 'subcategory') {
        return showSubCategories;
      }
      return true;
    });
  }, [itemsWithIds, isEditMode, isAmountEditMode, selectedItemIds, showMainCategories, showSubCategories]);

  const handleToggleItem = (itemId: string) => {
    if (!isEditMode || !canEdit) return;
    
    const newSelected = new Set(selectedItemIds);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    onSelectedItemsChange(newSelected);
  };

  const handleSelectAll = () => {
    if (!isEditMode || !canEdit) return;
    
    const allItemIds = new Set(
      itemsWithIds
        .filter(item => item.type === 'item')
        .map(item => item.id)
    );
    onSelectedItemsChange(allItemIds);
  };

  const handleDeselectAll = () => {
    if (!isEditMode || !canEdit) return;
    onSelectedItemsChange(new Set());
  };

  const handleEditClick = () => {
    // Store initial state when entering select/deselect mode
    initialSelectedItemIdsRef.current = new Set(selectedItemIds);
    onEditModeChange(true);
  };

  const handleAmountEditClick = () => {
    // Initialize edited items map with current items
    const itemsMap = new Map<string, ItemWithId>();
    itemsWithIds.forEach(item => {
      if (item.type === 'item') {
        // Preserve existing values including 0, only default to empty string for null/undefined
        const existingValue = item.negotiatedVendorAmount;
        itemsMap.set(item.id, { 
          ...item, 
          negotiatedVendorAmount: existingValue !== null && existingValue !== undefined ? existingValue : '' 
        });
      }
    });
    setEditedItems(itemsMap);
    setIsAmountEditMode(true);
  };

  const handleAmountEditCancel = () => {
    setEditedItems(new Map());
    setIsAmountEditMode(false);
  };

  const handleAmountChange = (itemId: string, value: number | string) => {
    const newMap = new Map(editedItems);
    const item = newMap.get(itemId);
    if (item) {
      newMap.set(itemId, { ...item, negotiatedVendorAmount: value });
      setEditedItems(newMap);
    }
  };

  const handleAmountSave = async () => {
    if (!onSavingChange) return;

    try {
      onSavingChange(true);

      // Build amounts array with orderApprovalItemId and negotiatedVendorAmount
      const amounts = Array.from(editedItems.entries())
        .filter(([itemId]) => selectedItemIds.has(itemId)) // Only include selected items
        .map(([orderItemId, item]) => {
          const orderApprovalItemId = orderApprovalItemIdMap.get(orderItemId);
          const negotiatedVendorAmount = item.negotiatedVendorAmount;
          
          // Convert to number or null
          const amountValue = negotiatedVendorAmount === '' || negotiatedVendorAmount === null || negotiatedVendorAmount === undefined
            ? null
            : (typeof negotiatedVendorAmount === 'number' ? negotiatedVendorAmount : parseFloat(String(negotiatedVendorAmount)) || null);

          return {
            orderApprovalItemId,
            negotiatedVendorAmount: amountValue,
          };
        })
        .filter(item => item.orderApprovalItemId); // Only include items with valid orderApprovalItemId

      if (amounts.length === 0) {
        toast({
          title: 'Error',
          description: 'No valid items to save. Please ensure items are selected.',
          variant: 'destructive',
        });
        return;
      }

      const response = await fetch(`/api/order-approvals/${approvalId}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amounts }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: 'Negotiated vendor amounts saved successfully',
        });
        setIsAmountEditMode(false);
        setEditedItems(new Map());
        if (onSaveSuccess) {
          onSaveSuccess();
        }
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to save amounts',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error saving amounts:', error);
      toast({
        title: 'Error',
        description: 'Failed to save amounts',
        variant: 'destructive',
      });
    } finally {
      onSavingChange(false);
    }
  };

  const handleQuickFill = (itemId: string) => {
    const item = itemsWithIds.find(i => i.id === itemId);
    if (item && item.type === 'item') {
      const amount = typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount || 0)) || 0;
      const halfAmount = amount * 0.5;
      handleAmountChange(itemId, halfAmount);
    }
  };

  const handleCancel = () => {
    // Check if there were changes
    const hasChanges = 
      selectedItemIds.size !== initialSelectedItemIdsRef.current.size ||
      Array.from(selectedItemIds).some(id => !initialSelectedItemIdsRef.current.has(id)) ||
      Array.from(initialSelectedItemIdsRef.current).some(id => !selectedItemIds.has(id));
    
    // Reset to initial state
    onSelectedItemsChange(new Set(initialSelectedItemIdsRef.current));
    onEditModeChange(false);
    
    // Only show toast if there were changes
    if (hasChanges) {
      toast({
        title: 'Changes cancelled',
        description: 'Selection has been reset to the saved state.',
      });
    }
  };

  const handleSave = async () => {
    if (!onSavingChange) return;
    
    // Filter out synthetic IDs (like "item-2") and only keep valid UUIDs
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validItemIds = Array.from(selectedItemIds).filter(id => uuidPattern.test(id));
    
    if (validItemIds.length === 0) {
      toast({
        title: 'Error',
        description: 'No valid items selected. Please select items with valid IDs.',
        variant: 'destructive',
      });
      return;
    }

    // Save selected items - API will validate they belong to the customer
    // Since we removed FK constraint, API validates items belong to customer's orders
    try {
      onSavingChange(true);

      const response = await fetch(`/api/order-approvals/${approvalId}/items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: validItemIds }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: 'Selected items saved successfully',
        });
        // Update initial state to current state after successful save
        initialSelectedItemIdsRef.current = new Set(selectedItemIds);
        onEditModeChange(false);
        if (onSaveSuccess) {
          onSaveSuccess();
        }
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to save selected items',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error saving selected items:', error);
      toast({
        title: 'Error',
        description: 'Failed to save selected items',
        variant: 'destructive',
      });
    } finally {
      onSavingChange(false);
    }
  };

  const formatNumber = (value: number | string | undefined | null): string => {
    if (value === undefined || value === null || value === '') return '—';
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    if (isNaN(num)) return '—';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatCurrency = (value: number | string | undefined | null): string => {
    const formatted = formatNumber(value);
    return formatted === '—' ? formatted : `$${formatted}`;
  };

  const formatPercent = (value: number | string | undefined | null): string => {
    if (value === undefined || value === null || value === '') return '—';
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    if (isNaN(num)) return '—';
    return `${num.toFixed(2)}%`;
  };

  // Fetch order approval items to build orderItemId -> orderApprovalItemId mapping
  useEffect(() => {
    const fetchOrderApprovalItems = async () => {
      try {
        const response = await fetch(`/api/order-approvals/${approvalId}/items`);
        const data = await response.json();
        
        if (data.success && data.data) {
          const map = new Map<string, string>();
          data.data.forEach((item: any) => {
            if (item.orderItemId && item.id) {
              map.set(item.orderItemId, item.id);
            }
          });
          setOrderApprovalItemIdMap(map);
        }
      } catch (error) {
        console.error('Error fetching order approval items:', error);
      }
    };

    if (approvalId) {
      fetchOrderApprovalItems();
    }
  }, [approvalId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

  const itemCount = displayItems.filter(item => item.type === 'item').length;
  const selectedCount = selectedItemIds.size;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Order Items</CardTitle>
            <CardDescription>
              {isEditMode
                ? 'Select items to include in this approval'
                : `Showing ${itemCount} selected item(s)`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative" ref={dropdownRef}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="gap-2"
              >
                <Eye className="h-4 w-4" />
                Show/Hide Headers
                <ChevronDown className="h-4 w-4" />
              </Button>
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-full bg-background border rounded-md shadow-lg z-50 p-2">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 px-2 py-1.5 hover:bg-accent rounded-sm cursor-pointer">
                      <Checkbox
                        id="main-category"
                        checked={showMainCategories}
                        onCheckedChange={(checked) => setShowMainCategories(checked === true)}
                      />
                      <label
                        htmlFor="main-category"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                      >
                        Main Category
                      </label>
                    </div>
                    <div className="flex items-center space-x-2 px-2 py-1.5 hover:bg-accent rounded-sm cursor-pointer">
                      <Checkbox
                        id="sub-category"
                        checked={showSubCategories}
                        onCheckedChange={(checked) => setShowSubCategories(checked === true)}
                      />
                      <label
                        htmlFor="sub-category"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                      >
                        Sub-category
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {canEdit && (
              <>
                {!isEditMode && !isAmountEditMode ? (
                  <>
                    <Button onClick={handleEditClick} variant="outline" size="sm">
                      <Edit2 className="mr-2 h-4 w-4" />
                      Select/Deselect Items
                    </Button>
                    <Button 
                      onClick={handleAmountEditClick} 
                      variant="outline" 
                      size="sm"
                      disabled={selectedItemIds.size === 0}
                      title={selectedItemIds.size === 0 ? 'No selected items to edit' : 'Edit negotiated amounts'}
                    >
                      <Edit2 className="mr-2 h-4 w-4" />
                      Edit Items
                    </Button>
                  </>
                ) : isEditMode ? (
                  <>
                    <Button onClick={handleSave} disabled={saving} size="sm">
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Selection
                        </>
                      )}
                    </Button>
                    <Button onClick={handleCancel} variant="outline" size="sm" disabled={saving}>
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button onClick={handleAmountSave} disabled={saving} size="sm">
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Amounts
                        </>
                      )}
                    </Button>
                    <Button onClick={handleAmountEditCancel} variant="outline" size="sm" disabled={saving}>
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border max-h-[600px] overflow-y-auto">
          <table className="w-full caption-bottom text-sm border-separate border-spacing-0" style={{ width: '100%', tableLayout: 'auto' }}>
            <TableHeader>
              <TableRow>
                {isEditMode && canEdit && !isAmountEditMode && (
                  <TableHead className="sticky top-0 z-10 bg-background text-center border-r border-black w-[50px] h-8">
                    <div className="flex items-center justify-center gap-2">
                      <Checkbox
                        checked={selectedCount > 0 && selectedCount === itemsWithIds.filter(item => item.type === 'item').length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            handleSelectAll();
                          } else {
                            handleDeselectAll();
                          }
                        }}
                        className="h-4 w-4"
                      />
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs text-muted-foreground">
                              {selectedCount > 0 ? `${selectedCount} selected` : 'Select all'}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{selectedCount > 0 ? 'Deselect all' : 'Select all items'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </TableHead>
                )}
                <TableHead className="sticky top-0 z-10 bg-background border-r border-black h-8 pl-2" style={{ width: 'auto', minWidth: '300px' }}>
                  PRODUCT/SERVICE
                </TableHead>
                <TableHead className="sticky top-0 z-10 bg-background text-right border-r border-black whitespace-nowrap h-8" style={{ width: '80px' }}>
                  QTY
                </TableHead>
                <TableHead className="sticky top-0 z-10 bg-background text-right border-r border-black whitespace-nowrap h-8" style={{ width: '100px' }}>
                  RATE
                </TableHead>
                <TableHead className={cn("sticky top-0 z-10 bg-background text-right", !isEditMode && !isAmountEditMode && "border-r border-black", "whitespace-nowrap h-8")} style={{ width: '130px' }}>
                  AMOUNT
                </TableHead>
                {!isVendor && (
                  <TableHead className={cn("sticky top-0 z-10 bg-background text-right", !isEditMode && !isAmountEditMode && "border-r border-black", "whitespace-nowrap h-8")} style={{ width: '130px' }}>
                    Price Difference
                  </TableHead>
                )}
                <TableHead className={cn("sticky top-0 z-10 bg-background text-right", (isEditMode || isAmountEditMode) && canEdit && "border-r border-black", "h-8")} style={{ width: '100px' }}>
                  % Progress<br />Overall
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayItems.length === 0 ? (
                <TableRow>
                  <TableCell 
                    colSpan={(isEditMode && canEdit && !isAmountEditMode) ? (6 + (isVendor ? 0 : 1)) : (5 + (isVendor ? 0 : 1))} 
                    className="text-center py-8 text-muted-foreground"
                  >
                    {isEditMode || isAmountEditMode ? 'No items available' : 'No items selected'}
                  </TableCell>
                </TableRow>
              ) : (
                displayItems.map((item, index) => {
                  const isItem = item.type === 'item';
                  const isCategory = item.type === 'maincategory' || item.type === 'subcategory';
                  const isEvenRow = index % 2 === 0;
                  const isSelected = selectedItemIds.has(item.id);
                  
                  const qty = typeof item.qty === 'number' ? item.qty : parseFloat(String(item.qty || 0)) || 0;
                  const rate = typeof item.rate === 'number' ? item.rate : parseFloat(String(item.rate || 0)) || 0;
                  const amount = typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount || 0)) || 0;
                  const progressPct = typeof item.progressOverallPct === 'number' 
                    ? item.progressOverallPct 
                    : parseFloat(String(item.progressOverallPct || 0)) || 0;
                  
                  // Get edited negotiatedVendorAmount if in amount edit mode
                  const editedItem = editedItems.get(item.id);
                  const negotiatedVendorAmount = editedItem?.negotiatedVendorAmount !== undefined 
                    ? editedItem.negotiatedVendorAmount 
                    : (item.negotiatedVendorAmount !== null && item.negotiatedVendorAmount !== undefined ? item.negotiatedVendorAmount : '');
                  
                  const negotiatedAmount = typeof negotiatedVendorAmount === 'number' 
                    ? negotiatedVendorAmount 
                    : parseFloat(String(negotiatedVendorAmount || 0)) || 0;
                  
                  // Calculate price difference (original amount - negotiated amount) for non-vendor users
                  // Show difference only if there's a negotiated amount set (not null/undefined)
                  const hasNegotiatedAmount = negotiatedVendorAmount !== null && negotiatedVendorAmount !== undefined && negotiatedVendorAmount !== '';
                  const priceDifference = !isVendor && hasNegotiatedAmount 
                    ? amount - negotiatedAmount 
                    : null;

                  if (isCategory) {
                    return (
                      <TableRow 
                        key={item.id}
                        className={cn(
                          item.type === 'maincategory' ? 'font-bold' : 'font-semibold',
                          item.type === 'maincategory' ? 'bg-primary/20 dark:bg-primary/30' : 'bg-primary/10 dark:bg-primary/20'
                        )}
                      >
                        <TableCell 
                          colSpan={(isEditMode && canEdit && !isAmountEditMode) ? (6 + (isVendor ? 0 : 1)) : (5 + (isVendor ? 0 : 1))}
                          className={cn(
                            'py-2',
                            item.type === 'maincategory' ? 'text-base' : 'text-sm pl-8'
                          )}
                        >
                          {item.productService}
                        </TableCell>
                      </TableRow>
                    );
                  }

                  if (!isItem) return null;

                  return (
                    <TableRow
                      key={item.id}
                      className={cn(
                        isEvenRow ? 'bg-muted/50 dark:bg-muted/30' : 'bg-background',
                        isSelected && isEditMode ? 'ring-2 ring-primary' : '',
                        isItem ? 'hover:bg-green-200 dark:hover:bg-green-800/40 hover:shadow-sm transition-colors duration-150' : ''
                      )}
                    >
                      {isEditMode && canEdit && !isAmountEditMode && (
                        <TableCell className="text-center align-middle">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleItem(item.id)}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium pl-2 align-top" style={{ minWidth: '300px' }}>
                        {item.productService || '—'}
                      </TableCell>
                      <TableCell className="text-right align-top whitespace-nowrap" style={{ width: '80px' }}>
                        {qty ? formatNumber(qty) : '—'}
                      </TableCell>
                      <TableCell className="text-right align-top whitespace-nowrap" style={{ width: '100px' }}>
                        {rate ? formatCurrency(rate) : '—'}
                      </TableCell>
                      <TableCell className="text-right align-top whitespace-nowrap" style={{ width: '130px' }}>
                        {isAmountEditMode && isItem ? (
                          <div className="flex items-center justify-end gap-1 min-w-0">
                            <div className="flex-1 min-w-0">
                              <Input
                                type="number"
                                step="0.01"
                                value={negotiatedVendorAmount ?? ''}
                                onChange={(e) => handleAmountChange(item.id, e.target.value === '' ? '' : parseFloat(e.target.value) || '')}
                                className="h-8 w-full box-border text-right !px-1 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-moz-appearance]:textfield"
                                placeholder="0.00"
                              />
                            </div>
                            {(!negotiatedVendorAmount || negotiatedVendorAmount === 0 || negotiatedVendorAmount === '') && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 flex-shrink-0"
                                      onClick={() => handleQuickFill(item.id)}
                                      disabled={amount === 0}
                                    >
                                      <Zap className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Set to 50% of Order Items amount</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        ) : (
                          negotiatedAmount > 0 ? formatCurrency(negotiatedAmount) : formatCurrency(amount)
                        )}
                      </TableCell>
                      {!isVendor && (
                        <TableCell className="text-right align-top" style={{ width: '130px' }}>
                          {priceDifference !== null ? (
                            <span className={priceDifference >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {priceDifference >= 0 ? '+' : ''}{formatCurrency(priceDifference)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-right align-top" style={{ width: '100px' }}>
                        {progressPct ? formatPercent(progressPct) : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

