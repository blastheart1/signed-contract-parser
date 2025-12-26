'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Edit2, Save, X, Plus, Trash2, GripVertical, Folder, FolderOpen, Loader2, ChevronDown, Eye, EyeOff } from 'lucide-react';
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
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import FilterableTableHeaderText from '@/components/dashboard/FilterableTableHeaderText';
import VendorNameInput from '@/components/dashboard/VendorNameInput';
import type { OrderItem } from '@/lib/tableExtractor';
import type { UserRole } from '@/lib/auth/permissions';

interface OrderTableProps {
  items: OrderItem[];
  onItemsChange?: (items: OrderItem[]) => void;
  orderId?: string; // Order ID for saving to database
  onSaveSuccess?: () => void; // Callback after successful save
  isDeleted?: boolean; // Whether the contract is deleted
  projectStartDate?: string; // Project Start Date - required for edit mode (except for accountant role)
  userRole?: UserRole | null; // User role - accountant can edit without projectStartDate
  visibleColumnSet?: 'order-items' | 'vendor-selection'; // Which column set to display
}

interface EditableOrderItem extends OrderItem {
  id: string;
  progressOverallPct?: number | string;
  completedAmount?: number | string;
  previouslyInvoicedPct?: number | string;
  previouslyInvoicedAmount?: number | string;
  newProgressPct?: number | string;
  thisBill?: number | string;
  // Vendor Selection fields
  vendorName1?: string;
  vendorPercentage?: number | string;
  totalWorkAssignedToVendor?: number | string;
  estimatedVendorCost?: number | string;
  totalAmountWorkCompleted?: number | string;
  vendorBillingToDate?: number | string;
  vendorSavingsDeficit?: number | string;
}

// Sortable row component
function SortableRow({
  item,
  index,
  isEditing,
  editingColumn,
  onCellChange,
  onAddRow,
  onDeleteRow,
  isEvenRow,
  activeId,
  overId,
  insertPosition,
  isFirstRow,
  isDeleted,
  onEnterEditMode,
  showActionsColumn,
  canEdit = true, // Default to true for backward compatibility
  userRole,
  visibleColumnSet = 'order-items',
  vendors = [],
}: {
  item: EditableOrderItem;
  index: number;
  isEditing: boolean;
  editingColumn: 'progressOverall' | 'previouslyInvoiced' | null;
  onCellChange: (itemId: string, field: keyof EditableOrderItem, value: string | number) => void;
  onAddRow: (insertAfterIndex: number) => void;
  onDeleteRow: (itemId: string) => void;
  isEvenRow: boolean;
  activeId: string | null;
  isDeleted?: boolean;
  overId: string | null;
  insertPosition: 'above' | 'below' | null;
  isFirstRow: boolean;
  onEnterEditMode?: () => void;
  showActionsColumn?: boolean;
  canEdit?: boolean;
  userRole?: UserRole | null;
  visibleColumnSet?: 'order-items' | 'vendor-selection';
  vendors?: Array<{ id: string; name: string; status: 'active' | 'inactive' }>;
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isMainCategory = item.type === 'maincategory';
  
  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current && isEditing) {
      const textarea = textareaRef.current;
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';
      // Set height based on scrollHeight
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [item.productService, isEditing]);
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
    ? 'bg-primary/20 dark:bg-primary/30'
    : isSubCategory
    ? 'bg-primary/10 dark:bg-primary/20'
    : isEvenRow && isItem
    ? 'bg-muted dark:bg-muted/80'
    : isItem
    ? 'bg-background'
    : '';

  return (
    <>
      {/* Insertion line above row */}
      {showInsertAbove && (
        <tr className="relative">
          <td colSpan={
            visibleColumnSet === 'vendor-selection' 
              ? (isEditing && showActionsColumn ? 9 : 8)
              : (isEditing && showActionsColumn ? 11 : 10)
          } className="h-2 p-0 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full h-0.5 bg-primary border-t-2 border-t-primary border-dashed"></div>
              <div className="absolute left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-md text-xs font-semibold shadow-lg whitespace-nowrap">
                Drop here
              </div>
            </div>
          </td>
        </tr>
      )}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.tr
              ref={setNodeRef}
              style={style}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.02 }}
              onClick={() => {
                if (!isEditing && !editingColumn && canEdit !== false && isItem && onEnterEditMode) {
                  onEnterEditMode();
                }
              }}
              className={cn(
                rowBgClass,
                isMainCategory ? 'font-bold' : isSubCategory ? 'font-semibold' : '',
                isItem && !isEditing && !editingColumn && canEdit !== false ? 'cursor-pointer' : '',
                isItem && canEdit !== false ? 'hover:bg-green-200 dark:hover:bg-green-800/40 hover:shadow-sm transition-colors duration-150' : '',
                isDragOver ? 'ring-2 ring-primary ring-inset bg-primary/10' : '',
                isActive ? 'opacity-50' : ''
              )}
            >
      <TableCell className="font-medium w-[300px] pl-2 align-top">
        <div className="flex items-start gap-2 min-w-0">
          {isEditing && (
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground flex-shrink-0 mt-1"
              title="Drag to reorder"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}
          {isEditing ? (
            <Textarea
              ref={textareaRef}
              value={item.productService}
              onChange={(e) => onCellChange(item.id, 'productService', e.target.value)}
              className="min-h-[32px] w-full box-border flex-1 min-w-0 !px-1 text-left break-words resize-none overflow-hidden"
              placeholder="Product/Service"
              rows={1}
              style={{ height: 'auto' }}
            />
          ) : (
            <div className="flex items-start gap-2 min-w-0 flex-1">
              {isMainCategory && <Folder className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />}
              {isSubCategory && <FolderOpen className="h-4 w-4 text-primary/70 ml-2 flex-shrink-0 mt-0.5" />}
              <span className="break-words min-w-0">{item.productService}</span>
            </div>
          )}
        </div>
      </TableCell>
      {/* Order Items Columns (D-N) - only show when visibleColumnSet is 'order-items' */}
      {visibleColumnSet === 'order-items' && (
        <>
          <TableCell className="text-right w-[70px] min-h-[32px]">
            {isEditing ? (
              <Input
                type="number"
                value={item.qty || ''}
                onChange={(e) => onCellChange(item.id, 'qty', e.target.value === '' ? '' : parseFloat(e.target.value) || '')}
                className={`h-8 w-full box-border text-right !px-1 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-moz-appearance]:textfield ${!isItem ? 'opacity-30 cursor-not-allowed bg-muted/30' : ''}`}
                placeholder="0"
                disabled={!isItem}
                readOnly={!isItem}
              />
            ) : (
              <div className="min-h-[32px] flex items-center justify-end">
                {isItem ? (item.qty ? formatNumber(item.qty) : <span className="text-muted-foreground/30">—</span>) : ''}
              </div>
            )}
          </TableCell>
          <TableCell className="text-right w-[86px] min-h-[32px]">
            {isEditing ? (
              <Input
                type="number"
                step="0.01"
                value={item.rate || ''}
                onChange={(e) => onCellChange(item.id, 'rate', e.target.value === '' ? '' : parseFloat(e.target.value) || '')}
                className={`h-8 w-full box-border text-right !px-1 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-moz-appearance]:textfield ${!isItem ? 'opacity-30 cursor-not-allowed bg-muted/30' : ''}`}
                placeholder="0.00"
                disabled={!isItem}
                readOnly={!isItem}
              />
            ) : (
              <div className="min-h-[32px] flex items-center justify-end">
                {isItem ? (item.rate ? formatNumber(item.rate) : <span className="text-muted-foreground/30">—</span>) : ''}
              </div>
            )}
          </TableCell>
          <TableCell className="text-right font-medium w-[95px] min-h-[32px]">
            {isEditing ? (
              <Input
                type="number"
                step="0.01"
                value={item.amount || ''}
                onChange={(e) => onCellChange(item.id, 'amount', e.target.value === '' ? '' : parseFloat(e.target.value) || '')}
                className={`h-8 w-full box-border text-right !px-1 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-moz-appearance]:textfield ${!isItem ? 'opacity-30 cursor-not-allowed bg-muted/30' : ''}`}
                placeholder="0.00"
                disabled={!isItem}
                readOnly={!isItem}
              />
            ) : (
              <div className="min-h-[32px] flex items-center justify-end">
                {isItem ? (item.amount ? `$${formatNumber(item.amount)}` : <span className="text-muted-foreground/30">—</span>) : ''}
              </div>
            )}
          </TableCell>
          <TableCell className="text-right w-[90px] min-h-[32px]">
            {(isEditing || editingColumn === 'progressOverall') ? (
              <div className="flex items-center justify-end gap-1 w-full">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="5"
                  value={item.progressOverallPct ?? ''}
                  onChange={(e) => {
                    const parsed = parseFloat(e.target.value);
                    let value = e.target.value === '' || isNaN(parsed) ? '' : parsed;
                    // Clamp value between 0 and 100
                    if (value !== '' && typeof value === 'number') {
                      value = Math.max(0, Math.min(100, value));
                    }
                    onCellChange(item.id, 'progressOverallPct', value);
                  }}
                  className={`h-8 w-full box-border text-right !px-1 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-moz-appearance]:textfield ${!isItem ? 'opacity-30 cursor-not-allowed bg-muted/30' : ''}`}
                  placeholder="0"
                  disabled={!isItem}
                  readOnly={!isItem}
                />
                <span className="text-muted-foreground text-sm whitespace-nowrap flex-shrink-0">%</span>
              </div>
            ) : (
              <div className="min-h-[32px] flex items-center justify-end">
                {isItem ? (item.progressOverallPct ? `${formatPercent(item.progressOverallPct)}%` : <span className="text-muted-foreground/30">—</span>) : ''}
              </div>
            )}
          </TableCell>
          <TableCell className="text-right w-[110px] min-h-[32px]">
            {isEditing ? (
              <Input
                type="number"
                step="0.01"
                value={isItem ? calculatedCompletedAmount : (item.completedAmount || '')}
                onChange={(e) => onCellChange(item.id, 'completedAmount', e.target.value === '' ? '' : parseFloat(e.target.value) || '')}
                className={`h-8 w-full box-border text-right bg-muted !px-1 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-moz-appearance]:textfield ${!isItem ? 'opacity-30 cursor-not-allowed bg-muted/30' : ''}`}
                placeholder="0.00"
                disabled={true}
                readOnly={true}
                title={isItem ? "Calculated: % Progress Overall × Amount" : "Not applicable for headers"}
                style={{ paddingRight: '8px' }}
              />
            ) : (
              <div className="min-h-[32px] flex items-center justify-end">
                {isItem ? (calculatedCompletedAmount ? `$${formatNumber(calculatedCompletedAmount)}` : <span className="text-muted-foreground/30">—</span>) : ''}
              </div>
            )}
          </TableCell>
          <TableCell className="text-right w-[115px] min-h-[32px]">
            {(isEditing || editingColumn === 'previouslyInvoiced') ? (
              <div className="flex items-center justify-end gap-1 w-full">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="5"
                  value={item.previouslyInvoicedPct ?? ''}
                  onChange={(e) => {
                    const parsed = parseFloat(e.target.value);
                    let value = e.target.value === '' || isNaN(parsed) ? '' : parsed;
                    // Clamp value between 0 and 100
                    if (value !== '' && typeof value === 'number') {
                      value = Math.max(0, Math.min(100, value));
                    }
                    onCellChange(item.id, 'previouslyInvoicedPct', value);
                  }}
                  className={`h-8 w-full box-border text-right !px-1 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-moz-appearance]:textfield ${!isItem ? 'opacity-30 cursor-not-allowed bg-muted/30' : ''}`}
                  placeholder="0"
                  disabled={!isItem}
                  readOnly={!isItem}
                />
                <span className="text-muted-foreground text-sm whitespace-nowrap flex-shrink-0">%</span>
              </div>
            ) : (
              <div className="min-h-[32px] flex items-center justify-end">
                {isItem ? (item.previouslyInvoicedPct ? `${formatPercent(item.previouslyInvoicedPct)}%` : <span className="text-muted-foreground/30">—</span>) : ''}
              </div>
            )}
          </TableCell>
          <TableCell className="text-right w-[140px] min-h-[32px]">
            {isEditing ? (
              <Input
                type="number"
                step="0.01"
                value={isItem ? calculatedPreviouslyInvoicedAmount : (item.previouslyInvoicedAmount || '')}
                onChange={(e) => onCellChange(item.id, 'previouslyInvoicedAmount', e.target.value === '' ? '' : parseFloat(e.target.value) || '')}
                className={`h-8 w-full box-border text-right bg-muted !px-1 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-moz-appearance]:textfield ${!isItem ? 'opacity-30 cursor-not-allowed bg-muted/30' : ''}`}
                placeholder="0.00"
                disabled={true}
                readOnly={true}
                title={isItem ? "Calculated: Amount × % Previously Invoiced" : "Not applicable for headers"}
                style={{ paddingRight: '8px' }}
              />
            ) : (
              <div className="min-h-[32px] flex items-center justify-end">
                {isItem ? (calculatedPreviouslyInvoicedAmount ? `$${formatNumber(calculatedPreviouslyInvoicedAmount)}` : <span className="text-muted-foreground/30">—</span>) : ''}
              </div>
            )}
          </TableCell>
          <TableCell className="text-right w-[90px] min-h-[32px]">
            {isEditing ? (
              <Input
                type="number"
                step="0.01"
                value={isItem ? calculatedNewProgressPct : (item.newProgressPct || '')}
                onChange={(e) => onCellChange(item.id, 'newProgressPct', e.target.value === '' ? '' : parseFloat(e.target.value) || '')}
                className={`h-8 w-full box-border text-right bg-muted !px-1 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-moz-appearance]:textfield ${!isItem ? 'opacity-30 cursor-not-allowed bg-muted/30' : ''}`}
                placeholder="0.00"
                disabled={true}
                readOnly={true}
                title={isItem ? "Calculated: % Progress Overall - % Previously Invoiced" : "Not applicable for headers"}
                style={{ paddingRight: '8px' }}
              />
            ) : (
              <div className="min-h-[32px] flex items-center justify-end">
                {isItem ? (calculatedNewProgressPct ? `${formatPercent(calculatedNewProgressPct)}%` : <span className="text-muted-foreground/30">—</span>) : ''}
              </div>
            )}
          </TableCell>
          <TableCell className={cn("text-right w-[105px] min-h-[32px]", visibleColumnSet === 'order-items' && "border-r border-black")}>
            {isEditing ? (
              <Input
                type="number"
                step="0.01"
                value={isItem ? calculatedThisBill : (item.thisBill || '')}
                onChange={(e) => onCellChange(item.id, 'thisBill', e.target.value === '' ? '' : parseFloat(e.target.value) || '')}
                className={`h-8 w-full box-border text-right bg-muted !px-1 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-moz-appearance]:textfield ${!isItem ? 'opacity-30 cursor-not-allowed bg-muted/30' : ''}`}
                placeholder="0.00"
                disabled={true}
                readOnly={true}
                title={isItem ? "Calculated: % New Progress × Amount" : "Not applicable for headers"}
                style={{ paddingRight: '8px' }}
              />
            ) : (
              <div className="min-h-[32px] flex items-center justify-end">
                {isItem ? (calculatedThisBill ? `$${formatNumber(calculatedThisBill)}` : <span className="text-muted-foreground/30">—</span>) : ''}
              </div>
            )}
          </TableCell>
        </>
      )}
      {/* Vendor Selection Columns (Q-W) - only show when visibleColumnSet is 'vendor-selection' */}
      {visibleColumnSet === 'vendor-selection' && (
        <>
          <TableCell className="text-center align-middle" style={{ width: '15%' }}>
            {isEditing && isItem ? (
              <div className="flex items-center justify-center">
                {/* #region agent log */}
                {(()=>{fetch('http://127.0.0.1:7242/ingest/6b8d521d-ec00-4db7-90b9-4fcc586b69d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'OrderTable.tsx:502',message:'Rendering VendorNameInput component',data:{itemId:item.id,rowIndex:index},timestamp:Date.now(),sessionId:'debug-session',runId:'vendor-api-debug',hypothesisId:'A'})}).catch(()=>{});return null;})()}
                {/* #endregion */}
                <VendorNameInput
                  value={item.vendorName1 || ''}
                  onChange={(value) => onCellChange(item.id, 'vendorName1', value)}
                  className="h-8 w-full box-border !px-1 text-center"
                  placeholder="Vendor name"
                  disabled={isDeleted}
                  vendors={vendors}
                />
              </div>
            ) : (
              <div className="min-h-[32px] flex items-center justify-center">
                {isItem ? (item.vendorName1 || <span className="text-muted-foreground/30">—</span>) : ''}
              </div>
            )}
          </TableCell>
          <TableCell className="text-right min-h-[32px]" style={{ width: '8%' }}>
            {isEditing && isItem ? (
              <div className="flex items-center justify-end gap-1 w-full">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={item.vendorPercentage ?? 100}
                  onChange={(e) => {
                    const parsed = parseFloat(e.target.value);
                    const value = e.target.value === '' || isNaN(parsed) ? '' : Math.max(0, Math.min(100, parsed));
                    onCellChange(item.id, 'vendorPercentage', value);
                  }}
                  className="h-8 w-full box-border text-right !px-1 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-moz-appearance]:textfield"
                  placeholder="100"
                  disabled={isDeleted}
                />
                <span className="text-muted-foreground text-sm whitespace-nowrap flex-shrink-0">%</span>
              </div>
            ) : (
              <div className="min-h-[32px] flex items-center justify-end">
                {isItem ? (item.vendorPercentage ? `${formatPercent(item.vendorPercentage)}%` : '100%') : ''}
              </div>
            )}
          </TableCell>
          <TableCell className="text-right min-h-[32px]" style={{ width: '15%' }}>
            {isEditing && isItem ? (
              <Input
                type="number"
                step="0.01"
                value={item.totalWorkAssignedToVendor ?? amount}
                onChange={(e) => onCellChange(item.id, 'totalWorkAssignedToVendor', e.target.value === '' ? '' : parseFloat(e.target.value) || '')}
                className="h-8 w-full box-border text-right !px-1 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-moz-appearance]:textfield"
                placeholder="0.00"
                disabled={isDeleted}
              />
            ) : (
              <div className="min-h-[32px] flex items-center justify-end">
                {isItem ? (item.totalWorkAssignedToVendor ? `$${formatNumber(item.totalWorkAssignedToVendor)}` : (amount ? `$${formatNumber(amount)}` : <span className="text-muted-foreground/30">—</span>)) : ''}
              </div>
            )}
          </TableCell>
          <TableCell className="text-right min-h-[32px]" style={{ width: '13%' }}>
            {isEditing && isItem ? (
              <Input
                type="number"
                step="0.01"
                value={item.estimatedVendorCost ?? (amount * 0.5)}
                onChange={(e) => onCellChange(item.id, 'estimatedVendorCost', e.target.value === '' ? '' : parseFloat(e.target.value) || '')}
                className="h-8 w-full box-border text-right !px-1 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-moz-appearance]:textfield"
                placeholder="0.00"
                disabled={isDeleted}
              />
            ) : (
              <div className="min-h-[32px] flex items-center justify-end">
                {isItem ? (item.estimatedVendorCost ? `$${formatNumber(item.estimatedVendorCost)}` : (amount ? `$${formatNumber(amount * 0.5)}` : <span className="text-muted-foreground/30">—</span>)) : ''}
              </div>
            )}
          </TableCell>
          <TableCell className="text-right min-h-[32px]" style={{ width: '15%' }}>
            {isEditing && isItem ? (
              <Input
                type="number"
                step="0.01"
                value={item.totalAmountWorkCompleted || ''}
                onChange={(e) => onCellChange(item.id, 'totalAmountWorkCompleted', e.target.value === '' ? '' : parseFloat(e.target.value) || '')}
                className="h-8 w-full box-border text-right !px-1 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-moz-appearance]:textfield"
                placeholder="0.00"
                disabled={isDeleted}
              />
            ) : (
              <div className="min-h-[32px] flex items-center justify-end">
                {isItem ? (item.totalAmountWorkCompleted ? `$${formatNumber(item.totalAmountWorkCompleted)}` : <span className="text-muted-foreground/30">—</span>) : ''}
              </div>
            )}
          </TableCell>
          <TableCell className="text-right min-h-[32px]" style={{ width: '13%' }}>
            {isEditing && isItem ? (
              <Input
                type="number"
                step="0.01"
                value={item.vendorBillingToDate || ''}
                onChange={(e) => onCellChange(item.id, 'vendorBillingToDate', e.target.value === '' ? '' : parseFloat(e.target.value) || '')}
                className="h-8 w-full box-border text-right !px-1 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-moz-appearance]:textfield"
                placeholder="0.00"
                disabled={isDeleted}
              />
            ) : (
              <div className="min-h-[32px] flex items-center justify-end">
                {isItem ? (item.vendorBillingToDate ? `$${formatNumber(item.vendorBillingToDate)}` : <span className="text-muted-foreground/30">—</span>) : ''}
              </div>
            )}
          </TableCell>
          <TableCell className={cn("text-right min-h-[32px]", isEditing && showActionsColumn && "border-r border-black")} style={{ width: '21%' }}>
            {isEditing && isItem ? (
              <Input
                type="number"
                step="0.01"
                value={item.vendorSavingsDeficit || ''}
                onChange={(e) => onCellChange(item.id, 'vendorSavingsDeficit', e.target.value === '' ? '' : parseFloat(e.target.value) || '')}
                className="h-8 w-full box-border text-right !px-1 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-moz-appearance]:textfield"
                placeholder="0.00"
                disabled={isDeleted}
              />
            ) : (
              <div className="min-h-[32px] flex items-center justify-end">
                {isItem ? (item.vendorSavingsDeficit ? `$${formatNumber(item.vendorSavingsDeficit)}` : <span className="text-muted-foreground/30">—</span>) : ''}
              </div>
            )}
          </TableCell>
        </>
      )}
      {isEditing && showActionsColumn && (
        <TableCell className="w-[80px]">
          <div className="flex gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => !isDeleted && onAddRow(index)}
                    disabled={isDeleted}
                    className={`h-7 w-7 p-0 ${isDeleted ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isDeleted ? 'Restore first before editing' : 'Add row below'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => !isDeleted && onDeleteRow(item.id)}
                    disabled={isDeleted}
                    className={`h-7 w-7 p-0 text-destructive hover:text-destructive ${isDeleted ? 'opacity-50 cursor-not-allowed' : ''}`}
                    aria-label={`Delete ${item.productService || 'row'}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isDeleted ? 'Restore first before editing' : 'Delete row'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </TableCell>
      )}
            </motion.tr>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {!isEditing && !editingColumn && canEdit && isItem 
                ? 'Click to enter edit mode' 
                : !isEditing && !editingColumn && !canEdit && !isDeleted && isItem 
                ? (userRole !== 'accountant' ? 'Update Project Start Date first' : '')
                : ''}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    {/* Insertion line below row */}
    {showInsertBelow && (
      <tr className="relative">
        <td colSpan={
          visibleColumnSet === 'vendor-selection' 
            ? (isEditing && showActionsColumn ? 9 : 8)
            : (isEditing && showActionsColumn ? 11 : 10)
        } className="h-2 p-0 relative">
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

export default function OrderTable({ items: initialItems, onItemsChange, orderId, onSaveSuccess, isDeleted = false, projectStartDate, userRole, visibleColumnSet = 'order-items' }: OrderTableProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editingColumn, setEditingColumn] = useState<'progressOverall' | 'previouslyInvoiced' | null>(null);
  const [showMainCategories, setShowMainCategories] = useState(true);
  const [showSubCategories, setShowSubCategories] = useState(true);
  const [productFilter, setProductFilter] = useState<string>('');
  const [showActionsColumn, setShowActionsColumn] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Load vendors once for all VendorNameInput components
  const [vendors, setVendors] = useState<Array<{ id: string; name: string; status: 'active' | 'inactive' }>>([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  
  useEffect(() => {
    // Only load vendors if we're in vendor-selection mode
    if (visibleColumnSet !== 'vendor-selection') {
      return;
    }

    let mounted = true;

    const loadVendors = async () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/6b8d521d-ec00-4db7-90b9-4fcc586b69d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'OrderTable.tsx:720',message:'OrderTable loading vendors once',data:{visibleColumnSet},timestamp:Date.now(),sessionId:'debug-session',runId:'vendor-api-debug',hypothesisId:'FIX'})}).catch(()=>{});
      // #endregion
      try {
        setVendorsLoading(true);
        const response = await fetch('/api/vendors?status=active&pageSize=1000');
        
        if (!response.ok) {
          throw new Error('Failed to load vendors');
        }

        const data = await response.json();
        
        if (mounted && data.success) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/6b8d521d-ec00-4db7-90b9-4fcc586b69d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'OrderTable.tsx:732',message:'OrderTable vendors loaded successfully',data:{vendorCount:data.data?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'vendor-api-debug',hypothesisId:'FIX'})}).catch(()=>{});
          // #endregion
          setVendors(data.data || []);
        }
      } catch (error) {
        console.error('[OrderTable] Error loading vendors:', error);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/6b8d521d-ec00-4db7-90b9-4fcc586b69d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'OrderTable.tsx:738',message:'OrderTable vendor API call failed',data:{error:error instanceof Error?error.message:'Unknown'},timestamp:Date.now(),sessionId:'debug-session',runId:'vendor-api-debug',hypothesisId:'FIX'})}).catch(()=>{});
        // #endregion
      } finally {
        if (mounted) {
          setVendorsLoading(false);
        }
      }
    };

    loadVendors();

    return () => {
      mounted = false;
    };
  }, [visibleColumnSet]);

  // Compute if edit mode is allowed
  // Accountant role can edit without projectStartDate, other roles require it
  const canEdit = useMemo(() => {
    if (isDeleted) return false;
    // Accountant role can always edit
    if (userRole === 'accountant') return true;
    // Other roles require projectStartDate
    return !!projectStartDate && projectStartDate.trim() !== '';
  }, [isDeleted, projectStartDate, userRole]);

  // Helper to get appropriate message for edit restrictions
  const getEditRestrictionMessage = useMemo(() => {
    if (isDeleted) {
      return { title: 'Contract Deleted', description: 'Restore first before editing' };
    }
    if (userRole !== 'accountant' && (!projectStartDate || projectStartDate.trim() === '')) {
      return { 
        title: 'Project Start Date Required', 
        description: 'Please update Project Start Date first before editing the table.' 
      };
    }
    return null;
  }, [isDeleted, userRole, projectStartDate]);
  
  // Auto-compute rate if empty/null: Rate = Amount / Quantity
  const autoComputeRate = (item: OrderItem | EditableOrderItem): EditableOrderItem => {
    const editableItem = 'id' in item ? item as EditableOrderItem : {
      ...item,
      id: '',
      progressOverallPct: item.progressOverallPct || '',
      completedAmount: item.completedAmount || '',
      previouslyInvoicedPct: item.previouslyInvoicedPct || '',
      previouslyInvoicedAmount: item.previouslyInvoicedAmount || '',
      newProgressPct: item.newProgressPct || '',
      thisBill: item.thisBill || '',
    };

    // Only compute for items (not categories)
    if (editableItem.type !== 'item') {
      return editableItem;
    }

    // Only compute if rate is empty, null, or doesn't exist
    const rateIsEmpty = 
      editableItem.rate === null || 
      editableItem.rate === undefined || 
      editableItem.rate === '' || 
      (typeof editableItem.rate === 'string' && editableItem.rate.trim() === '') ||
      (typeof editableItem.rate === 'number' && isNaN(editableItem.rate));

    if (!rateIsEmpty) {
      // Rate already exists, don't overwrite
      return editableItem;
    }

    // Get amount and quantity values
    const amount = typeof editableItem.amount === 'number' 
      ? editableItem.amount 
      : parseFloat(String(editableItem.amount || 0)) || 0;
    
    const qty = typeof editableItem.qty === 'number'
      ? editableItem.qty
      : parseFloat(String(editableItem.qty || 0)) || 0;

    // Only compute if both amount and quantity are valid numbers > 0
    if (amount > 0 && qty > 0) {
      const computedRate = amount / qty;
      return {
        ...editableItem,
        rate: computedRate,
      };
    }

    return editableItem;
  };

  const [items, setItems] = useState<EditableOrderItem[]>(() => 
    initialItems.map((item, index) => {
      const amount = typeof item.amount === 'number' ? item.amount : (typeof item.amount === 'string' ? parseFloat(item.amount) || 0 : 0);
      const editableItem = {
        ...item,
        id: `item-${index}`,
        progressOverallPct: item.progressOverallPct || '',
        completedAmount: item.completedAmount || '',
        previouslyInvoicedPct: item.previouslyInvoicedPct || '',
        previouslyInvoicedAmount: item.previouslyInvoicedAmount || '',
            newProgressPct: item.newProgressPct || '',
            thisBill: item.thisBill || '',
            // Vendor Selection - preserve actual values, only set defaults if truly undefined/null
            vendorName1: item.vendorName1 !== undefined && item.vendorName1 !== null ? item.vendorName1 : '',
            vendorPercentage: item.vendorPercentage !== undefined && item.vendorPercentage !== null ? item.vendorPercentage : 100,
            totalWorkAssignedToVendor: item.totalWorkAssignedToVendor !== undefined && item.totalWorkAssignedToVendor !== null ? item.totalWorkAssignedToVendor : amount,
            estimatedVendorCost: item.estimatedVendorCost !== undefined && item.estimatedVendorCost !== null ? item.estimatedVendorCost : (amount * 0.5),
            totalAmountWorkCompleted: item.totalAmountWorkCompleted !== undefined && item.totalAmountWorkCompleted !== null ? item.totalAmountWorkCompleted : '',
            vendorBillingToDate: item.vendorBillingToDate !== undefined && item.vendorBillingToDate !== null ? item.vendorBillingToDate : '',
            vendorSavingsDeficit: item.vendorSavingsDeficit !== undefined && item.vendorSavingsDeficit !== null ? item.vendorSavingsDeficit : '',
          };
          return autoComputeRate(editableItem);
        })
      );

  // Track previous initialItems to detect changes
  const prevInitialItemsRef = useRef(initialItems);
  
  // Update items when initialItems change (e.g., after save) and not editing
  useEffect(() => {
    // Always update when initialItems change and we're not editing
    // This ensures we get the latest data after a save
    if (!isEditing) {
      setItems(
        initialItems.map((item, index) => {
          const amount = typeof item.amount === 'number' ? item.amount : (typeof item.amount === 'string' ? parseFloat(item.amount) || 0 : 0);
          const editableItem = {
            ...item,
            id: `item-${index}`,
            progressOverallPct: item.progressOverallPct || '',
            completedAmount: item.completedAmount || '',
            previouslyInvoicedPct: item.previouslyInvoicedPct || '',
            previouslyInvoicedAmount: item.previouslyInvoicedAmount || '',
            newProgressPct: item.newProgressPct || '',
            thisBill: item.thisBill || '',
            // Vendor Selection - preserve actual values, only set defaults if truly undefined/null
            vendorName1: item.vendorName1 !== undefined && item.vendorName1 !== null ? item.vendorName1 : '',
            vendorPercentage: item.vendorPercentage !== undefined && item.vendorPercentage !== null ? item.vendorPercentage : 100,
            totalWorkAssignedToVendor: item.totalWorkAssignedToVendor !== undefined && item.totalWorkAssignedToVendor !== null ? item.totalWorkAssignedToVendor : amount,
            estimatedVendorCost: item.estimatedVendorCost !== undefined && item.estimatedVendorCost !== null ? item.estimatedVendorCost : (amount * 0.5),
            totalAmountWorkCompleted: item.totalAmountWorkCompleted !== undefined && item.totalAmountWorkCompleted !== null ? item.totalAmountWorkCompleted : '',
            vendorBillingToDate: item.vendorBillingToDate !== undefined && item.vendorBillingToDate !== null ? item.vendorBillingToDate : '',
            vendorSavingsDeficit: item.vendorSavingsDeficit !== undefined && item.vendorSavingsDeficit !== null ? item.vendorSavingsDeficit : '',
          };
          return autoComputeRate(editableItem);
        })
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
    const newItems = items.map(item => {
      if (item.id === itemId) {
        const updatedItem = { ...item, [field]: value };
        // Auto-compute rate if amount or qty changed and rate is empty
        if ((field === 'amount' || field === 'qty') && updatedItem.type === 'item') {
          return autoComputeRate(updatedItem);
        }
        return updatedItem;
      }
      return item;
    });
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
      // #region agent log
      const vendorItems = orderItems.filter((item, idx) => {
        const hasVendorData = item.vendorName1 || item.vendorPercentage !== undefined || item.totalWorkAssignedToVendor !== undefined || item.estimatedVendorCost !== undefined || item.totalAmountWorkCompleted !== undefined || item.vendorBillingToDate !== undefined || item.vendorSavingsDeficit !== undefined;
        if (hasVendorData && idx < 3) {
          fetch('http://127.0.0.1:7242/ingest/6b8d521d-ec00-4db7-90b9-4fcc586b69d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/dashboard/OrderTable.tsx:1020',message:'Saving vendor data',data:{itemIndex:idx,hasVendorName1:!!item.vendorName1,vendorName1:item.vendorName1,vendorPercentage:item.vendorPercentage,totalWorkAssignedToVendor:item.totalWorkAssignedToVendor,estimatedVendorCost:item.estimatedVendorCost},timestamp:Date.now(),sessionId:'debug-session',runId:'save-vendor',hypothesisId:'A'})}).catch(()=>{});
        }
        return hasVendorData;
      });
      fetch('http://127.0.0.1:7242/ingest/6b8d521d-ec00-4db7-90b9-4fcc586b69d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/dashboard/OrderTable.tsx:1020',message:'Save request summary',data:{totalItems:orderItems.length,itemsWithVendorData:vendorItems.length,firstItemVendorName1:orderItems[0]?.vendorName1,firstItemVendorPercentage:orderItems[0]?.vendorPercentage},timestamp:Date.now(),sessionId:'debug-session',runId:'save-vendor',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
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
        setEditingColumn(null);
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
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && (isEditing || editingColumn)) {
        e.preventDefault();
        if (!saving) {
          handleSave();
        }
      }
      // Ctrl+E or Cmd+E to edit
      if ((e.ctrlKey || e.metaKey) && e.key === 'e' && !isEditing && !editingColumn && canEdit) {
        e.preventDefault();
        setIsEditing(true);
        setEditingColumn(null);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'e' && !isEditing && !editingColumn && !canEdit && !isDeleted) {
        // Show toast on mobile/desktop when edit is disabled
        e.preventDefault();
        if (getEditRestrictionMessage) {
          toast({
            title: getEditRestrictionMessage.title,
            description: getEditRestrictionMessage.description,
            variant: 'destructive',
          });
        }
      }
      // Esc to cancel
      if (e.key === 'Escape' && (isEditing || editingColumn)) {
        e.preventDefault();
        setIsEditing(false);
        setEditingColumn(null);
        setSaveError(null);
        setItems(initialItems.map((item, index) => {
          const amount = typeof item.amount === 'number' ? item.amount : (typeof item.amount === 'string' ? parseFloat(item.amount) || 0 : 0);
          const editableItem = {
            ...item,
            id: `item-${index}`,
            progressOverallPct: item.progressOverallPct || '',
            completedAmount: item.completedAmount || '',
            previouslyInvoicedPct: item.previouslyInvoicedPct || '',
            previouslyInvoicedAmount: item.previouslyInvoicedAmount || '',
            newProgressPct: item.newProgressPct || '',
            thisBill: item.thisBill || '',
            // Vendor Selection - preserve actual values, only set defaults if truly undefined/null
            vendorName1: item.vendorName1 !== undefined && item.vendorName1 !== null ? item.vendorName1 : '',
            vendorPercentage: item.vendorPercentage !== undefined && item.vendorPercentage !== null ? item.vendorPercentage : 100,
            totalWorkAssignedToVendor: item.totalWorkAssignedToVendor !== undefined && item.totalWorkAssignedToVendor !== null ? item.totalWorkAssignedToVendor : amount,
            estimatedVendorCost: item.estimatedVendorCost !== undefined && item.estimatedVendorCost !== null ? item.estimatedVendorCost : (amount * 0.5),
            totalAmountWorkCompleted: item.totalAmountWorkCompleted !== undefined && item.totalAmountWorkCompleted !== null ? item.totalAmountWorkCompleted : '',
            vendorBillingToDate: item.vendorBillingToDate !== undefined && item.vendorBillingToDate !== null ? item.vendorBillingToDate : '',
            vendorSavingsDeficit: item.vendorSavingsDeficit !== undefined && item.vendorSavingsDeficit !== null ? item.vendorSavingsDeficit : '',
          };
          return autoComputeRate(editableItem);
        }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, saving, initialItems, editingColumn, canEdit, isDeleted, getEditRestrictionMessage, toast]);

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

  // Filter items based on show/hide settings and product/service filter
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Apply category filters first
      if (item.type === 'maincategory') {
        return showMainCategories;
      }
      if (item.type === 'subcategory') {
        return showSubCategories;
      }
      
      // Then apply product/service text filter (view-only, doesn't affect order)
      if (productFilter.trim()) {
        const productService = (item.productService || '').toLowerCase();
        const filterText = productFilter.toLowerCase();
        if (!productService.includes(filterText)) {
          return false;
        }
      }
      
      return true; // Always show items that pass all filters
    });
  }, [items, showMainCategories, showSubCategories, productFilter]);

  // Calculate totals for progress and financial columns based on filtered items
  // All totals use filteredItems so they reflect the current view (including filters)
  const totalProgressOverallPct = useMemo(() => {
    const itemItems = filteredItems.filter(item => item.type === 'item');
    let totalAmountTimesPct = 0;
    let totalAmount = 0;
    
    itemItems.forEach(item => {
      const amount = typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount || 0)) || 0;
      const progressPct = typeof item.progressOverallPct === 'number' 
        ? item.progressOverallPct 
        : parseFloat(String(item.progressOverallPct || 0)) || 0;
      
      // Only include items with valid amounts and percentages
      if (amount > 0 && progressPct !== null && progressPct !== undefined && !isNaN(progressPct)) {
        totalAmountTimesPct += amount * progressPct;
        totalAmount += amount;
      }
    });
    
    return totalAmount > 0 ? totalAmountTimesPct / totalAmount : 0;
  }, [filteredItems]);

  const totalCompletedAmount = useMemo(() => {
    return filteredItems
      .filter(item => item.type === 'item')
      .reduce((sum, item) => {
        const amount = typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount || 0)) || 0;
        const progressOverallPct = typeof item.progressOverallPct === 'number' 
          ? item.progressOverallPct 
          : parseFloat(String(item.progressOverallPct || 0)) || 0;
        
        // Calculate completed amount: % Progress Overall * Amount (same logic as SortableRow)
        const hasProgressPct = (progressOverallPct !== null && progressOverallPct !== undefined && 
          (typeof progressOverallPct === 'string' ? progressOverallPct !== '' : true) && 
          !isNaN(Number(progressOverallPct)));
        
        if (hasProgressPct && amount > 0) {
          const progressOverallDecimal = progressOverallPct / 100;
          return sum + (progressOverallDecimal * amount);
        }
        
        // Fallback to stored completedAmount if available
        const completedAmount = item.completedAmount 
          ? (typeof item.completedAmount === 'number' ? item.completedAmount : parseFloat(String(item.completedAmount)) || 0)
          : 0;
        return sum + completedAmount;
      }, 0);
  }, [filteredItems]);

  const totalPreviouslyInvoicedPct = useMemo(() => {
    const itemItems = filteredItems.filter(item => item.type === 'item');
    let totalAmountTimesPct = 0;
    let totalAmount = 0;
    
    itemItems.forEach(item => {
      const amount = typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount || 0)) || 0;
      const previouslyInvoicedPct = typeof item.previouslyInvoicedPct === 'number'
        ? item.previouslyInvoicedPct
        : parseFloat(String(item.previouslyInvoicedPct || 0)) || 0;
      
      // Only include items with valid amounts and percentages
      if (amount > 0 && previouslyInvoicedPct !== null && previouslyInvoicedPct !== undefined && !isNaN(previouslyInvoicedPct)) {
        totalAmountTimesPct += amount * previouslyInvoicedPct;
        totalAmount += amount;
      }
    });
    
    return totalAmount > 0 ? totalAmountTimesPct / totalAmount : 0;
  }, [filteredItems]);

  const totalPreviouslyInvoicedAmount = useMemo(() => {
    return filteredItems
      .filter(item => item.type === 'item')
      .reduce((sum, item) => {
        const amount = typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount || 0)) || 0;
        const previouslyInvoicedPct = typeof item.previouslyInvoicedPct === 'number'
          ? item.previouslyInvoicedPct
          : parseFloat(String(item.previouslyInvoicedPct || 0)) || 0;
        
        // Calculate previously invoiced amount: Amount * % Previously Invoiced (same logic as SortableRow)
        const hasPreviouslyInvoicedPct = (previouslyInvoicedPct !== null && previouslyInvoicedPct !== undefined && 
          (typeof previouslyInvoicedPct === 'string' ? previouslyInvoicedPct !== '' : true) && 
          !isNaN(Number(previouslyInvoicedPct)));
        
        if (hasPreviouslyInvoicedPct && amount > 0) {
          const previouslyInvoicedDecimal = previouslyInvoicedPct / 100;
          return sum + (amount * previouslyInvoicedDecimal);
        }
        
        // Fallback to stored previouslyInvoicedAmount if available
        const previouslyInvoicedAmount = item.previouslyInvoicedAmount 
          ? (typeof item.previouslyInvoicedAmount === 'number' ? item.previouslyInvoicedAmount : parseFloat(String(item.previouslyInvoicedAmount)) || 0)
          : 0;
        return sum + previouslyInvoicedAmount;
      }, 0);
  }, [filteredItems]);

  const totalNewProgressPct = useMemo(() => {
    const itemItems = filteredItems.filter(item => item.type === 'item');
    let totalAmountTimesPct = 0;
    let totalAmount = 0;
    
    itemItems.forEach(item => {
      const amount = typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount || 0)) || 0;
      const progressOverallPct = typeof item.progressOverallPct === 'number' 
        ? item.progressOverallPct 
        : parseFloat(String(item.progressOverallPct || 0)) || 0;
      const previouslyInvoicedPct = typeof item.previouslyInvoicedPct === 'number'
        ? item.previouslyInvoicedPct
        : parseFloat(String(item.previouslyInvoicedPct || 0)) || 0;
      
      // Calculate new progress: % Progress Overall - % Previously Invoiced (same logic as SortableRow)
      const hasProgressPct = (progressOverallPct !== null && progressOverallPct !== undefined && 
        (typeof progressOverallPct === 'string' ? progressOverallPct !== '' : true) && 
        !isNaN(Number(progressOverallPct)));
      const hasPreviouslyInvoicedPct = (previouslyInvoicedPct !== null && previouslyInvoicedPct !== undefined && 
        (typeof previouslyInvoicedPct === 'string' ? previouslyInvoicedPct !== '' : true) && 
        !isNaN(Number(previouslyInvoicedPct)));
      
      let newProgressPct = 0;
      if (hasProgressPct && hasPreviouslyInvoicedPct) {
        newProgressPct = progressOverallPct - previouslyInvoicedPct;
      } else if (item.newProgressPct) {
        newProgressPct = typeof item.newProgressPct === 'number' ? item.newProgressPct : parseFloat(String(item.newProgressPct)) || 0;
      }
      
      // Only include items with valid amounts and new progress percentages
      if (amount > 0 && newProgressPct !== null && newProgressPct !== undefined && !isNaN(newProgressPct)) {
        totalAmountTimesPct += amount * newProgressPct;
        totalAmount += amount;
      }
    });
    
    return totalAmount > 0 ? totalAmountTimesPct / totalAmount : 0;
  }, [filteredItems]);

  const totalThisBill = useMemo(() => {
    return filteredItems
      .filter(item => item.type === 'item')
      .reduce((sum, item) => {
        const amount = typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount || 0)) || 0;
        const progressOverallPct = typeof item.progressOverallPct === 'number' 
          ? item.progressOverallPct 
          : parseFloat(String(item.progressOverallPct || 0)) || 0;
        const previouslyInvoicedPct = typeof item.previouslyInvoicedPct === 'number'
          ? item.previouslyInvoicedPct
          : parseFloat(String(item.previouslyInvoicedPct || 0)) || 0;
        
        // Calculate new progress: % Progress Overall - % Previously Invoiced
        const hasProgressPct = (progressOverallPct !== null && progressOverallPct !== undefined && 
          (typeof progressOverallPct === 'string' ? progressOverallPct !== '' : true) && 
          !isNaN(Number(progressOverallPct)));
        const hasPreviouslyInvoicedPct = (previouslyInvoicedPct !== null && previouslyInvoicedPct !== undefined && 
          (typeof previouslyInvoicedPct === 'string' ? previouslyInvoicedPct !== '' : true) && 
          !isNaN(Number(previouslyInvoicedPct)));
        
        let newProgressPct = 0;
        if (hasProgressPct && hasPreviouslyInvoicedPct) {
          newProgressPct = progressOverallPct - previouslyInvoicedPct;
        } else if (item.newProgressPct) {
          newProgressPct = typeof item.newProgressPct === 'number' ? item.newProgressPct : parseFloat(String(item.newProgressPct)) || 0;
        }
        
        // Calculate this bill: % New Progress * Amount (same logic as SortableRow)
        const hasNewProgressPct = (newProgressPct !== null && newProgressPct !== undefined && 
          (typeof newProgressPct === 'string' ? newProgressPct !== '' : true) && 
          !isNaN(Number(newProgressPct)));
        
        if (hasNewProgressPct && amount > 0) {
          const newProgressDecimal = newProgressPct / 100;
          return sum + (newProgressDecimal * amount);
        }
        
        // Fallback to stored thisBill if available
        const thisBill = item.thisBill 
          ? (typeof item.thisBill === 'number' ? item.thisBill : parseFloat(String(item.thisBill)) || 0)
          : 0;
        return sum + thisBill;
      }, 0);
  }, [filteredItems]);

  // Helper functions for formatting totals (matching SortableRow formatting)
  const formatTotalNumber = (value: number): string => {
    if (isNaN(value) || value === 0) return '';
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatTotalPercent = (value: number): string => {
    if (isNaN(value)) return '';
    return value.toFixed(2);
  };

  // Vendor Selection Totals
  const totalVendorPercentage = useMemo(() => {
    if (visibleColumnSet !== 'vendor-selection') return 0;
    const itemItems = filteredItems.filter(item => item.type === 'item');
    let total = 0;
    let count = 0;
    itemItems.forEach(item => {
      const pct = typeof item.vendorPercentage === 'number' ? item.vendorPercentage : (typeof item.vendorPercentage === 'string' ? parseFloat(String(item.vendorPercentage)) || 0 : 100);
      total += pct;
      count++;
    });
    return count > 0 ? total / count : 0;
  }, [filteredItems, visibleColumnSet]);

  const totalWorkAssignedToVendor = useMemo(() => {
    if (visibleColumnSet !== 'vendor-selection') return 0;
    return filteredItems
      .filter(item => item.type === 'item')
      .reduce((sum, item) => {
        const val = item.totalWorkAssignedToVendor !== undefined 
          ? (typeof item.totalWorkAssignedToVendor === 'number' ? item.totalWorkAssignedToVendor : parseFloat(String(item.totalWorkAssignedToVendor)) || 0)
          : (typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount || 0)) || 0);
        return sum + val;
      }, 0);
  }, [filteredItems, visibleColumnSet]);

  const totalEstimatedVendorCost = useMemo(() => {
    if (visibleColumnSet !== 'vendor-selection') return 0;
    return filteredItems
      .filter(item => item.type === 'item')
      .reduce((sum, item) => {
        const val = item.estimatedVendorCost !== undefined
          ? (typeof item.estimatedVendorCost === 'number' ? item.estimatedVendorCost : parseFloat(String(item.estimatedVendorCost)) || 0)
          : ((typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount || 0)) || 0) * 0.5);
        return sum + val;
      }, 0);
  }, [filteredItems, visibleColumnSet]);

  const totalAmountWorkCompleted = useMemo(() => {
    if (visibleColumnSet !== 'vendor-selection') return 0;
    return filteredItems
      .filter(item => item.type === 'item')
      .reduce((sum, item) => {
        const val = item.totalAmountWorkCompleted 
          ? (typeof item.totalAmountWorkCompleted === 'number' ? item.totalAmountWorkCompleted : parseFloat(String(item.totalAmountWorkCompleted)) || 0)
          : 0;
        return sum + val;
      }, 0);
  }, [filteredItems, visibleColumnSet]);

  const totalVendorBillingToDate = useMemo(() => {
    if (visibleColumnSet !== 'vendor-selection') return 0;
    return filteredItems
      .filter(item => item.type === 'item')
      .reduce((sum, item) => {
        const val = item.vendorBillingToDate
          ? (typeof item.vendorBillingToDate === 'number' ? item.vendorBillingToDate : parseFloat(String(item.vendorBillingToDate)) || 0)
          : 0;
        return sum + val;
      }, 0);
  }, [filteredItems, visibleColumnSet]);

  const totalVendorSavingsDeficit = useMemo(() => {
    if (visibleColumnSet !== 'vendor-selection') return 0;
    return filteredItems
      .filter(item => item.type === 'item')
      .reduce((sum, item) => {
        const val = item.vendorSavingsDeficit
          ? (typeof item.vendorSavingsDeficit === 'number' ? item.vendorSavingsDeficit : parseFloat(String(item.vendorSavingsDeficit)) || 0)
          : 0;
        return sum + val;
      }, 0);
  }, [filteredItems, visibleColumnSet]);

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
          {!isEditing && !editingColumn ? (
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
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-block">
                    {isDeleted ? (
                      <Button onClick={() => {}} variant="outline" size="sm" disabled className="opacity-50 cursor-not-allowed w-[130px]">
                        <Edit2 className="mr-2 h-4 w-4" />
                        Edit Table
                      </Button>
                      ) : !canEdit ? (
                        <Button 
                          onClick={() => {
                            if (getEditRestrictionMessage) {
                              toast({
                                title: getEditRestrictionMessage.title,
                                description: getEditRestrictionMessage.description,
                                variant: 'destructive',
                              });
                            }
                          }} 
                          variant="outline" 
                          size="sm" 
                          className="opacity-50 cursor-not-allowed w-[130px]"
                          aria-disabled="true"
                        >
                          <Edit2 className="mr-2 h-4 w-4" />
                          Edit Table
                        </Button>
                    ) : (
                      <Button onClick={() => {
                        setIsEditing(true);
                        setEditingColumn(null);
                          toast({
                            title: 'Edit Mode Enabled',
                            description: 'You can now edit order items. Press Esc to cancel or Ctrl+S to save.',
                            variant: 'default',
                          });
                      }} variant="outline" size="sm" className="w-[130px]">
                        <Edit2 className="mr-2 h-4 w-4" />
                        Edit Table
                      </Button>
                    )}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {isDeleted 
                        ? 'Restore first before editing' 
                        : !canEdit 
                        ? (userRole !== 'accountant' ? 'Please update Project Start Date first' : '')
                        : 'Edit order items (Ctrl+E)'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => !isDeleted && handleAddRow(-1, 'maincategory')}
                disabled={isDeleted}
                className={isDeleted ? 'opacity-50 cursor-not-allowed' : ''}
              >
                <Folder className="mr-2 h-4 w-4" />
                Add Main Category
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => !isDeleted && handleAddRow(-1, 'subcategory')}
                disabled={isDeleted}
                className={isDeleted ? 'opacity-50 cursor-not-allowed' : ''}
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                Add Subcategory
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => !isDeleted && handleAddRow(-1, 'item')}
                disabled={isDeleted}
                className={isDeleted ? 'opacity-50 cursor-not-allowed' : ''}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Row at Top
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowActionsColumn(!showActionsColumn)}
                disabled={isDeleted}
                className={isDeleted ? 'opacity-50 cursor-not-allowed' : ''}
              >
                {showActionsColumn ? (
                  <>
                    <EyeOff className="mr-2 h-4 w-4" />
                    Hide Actions
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    Show Actions
                  </>
                )}
              </Button>
            <div className="flex gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={handleSave} size="sm" disabled={saving} className="min-w-[100px]">
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
                        setEditingColumn(null);
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
                      className="w-[130px]"
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
        <div className="rounded-md border max-h-[600px] overflow-y-auto relative [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded [&:hover::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/50" style={{ scrollbarWidth: 'thin', scrollbarGutter: 'auto' }}>
          <DndContext
            sensors={isDeleted ? [] : sensors}
            collisionDetection={closestCenter}
            onDragStart={isDeleted ? undefined : handleDragStart}
            onDragOver={isDeleted ? undefined : handleDragOver}
            onDragEnd={isDeleted ? undefined : handleDragEnd}
          >
            <table className={cn("w-full caption-bottom text-sm border-separate border-spacing-0", visibleColumnSet === 'vendor-selection' ? 'table-fixed' : 'table-fixed')} style={{ width: '100%', tableLayout: 'fixed' }}>
              <TableHeader>
                <TableRow>
                  <FilterableTableHeaderText
                    title="PRODUCT/SERVICE"
                    value={productFilter}
                    onChange={setProductFilter}
                    placeholder="Filter by product/service..."
                    className="sticky top-0 z-10 bg-background w-[300px] h-8 pl-2"
                    showSeparator={true}
                  />
                  {visibleColumnSet === 'order-items' && (
                    <>
                      <TableHead className="sticky top-0 z-10 bg-background text-right border-r border-black w-[65px] whitespace-nowrap h-8">QTY</TableHead>
                      <TableHead className="sticky top-0 z-10 bg-background text-right border-r border-black w-[75px] whitespace-nowrap h-8">RATE</TableHead>
                      <TableHead className="sticky top-0 z-10 bg-background text-right border-r border-black w-[95px] whitespace-nowrap h-8">AMOUNT</TableHead>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <TableHead 
                              className="sticky top-0 z-10 bg-muted dark:bg-muted text-right font-bold text-primary dark:text-primary/90 hover:shadow-lg hover:shadow-primary/50 dark:hover:shadow-primary/40 transition-all duration-200 cursor-pointer border-r border-black w-[80px] h-8"
                              onClick={() => {
                                if (canEdit && !isDeleted) {
                                  setEditingColumn(editingColumn === 'progressOverall' ? null : 'progressOverall');
                                } else if (!isDeleted && getEditRestrictionMessage) {
                                  toast({
                                    title: getEditRestrictionMessage.title,
                                    description: getEditRestrictionMessage.description,
                                    variant: 'destructive',
                                  });
                                }
                              }}
                            >
                              <span>% Progress<br />Overall</span>
                            </TableHead>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              {isDeleted 
                                ? 'Restore first before editing' 
                                : !canEdit 
                                ? (userRole !== 'accountant' ? 'Please update Project Start Date first' : '')
                                : 'Click to edit: Set the overall progress percentage for items'}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TableHead className="sticky top-0 z-10 bg-background text-right border-r border-black w-[110px] whitespace-nowrap h-8">$ Completed</TableHead>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <TableHead 
                              className="sticky top-0 z-10 bg-muted dark:bg-muted text-right font-bold text-primary dark:text-primary/90 hover:shadow-lg hover:shadow-primary/50 dark:hover:shadow-primary/40 transition-all duration-200 cursor-pointer border-r border-black w-[100px] h-8"
                              onClick={() => {
                                if (canEdit && !isDeleted) {
                                  setEditingColumn(editingColumn === 'previouslyInvoiced' ? null : 'previouslyInvoiced');
                                } else if (!isDeleted && getEditRestrictionMessage) {
                                  toast({
                                    title: getEditRestrictionMessage.title,
                                    description: getEditRestrictionMessage.description,
                                    variant: 'destructive',
                                  });
                                }
                              }}
                            >
                              <span>% PREVIOUSLY<br />INVOICED</span>
                            </TableHead>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              {isDeleted 
                                ? 'Restore first before editing' 
                                : !canEdit 
                                ? (userRole !== 'accountant' ? 'Please update Project Start Date first' : '')
                                : 'Click to edit: Set the previously invoiced percentage for items'}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TableHead className="sticky top-0 z-10 bg-background text-right border-r border-black w-[120px] h-8">$ PREVIOUSLY<br />INVOICED</TableHead>
                      <TableHead className="sticky top-0 z-10 bg-background text-right border-r border-black w-[90px] h-8">% NEW<br />PROGRESS</TableHead>
                      <TableHead className={cn("sticky top-0 z-10 bg-background text-right", isEditing && showActionsColumn && "border-r border-black", "w-[100px] whitespace-nowrap h-8")}>THIS BILL</TableHead>
                    </>
                  )}
                  {visibleColumnSet === 'vendor-selection' && (
                    <>
                      <TableHead className="sticky top-0 z-10 bg-background border-r border-black h-8 text-center align-middle" style={{ width: '15%' }}>VENDOR NAME 1</TableHead>
                      <TableHead className="sticky top-0 z-10 bg-background text-right border-r border-black h-8" style={{ width: '8%' }}>%</TableHead>
                      <TableHead className="sticky top-0 z-10 bg-background text-right border-r border-black h-8" style={{ width: '15%' }}>Total of all work<br />assigned to vendor</TableHead>
                      <TableHead className="sticky top-0 z-10 bg-background text-right border-r border-black h-8" style={{ width: '13%' }}>Estimated<br />vendor cost</TableHead>
                      <TableHead className="sticky top-0 z-10 bg-background text-right border-r border-black h-8" style={{ width: '15%' }}>TOTAL Amount of work<br />Completed to date</TableHead>
                      <TableHead className="sticky top-0 z-10 bg-background text-right border-r border-black h-8" style={{ width: '13%' }}>Vendor billing<br />to date</TableHead>
                      <TableHead className={cn("sticky top-0 z-10 bg-background text-right", isEditing && showActionsColumn && "border-r border-black", "h-8")} style={{ width: '21%' }}>Vendor Savings<br />(Deficit)</TableHead>
                    </>
                  )}
                  {isEditing && showActionsColumn && <TableHead className="w-[80px] h-8">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                <SortableContext items={filteredItems.map(item => item.id)} strategy={verticalListSortingStrategy}>
                  {filteredItems.map((item, index) => {
                    // Determine if this is an even item row (for alternating colors)
                    // Need to find the original index in the full items array to calculate itemIndex correctly
                    const originalIndex = items.findIndex(i => i.id === item.id);
                    const itemIndex = itemRowIndices.indexOf(originalIndex);
                    const isEvenRow = itemIndex >= 0 && itemIndex % 2 === 0;

                    return (
                      <SortableRow
                        key={item.id}
                        item={item}
                        index={index}
                        isEditing={isEditing}
                        editingColumn={editingColumn}
                        onCellChange={handleCellChange}
                        onAddRow={handleAddRow}
                        onDeleteRow={handleDeleteRow}
                        isEvenRow={isEvenRow}
                        activeId={activeId}
                        overId={overId}
                        insertPosition={insertPosition}
                        isFirstRow={originalIndex === 0 || filteredItems.findIndex(fi => fi.id === item.id) === 0}
                        isDeleted={isDeleted}
                        canEdit={canEdit}
                        userRole={userRole}
                        vendors={vendors}
                        onEnterEditMode={() => {
                          if (canEdit) {
                          setIsEditing(true);
                          setEditingColumn(null);
                          } else if (!isDeleted && getEditRestrictionMessage) {
                            toast({
                              title: getEditRestrictionMessage.title,
                              description: getEditRestrictionMessage.description,
                              variant: 'destructive',
                            });
                          }
                        }}
                        showActionsColumn={showActionsColumn}
                        visibleColumnSet={visibleColumnSet}
                      />
                    );
                  })}
                  {/* Total row */}
                  <TableRow className="bg-muted/50 dark:bg-muted/30 border-t-2 border-primary/20">
                    <TableCell className="font-bold text-right">
                      Total:
                    </TableCell>
                    {visibleColumnSet === 'order-items' && (
                      <>
                        <TableCell className="text-right"></TableCell>
                        <TableCell className="text-right border-r border-black"></TableCell>
                        <TableCell className="text-right font-bold border-r border-black">
                          ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-bold border-r border-black">
                          {!isNaN(totalProgressOverallPct) && totalProgressOverallPct !== 0 ? `${formatTotalPercent(totalProgressOverallPct)}%` : <span className="text-muted-foreground/30">—</span>}
                        </TableCell>
                        <TableCell className="text-right font-bold border-r border-black">
                          {!isNaN(totalCompletedAmount) && totalCompletedAmount !== 0 ? `$${formatTotalNumber(totalCompletedAmount)}` : <span className="text-muted-foreground/30">—</span>}
                        </TableCell>
                        <TableCell className="text-right font-bold border-r border-black">
                          {!isNaN(totalPreviouslyInvoicedPct) && totalPreviouslyInvoicedPct !== 0 ? `${formatTotalPercent(totalPreviouslyInvoicedPct)}%` : <span className="text-muted-foreground/30">—</span>}
                        </TableCell>
                        <TableCell className="text-right font-bold border-r border-black">
                          {!isNaN(totalPreviouslyInvoicedAmount) && totalPreviouslyInvoicedAmount !== 0 ? `$${formatTotalNumber(totalPreviouslyInvoicedAmount)}` : <span className="text-muted-foreground/30">—</span>}
                        </TableCell>
                        <TableCell className="text-right font-bold border-r border-black">
                          {!isNaN(totalNewProgressPct) && totalNewProgressPct !== 0 ? `${formatTotalPercent(totalNewProgressPct)}%` : <span className="text-muted-foreground/30">—</span>}
                        </TableCell>
                        <TableCell className={cn("text-right font-bold", isEditing && showActionsColumn && "border-r border-black")}>
                          {!isNaN(totalThisBill) && totalThisBill !== 0 ? `$${formatTotalNumber(totalThisBill)}` : <span className="text-muted-foreground/30">—</span>}
                        </TableCell>
                      </>
                    )}
                    {visibleColumnSet === 'vendor-selection' && (
                      <>
                        <TableCell className="text-center"></TableCell>
                        <TableCell className="text-right font-bold border-r border-black">
                          {!isNaN(totalVendorPercentage) && totalVendorPercentage !== 0 ? `${formatTotalPercent(totalVendorPercentage)}%` : <span className="text-muted-foreground/30">—</span>}
                        </TableCell>
                        <TableCell className="text-right font-bold border-r border-black">
                          {!isNaN(totalWorkAssignedToVendor) && totalWorkAssignedToVendor !== 0 ? `$${formatTotalNumber(totalWorkAssignedToVendor)}` : <span className="text-muted-foreground/30">—</span>}
                        </TableCell>
                        <TableCell className="text-right font-bold border-r border-black">
                          {!isNaN(totalEstimatedVendorCost) && totalEstimatedVendorCost !== 0 ? `$${formatTotalNumber(totalEstimatedVendorCost)}` : <span className="text-muted-foreground/30">—</span>}
                        </TableCell>
                        <TableCell className="text-right font-bold border-r border-black">
                          {!isNaN(totalAmountWorkCompleted) && totalAmountWorkCompleted !== 0 ? `$${formatTotalNumber(totalAmountWorkCompleted)}` : <span className="text-muted-foreground/30">—</span>}
                        </TableCell>
                        <TableCell className="text-right font-bold border-r border-black">
                          {!isNaN(totalVendorBillingToDate) && totalVendorBillingToDate !== 0 ? `$${formatTotalNumber(totalVendorBillingToDate)}` : <span className="text-muted-foreground/30">—</span>}
                        </TableCell>
                        <TableCell className={cn("text-right font-bold", isEditing && showActionsColumn && "border-r border-black")}>
                          {!isNaN(totalVendorSavingsDeficit) && totalVendorSavingsDeficit !== 0 ? `$${formatTotalNumber(totalVendorSavingsDeficit)}` : <span className="text-muted-foreground/30">—</span>}
                        </TableCell>
                      </>
                    )}
                    {isEditing && showActionsColumn && <TableCell></TableCell>}
                  </TableRow>
                </SortableContext>
              </TableBody>
            </table>
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
