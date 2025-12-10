export type TimelineFilter = 'day' | 'week' | 'month' | 'all';

export interface TimelineEntry {
  id: string;
  changeType: 'cell_edit' | 'row_add' | 'row_delete' | 'row_update' | 'customer_edit' | 'order_edit' | 'contract_add' | 'stage_update' | 'customer_delete' | 'customer_restore';
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  rowIndex: number | null;
  changedAt: Date | string;
  changedBy: {
    id: string | null;
    username: string;
  };
  customer: {
    dbxCustomerId: string;
    clientName: string;
  } | null;
  order: {
    id: string;
    orderNo: string;
  } | null;
}

export interface TimelineResponse {
  success: boolean;
  changes: TimelineEntry[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

