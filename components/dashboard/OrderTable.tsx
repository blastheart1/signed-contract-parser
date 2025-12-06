'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Edit2, Save, X, Plus, Trash2, GripVertical, Folder, FolderOpen, Loader2 } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  useDndMonitor,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import type { OrderItem } from '@/lib/tableExtractor';

interface OrderTableProps {
  items: OrderItem[];
  onItemsChange?: (items: OrderItem[]) => void;
  orderId?: string; // Order ID for saving to database
  onSaveSuccess?: () => void; // Callback after successful save
}

interface EditableOrderItem extends OrderItem {
  id: string;
  progressOverallPct?: number | string;
  completedAmount?: number | string;
  previouslyInvoicedPct?: number | string;
  previouslyInvoicedAmount?: number | string;
  newProgressPct?: number | string;
  thisBill?: number | string;
}

// Sortable row component
function SortableRow({
  item,
  index,
  isEditing,
  onCellChange,
  onAddRow,
  onDeleteRow,
  isEvenRow,
  activeId,
  overId,
  insertPosition,
  isFirstRow,
}: {
  item: EditableOrderItem;
  index: number;
  isEditing: boolean;
  onCellChange: (itemId: string, field: keyof EditableOrderItem, value: string | number) => void;
  onAddRow: (insertAfterIndex: number) => void;
  onDeleteRow: (itemId: string) => void;
  isEvenRow: boolean;
  activeId: string | null;
  overId: string | null;
  insertPosition: 'above' | 'below' | null;
  isFirstRow: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isMainCategory = item.type === 'maincategory';
  const isSubCategory = item.type === 'subcategory';
  const isItem = item.type === 'item';
  
  // Check if this row is being dragged over
  const isDragOver = overId === item.id && activeId !== item.id;
  const isActive = activeId === item.id;
  const showInsertAbove = isDragOver && insertPosition === 'above';
  const showInsertBelow = isDragOver && insertPosition === 'below';

  // Calculate formulas based on template formulas:
  // Column J (Completed $) = I * H (where I is percentage as decimal, e.g., 0.5 for 50%)
  // Column L (Previously Invoiced $) = H * K (where K is percentage as decimal)
  // Column M (% NEW PROGRESS) = I - K (percentage difference)
  // Column N (THIS BILL) = M * H (where M is percentage as decimal)
  // Note: In Excel, percentages are stored as decimals (0.5 = 50%), but in our UI we use whole numbers (50 = 50%)
  const amount = typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount || 0)) || 0;
  const progressOverallPct = typeof item.progressOverallPct === 'number' 
    ? item.progressOverallPct 
    : parseFloat(String(item.progressOverallPct || 0)) || 0;
  const previouslyInvoicedPct = typeof item.previouslyInvoicedPct === 'number'
    ? item.previouslyInvoicedPct
    : parseFloat(String(item.previouslyInvoicedPct || 0)) || 0;

  // Convert percentages from whole numbers (50) to decimals (0.5) for calculations
  // Excel stores percentages as decimals, so I*H means (0.5) * H, not (50) * H
  const progressOverallDecimal = progressOverallPct / 100;
  const previouslyInvoicedDecimal = previouslyInvoicedPct / 100;

  // Calculate derived values (matching Excel formulas)
  // J = I * H (Completed $ = % Progress Overall * Amount)
  const hasProgressPct = (progressOverallPct !== null && progressOverallPct !== undefined && 
    (typeof progressOverallPct === 'string' ? progressOverallPct !== '' : true) && 
    !isNaN(Number(progressOverallPct)));
  const calculatedCompletedAmount = isItem && hasProgressPct && amount 
    ? progressOverallDecimal * amount 
    : (item.completedAmount ? (typeof item.completedAmount === 'number' ? item.completedAmount : parseFloat(String(item.completedAmount)) || 0) : 0);
  
  // L = H * K (Previously Invoiced $ = Amount * % Previously Invoiced)
  const hasPreviouslyInvoicedPct = (previouslyInvoicedPct !== null && previouslyInvoicedPct !== undefined && 
    (typeof previouslyInvoicedPct === 'string' ? previouslyInvoicedPct !== '' : true) && 
    !isNaN(Number(previouslyInvoicedPct)));
  const calculatedPreviouslyInvoicedAmount = isItem && hasPreviouslyInvoicedPct && amount
    ? amount * previouslyInvoicedDecimal
    : (item.previouslyInvoicedAmount ? (typeof item.previouslyInvoicedAmount === 'number' ? item.previouslyInvoicedAmount : parseFloat(String(item.previouslyInvoicedAmount)) || 0) : 0);

  // M = I - K (% NEW PROGRESS = % Progress Overall - % Previously Invoiced)
  const calculatedNewProgressPct = isItem && hasProgressPct && hasPreviouslyInvoicedPct
    ? progressOverallPct - previouslyInvoicedPct
    : (item.newProgressPct ? (typeof item.newProgressPct === 'number' ? item.newProgressPct : parseFloat(String(item.newProgressPct)) || 0) : 0);

  // N = M * H (THIS BILL = % New Progress * Amount)
  const hasNewProgressPct = (calculatedNewProgressPct !== null && calculatedNewProgressPct !== undefined && 
    (typeof calculatedNewProgressPct === 'string' ? calculatedNewProgressPct !== '' : true) && 
    !isNaN(Number(calculatedNewProgressPct)));
  const newProgressDecimal = calculatedNewProgressPct / 100;
  const calculatedThisBill = isItem && hasNewProgressPct && amount
    ? newProgressDecimal * amount
    : (item.thisBill ? (typeof item.thisBill === 'number' ? item.thisBill : parseFloat(String(item.thisBill)) || 0) : 0);

  const formatNumber = (value: number | string | undefined): string => {
    if (value === undefined || value === null || value === '') return '';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatPercent = (value: number | string | undefined): string => {
    if (value === undefined || value === null || value === '') return '';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '';
    return num.toFixed(2);
  };

  // Determine row background color
  const rowBgClass = isMainCategory
    ? 'bg-primary/20 dark:bg-primary/30 border-l-4 border-l-primary'
    : isSubCategory
    ? 'bg-primary/10 dark:bg-primary/20 border-l-4 border-l-primary/70'
    : isEvenRow && isItem
    ? 'bg-muted/60 dark:bg-muted/40'
    : isItem
    ? 'bg-background'
    : '';

  return (
    <>
      {/* Insertion line above row */}
      {showInsertAbove && (
        <tr className="relative">
          <td colSpan={isEditing ? 11 : 10} className="h-2 p-0 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full h-0.5 bg-primary border-t-2 border-t-primary border-dashed"></div>
              <div className="absolute left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-md text-xs font-semibold shadow-lg whitespace-nowrap">
                Drop here
              </div>
            </div>
          </td>
        </tr>
      )}
      <motion.tr
        ref={setNodeRef}
        style={style}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: index * 0.02 }}
        className={`${rowBgClass} ${isMainCategory ? 'font-bold' : isSubCategory ? 'font-semibold' : ''} ${isItem ? 'hover:bg-green-50 dark:hover:bg-green-900/20 hover:shadow-sm transition-colors duration-150 cursor-pointer' : ''} ${isDragOver ? 'ring-2 ring-primary ring-inset bg-primary/10' : ''} ${isActive ? 'opacity-50' : ''}`}
      >
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {isEditing && (
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
              title="Drag to reorder"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}
          {isEditing ? (
            <Input
              value={item.productService}
              onChange={(e) => onCellChange(item.id, 'productService', e.target.value)}
              className="h-8"
              placeholder="Product/Service"
            />
          ) : (
            <div className="flex items-center gap-2">
              {isMainCategory && <Folder className="h-4 w-4 text-primary" />}
              {isSubCategory && <FolderOpen className="h-4 w-4 text-primary/70 ml-2" />}
              {item.productService}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right">
        {isEditing ? (
          <Input
            type="number"
            value={item.qty || ''}
            onChange={(e) => onCellChange(item.id, 'qty', e.target.value === '' ? '' : parseFloat(e.target.value) || '')}
            className={`h-8 text-right ${!isItem ? 'opacity-30 cursor-not-allowed bg-muted/30' : ''}`}
            placeholder="0"
            disabled={!isItem}
            readOnly={!isItem}
          />
        ) : (
          isItem ? formatNumber(item.qty) : <span className="text-muted-foreground/30">—</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        {isEditing ? (
          <Input
            type="number"
            step="0.01"
            value={item.rate || ''}
            onChange={(e) => onCellChange(item.id, 'rate', e.target.value === '' ? '' : parseFloat(e.target.value) || '')}
            className={`h-8 text-right ${!isItem ? 'opacity-30 cursor-not-allowed bg-muted/30' : ''}`}
            placeholder="0.00"
            disabled={!isItem}
            readOnly={!isItem}
          />
        ) : (
          isItem ? formatNumber(item.rate) : <span className="text-muted-foreground/30">—</span>
        )}
      </TableCell>
      <TableCell className="text-right font-medium">
        {isEditing ? (
          <Input
            type="number"
            step="0.01"
            value={item.amount || ''}
            onChange={(e) => onCellChange(item.id, 'amount', e.target.value === '' ? '' : parseFloat(e.target.value) || '')}
            className={`h-8 text-right ${!isItem ? 'opacity-30 cursor-not-allowed bg-muted/30' : ''}`}
            placeholder="0.00"
            disabled={!isItem}
            readOnly={!isItem}
          />
        ) : (
          isItem ? `$${formatNumber(item.amount)}` : <span className="text-muted-foreground/30">—</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        {isEditing ? (
          <div className="flex items-center justify-end gap-1">
            <Input
              type="number"
              min="0"
              max="100"
              step="5"
              value={item.progressOverallPct || ''}
              onChange={(e) => {
                let value = e.target.value === '' ? '' : parseFloat(e.target.value) || '';
                // Clamp value between 0 and 100
                if (value !== '' && typeof value === 'number') {
                  value = Math.max(0, Math.min(100, value));
                }
                onCellChange(item.id, 'progressOverallPct', value);
              }}
              className={`h-8 text-right ${!isItem ? 'opacity-30 cursor-not-allowed bg-muted/30' : ''}`}
              placeholder="0"
              disabled={!isItem}
              readOnly={!isItem}
            />
            <span className="text-muted-foreground text-sm">%</span>
          </div>
        ) : (
          isItem && item.progressOverallPct ? `${formatPercent(item.progressOverallPct)}%` : <span className="text-muted-foreground/30">—</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        {isEditing ? (
          <Input
            type="number"
            step="0.01"
            value={isItem ? calculatedCompletedAmount : (item.completedAmount || '')}
            onChange={(e) => onCellChange(item.id, 'completedAmount', e.target.value === '' ? '' : parseFloat(e.target.value) || '')}
            className={`h-8 text-right bg-muted ${!isItem ? 'opacity-30 cursor-not-allowed bg-muted/30' : ''}`}
            placeholder="0.00"
            disabled={true}
            readOnly={true}
            title={isItem ? "Calculated: % Progress Overall × Amount" : "Not applicable for headers"}
          />
        ) : (
          isItem && calculatedCompletedAmount ? `$${formatNumber(calculatedCompletedAmount)}` : <span className="text-muted-foreground/30">—</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        {isEditing ? (
          <div className="flex items-center justify-end gap-1">
            <Input
              type="number"
              min="0"
              max="100"
              step="5"
              value={item.previouslyInvoicedPct || ''}
              onChange={(e) => {
                let value = e.target.value === '' ? '' : parseFloat(e.target.value) || '';
                // Clamp value between 0 and 100
                if (value !== '' && typeof value === 'number') {
                  value = Math.max(0, Math.min(100, value));
                }
                onCellChange(item.id, 'previouslyInvoicedPct', value);
              }}
              className={`h-8 text-right ${!isItem ? 'opacity-30 cursor-not-allowed bg-muted/30' : ''}`}
              placeholder="0"
              disabled={!isItem}
              readOnly={!isItem}
            />
            <span className="text-muted-foreground text-sm">%</span>
          </div>
        ) : (
          isItem && item.previouslyInvoicedPct ? `${formatPercent(item.previouslyInvoicedPct)}%` : <span className="text-muted-foreground/30">—</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        {isEditing ? (
          <Input
            type="number"
            step="0.01"
            value={isItem ? calculatedPreviouslyInvoicedAmount : (item.previouslyInvoicedAmount || '')}
            onChange={(e) => onCellChange(item.id, 'previouslyInvoicedAmount', e.target.value === '' ? '' : parseFloat(e.target.value) || '')}
            className={`h-8 text-right bg-muted ${!isItem ? 'opacity-30 cursor-not-allowed bg-muted/30' : ''}`}
            placeholder="0.00"
            disabled={true}
            readOnly={true}
            title={isItem ? "Calculated: Amount × % Previously Invoiced" : "Not applicable for headers"}
          />
        ) : (
          isItem && calculatedPreviouslyInvoicedAmount ? `$${formatNumber(calculatedPreviouslyInvoicedAmount)}` : <span className="text-muted-foreground/30">—</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        {isEditing ? (
          <Input
            type="number"
            step="0.01"
            value={isItem ? calculatedNewProgressPct : (item.newProgressPct || '')}
            onChange={(e) => onCellChange(item.id, 'newProgressPct', e.target.value === '' ? '' : parseFloat(e.target.value) || '')}
            className={`h-8 text-right bg-muted ${!isItem ? 'opacity-30 cursor-not-allowed bg-muted/30' : ''}`}
            placeholder="0.00"
            disabled={true}
            readOnly={true}
            title={isItem ? "Calculated: % Progress Overall - % Previously Invoiced" : "Not applicable for headers"}
          />
        ) : (
          isItem && calculatedNewProgressPct ? `${formatPercent(calculatedNewProgressPct)}%` : <span className="text-muted-foreground/30">—</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        {isEditing ? (
          <Input
            type="number"
            step="0.01"
            value={isItem ? calculatedThisBill : (item.thisBill || '')}
            onChange={(e) => onCellChange(item.id, 'thisBill', e.target.value === '' ? '' : parseFloat(e.target.value) || '')}
            className={`h-8 text-right bg-muted ${!isItem ? 'opacity-30 cursor-not-allowed bg-muted/30' : ''}`}
            placeholder="0.00"
            disabled={true}
            readOnly={true}
            title={isItem ? "Calculated: % New Progress × Amount" : "Not applicable for headers"}
          />
        ) : (
          isItem && calculatedThisBill ? `$${formatNumber(calculatedThisBill)}` : <span className="text-muted-foreground/30">—</span>
        )}
      </TableCell>
      {isEditing && (
        <TableCell>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAddRow(index)}
              className="h-7 w-7 p-0"
              title="Add row below"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDeleteRow(item.id)}
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              title="Delete row"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      )}
    </motion.tr>
    {/* Insertion line below row */}
    {showInsertBelow && (
      <tr className="relative">
        <td colSpan={isEditing ? 11 : 10} className="h-2 p-0 relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full h-0.5 bg-primary border-b-2 border-b-primary border-dashed"></div>
            <div className="absolute left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-md text-xs font-semibold shadow-lg whitespace-nowrap">
              Drop here
            </div>
          </div>
        </td>
      </tr>
    )}
  </>
  );
}

export default function OrderTable({ items: initialItems, onItemsChange, orderId, onSaveSuccess }: OrderTableProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [items, setItems] = useState<EditableOrderItem[]>(() => 
    initialItems.map((item, index) => ({
      ...item,
      id: `item-${index}`,
      progressOverallPct: item.progressOverallPct || '',
      completedAmount: item.completedAmount || '',
      previouslyInvoicedPct: item.previouslyInvoicedPct || '',
      previouslyInvoicedAmount: item.previouslyInvoicedAmount || '',
      newProgressPct: item.newProgressPct || '',
      thisBill: item.thisBill || '',
    }))
  );

  // Track previous initialItems to detect changes
  const prevInitialItemsRef = useRef(initialItems);
  
  // Update items when initialItems change (e.g., after save) and not editing
  useEffect(() => {
    // Always update when initialItems change and we're not editing
    // This ensures we get the latest data after a save
    if (!isEditing) {
      setItems(
        initialItems.map((item, index) => ({
          ...item,
          id: `item-${index}`,
          progressOverallPct: item.progressOverallPct || '',
          completedAmount: item.completedAmount || '',
          previouslyInvoicedPct: item.previouslyInvoicedPct || '',
          previouslyInvoicedAmount: item.previouslyInvoicedAmount || '',
          newProgressPct: item.newProgressPct || '',
          thisBill: item.thisBill || '',
        }))
      );
      prevInitialItemsRef.current = initialItems;
    }
  }, [initialItems, isEditing]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [insertPosition, setInsertPosition] = useState<'above' | 'below' | null>(null);

  // Convert EditableOrderItem back to OrderItem format
  const convertToOrderItem = (editableItem: EditableOrderItem): OrderItem => {
    const { id, ...orderItem } = editableItem;
    // Include all progress payment fields in the OrderItem
    return orderItem;
  };

  // Notify parent of items change
  const updateItems = (newItems: EditableOrderItem[]) => {
    setItems(newItems);
    if (onItemsChange) {
      const orderItems = newItems.map(convertToOrderItem);
      onItemsChange(orderItems);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const overId = event.over?.id as string | null;
    setOverId(overId);
    
    // Determine insertion position based on mouse position relative to the row
    // Use a larger middle zone (40% of row height) to make insertion between rows easier
    if (overId && event.over) {
      try {
        const rect = event.over.rect;
        const activatorEvent = event.activatorEvent as MouseEvent | undefined;
        
        if (rect && activatorEvent) {
          const rowTop = rect.top;
          const rowBottom = rect.top + rect.height;
          const rowHeight = rect.height;
          const clientY = activatorEvent.clientY;
          
          // Define zones with very large middle zone for easier insertion between rows:
          // Top 15% = above, middle 70% = between rows (insert below), bottom 15% = below
          // This makes it much easier to insert between categories/headers - most of the row triggers "insert between"
          // Only the very top and bottom edges will trigger "above" or "below" the current row
          const topZone = rowTop + (rowHeight * 0.15);
          const bottomZone = rowTop + (rowHeight * 0.85);
          
          if (clientY < topZone) {
            // Top 15% - insert above this row (only at the very top edge)
            setInsertPosition('above');
          } else if (clientY > bottomZone) {
            // Bottom 15% - insert below this row (only at the very bottom edge)
            setInsertPosition('below');
          } else {
            // Middle 70% - insert between rows (show insertion line below current row)
            // This is the largest zone, making it very easy to insert between headers
            // The insertion line will appear below this row, indicating insertion between this and next row
            setInsertPosition('below');
          }
        } else {
          // Default to below if we can't determine position
          setInsertPosition('below');
        }
      } catch (e) {
        // Fallback to below if there's any error
        setInsertPosition('below');
      }
    } else {
      setInsertPosition(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        let newIndex = items.findIndex((item) => item.id === over.id);

        // Adjust insertion position based on insertPosition state
        // If insertPosition is 'below', we want to insert after the target row
        // If insertPosition is 'above', we want to insert before the target row (which is the current index)
        if (insertPosition === 'below') {
          // Insert after the target row
          newIndex = newIndex + 1;
        }
        // If 'above', newIndex stays the same (inserts before/at the target row position)

        // Ensure newIndex is within bounds
        newIndex = Math.max(0, Math.min(newIndex, items.length));

        const newItems = arrayMove(items, oldIndex, newIndex);
        updateItems(newItems);
        return newItems;
      });
    }

    setActiveId(null);
    setOverId(null);
    setInsertPosition(null);
  };

  const handleCellChange = (itemId: string, field: keyof EditableOrderItem, value: string | number) => {
    const newItems = items.map(item => 
      item.id === itemId 
        ? { ...item, [field]: value }
        : item
    );
    updateItems(newItems);
  };

  const handleAddRow = (insertAfterIndex: number, type: 'item' | 'maincategory' | 'subcategory' = 'item') => {
    const newItem: EditableOrderItem = {
      id: `item-${Date.now()}`,
      type,
      productService: type === 'maincategory' ? 'New Main Category' : type === 'subcategory' ? 'New Subcategory' : '',
      qty: '',
      rate: '',
      amount: '',
      progressOverallPct: '',
      completedAmount: '',
      previouslyInvoicedPct: '',
      previouslyInvoicedAmount: '',
      newProgressPct: '',
      thisBill: '',
    };
    
    const newItems = [...items];
    // If insertAfterIndex is -1, insert at the beginning
    if (insertAfterIndex === -1) {
      newItems.unshift(newItem);
    } else {
      newItems.splice(insertAfterIndex + 1, 0, newItem);
    }
    updateItems(newItems);
  };

  const handleDeleteRow = (itemId: string) => {
    const newItems = items.filter(item => item.id !== itemId);
    updateItems(newItems);
  };

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!orderId) {
      setSaveError('Order ID is required to save changes');
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const orderItems = items.map(convertToOrderItem);
      
      const response = await fetch(`/api/orders/${orderId}/items`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items: orderItems }),
      });

      const data = await response.json();

      if (data.success) {
        setIsEditing(false);
        setSaveError(null);
        // Show success toast
        toast({
          title: 'Changes saved successfully',
          description: 'Order items have been updated.',
        });
        // Notify parent to refresh contract data first
        if (onSaveSuccess) {
          await onSaveSuccess();
        }
        // Wait a bit for parent to refresh, then update items from refreshed initialItems
        // The useEffect will handle updating items when initialItems prop changes
      } else {
        const errorMessage = data.error || 'Failed to save changes';
        setSaveError(errorMessage);
        toast({
          title: 'Failed to save changes',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error saving order items:', error);
      const errorMessage = 'Failed to save changes. Please check your connection and try again.';
      setSaveError(errorMessage);
      toast({
        title: 'Error saving changes',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && isEditing) {
        e.preventDefault();
        if (!saving) {
          handleSave();
        }
      }
      // Ctrl+E or Cmd+E to edit
      if ((e.ctrlKey || e.metaKey) && e.key === 'e' && !isEditing) {
        e.preventDefault();
        setIsEditing(true);
      }
      // Esc to cancel
      if (e.key === 'Escape' && isEditing) {
        e.preventDefault();
        setIsEditing(false);
        setSaveError(null);
        setItems(initialItems.map((item, index) => ({
          ...item,
          id: `item-${index}`,
          progressOverallPct: item.progressOverallPct || '',
          completedAmount: item.completedAmount || '',
          previouslyInvoicedPct: item.previouslyInvoicedPct || '',
          previouslyInvoicedAmount: item.previouslyInvoicedAmount || '',
          newProgressPct: item.newProgressPct || '',
          thisBill: item.thisBill || '',
        })));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, saving, initialItems]);

  // Track item row numbers for alternating colors (excluding headers)
  const itemRowIndices = useMemo(() => {
    const indices: number[] = [];
    items.forEach((item, index) => {
      if (item.type === 'item') {
        indices.push(index);
      }
    });
    return indices;
  }, [items]);

  // Calculate total of all line item amounts
  const totalAmount = useMemo(() => {
    return items
      .filter(item => item.type === 'item')
      .reduce((sum, item) => {
        const amount = typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount || 0)) || 0;
        return sum + amount;
      }, 0);
  }, [items]);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Order Items</CardTitle>
            <CardDescription>
              {items.length} item{items.length !== 1 ? 's' : ''} in this order
            </CardDescription>
          </div>
          {!isEditing ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
                    <Edit2 className="mr-2 h-4 w-4" />
                    Edit Table
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Edit order items (Ctrl+E)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <div className="flex gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={handleSave} size="sm" disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Save changes (Ctrl+S)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      onClick={() => {
                        setIsEditing(false);
                        setSaveError(null);
                        // Reset items to initial state on cancel
                        setItems(initialItems.map((item, index) => ({
                          ...item,
                          id: `item-${index}`,
                          progressOverallPct: item.progressOverallPct || '',
                          completedAmount: item.completedAmount || '',
                          previouslyInvoicedPct: item.previouslyInvoicedPct || '',
                          previouslyInvoicedAmount: item.previouslyInvoicedAmount || '',
                          newProgressPct: item.newProgressPct || '',
                          thisBill: item.thisBill || '',
                        })));
                      }} 
                      variant="outline" 
                      size="sm"
                      disabled={saving}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Cancel editing (Esc)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {saveError && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-sm text-destructive">{saveError}</p>
          </div>
        )}
        <div className="rounded-md border overflow-x-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[300px]">PRODUCT/SERVICE</TableHead>
                  <TableHead className="text-right">QTY</TableHead>
                  <TableHead className="text-right">RATE</TableHead>
                  <TableHead className="text-right">AMOUNT</TableHead>
                  <TableHead className="text-right font-bold text-primary dark:text-primary/90">% Progress Overall</TableHead>
                  <TableHead className="text-right">$ Completed</TableHead>
                  <TableHead className="text-right font-bold text-primary dark:text-primary/90">% PREVIOUSLY INVOICED</TableHead>
                  <TableHead className="text-right">$ PREVIOUSLY INVOICED</TableHead>
                  <TableHead className="text-right">% NEW PROGRESS</TableHead>
                  <TableHead className="text-right">THIS BILL</TableHead>
                  {isEditing && <TableHead className="w-20">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                <SortableContext items={items.map(item => item.id)} strategy={verticalListSortingStrategy}>
                  {isEditing && (
                    <motion.tr
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b-2 border-dashed"
                    >
                      <TableCell colSpan={isEditing ? 11 : 10} className="text-center py-2">
                        <div className="flex gap-2 justify-center items-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddRow(-1, 'maincategory')}
                          >
                            <Folder className="mr-2 h-4 w-4" />
                            Add Main Category
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddRow(-1, 'subcategory')}
                          >
                            <FolderOpen className="mr-2 h-4 w-4" />
                            Add Subcategory
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddRow(-1, 'item')}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Row at Top
                          </Button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  )}
                  {items.map((item, index) => {
                    // Determine if this is an even item row (for alternating colors)
                    const itemIndex = itemRowIndices.indexOf(index);
                    const isEvenRow = itemIndex >= 0 && itemIndex % 2 === 0;

                    return (
                      <SortableRow
                        key={item.id}
                        item={item}
                        index={index}
                        isEditing={isEditing}
                        onCellChange={handleCellChange}
                        onAddRow={handleAddRow}
                        onDeleteRow={handleDeleteRow}
                        isEvenRow={isEvenRow}
                        activeId={activeId}
                        overId={overId}
                        insertPosition={insertPosition}
                        isFirstRow={index === 0}
                      />
                    );
                  })}
                  {isEditing && (
                    <motion.tr
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-t-2 border-dashed"
                    >
                      <TableCell colSpan={isEditing ? 11 : 10} className="text-center py-4">
                        <div className="flex gap-2 justify-center items-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddRow(items.length - 1, 'maincategory')}
                          >
                            <Folder className="mr-2 h-4 w-4" />
                            Add Main Category
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddRow(items.length - 1, 'subcategory')}
                          >
                            <FolderOpen className="mr-2 h-4 w-4" />
                            Add Subcategory
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddRow(items.length - 1, 'item')}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Row at Bottom
                          </Button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  )}
                  {/* Total row */}
                  <TableRow className="bg-muted/50 dark:bg-muted/30 border-t-2 border-primary/20">
                    <TableCell colSpan={isEditing ? 4 : 3} className="font-bold text-right">
                      Total
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell colSpan={isEditing ? 6 : 5}></TableCell>
                  </TableRow>
                </SortableContext>
              </TableBody>
            </Table>
            <DragOverlay>
              {activeId ? (
                (() => {
                  const activeItem = items.find(item => item.id === activeId);
                  if (!activeItem) return null;
                  const isMainCat = activeItem.type === 'maincategory';
                  const isSubCat = activeItem.type === 'subcategory';
                  
                  return (
                    <div className="bg-background border-2 border-primary rounded-md shadow-lg opacity-95">
                      <table className="w-full">
                        <tbody>
                          <tr className={`${isMainCat ? 'bg-primary/20' : isSubCat ? 'bg-primary/10' : ''}`}>
                            <td className="px-4 py-2 font-medium min-w-[300px]">
                              {isMainCat && <Folder className="inline h-4 w-4 text-primary mr-2" />}
                              {isSubCat && <FolderOpen className="inline h-4 w-4 text-primary/70 mr-2 ml-2" />}
                              {activeItem.productService}
                            </td>
                            <td className="px-4 py-2 text-right">{activeItem.qty || ''}</td>
                            <td className="px-4 py-2 text-right">{activeItem.rate || ''}</td>
                            <td className="px-4 py-2 text-right font-medium">
                              {activeItem.amount ? `$${typeof activeItem.amount === 'number' ? activeItem.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : activeItem.amount}` : ''}
                            </td>
                            <td className="px-4 py-2 text-right">—</td>
                            <td className="px-4 py-2 text-right">—</td>
                            <td className="px-4 py-2 text-right">—</td>
                            <td className="px-4 py-2 text-right">—</td>
                            <td className="px-4 py-2 text-right">—</td>
                            <td className="px-4 py-2 text-right">—</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  );
                })()
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </CardContent>
    </Card>
  );
}
