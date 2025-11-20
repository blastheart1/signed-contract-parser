import { OrderItem, Location } from '@/lib/tableExtractor';

export interface StoredContract {
  id: string;
  customer: {
    dbxCustomerId?: string;
    clientName: string;
    email?: string;
    phone?: string;
    streetAddress: string;
    city: string;
    state: string;
    zip: string;
  };
  order: {
    orderNo: string;
    orderDate?: string;
    orderPO?: string;
    orderDueDate?: string;
    orderType?: string;
    orderDelivered?: boolean;
    quoteExpirationDate?: string;
    orderGrandTotal: number;
    progressPayments?: string;
    balanceDue: number;
    salesRep?: string;
  };
  items: OrderItem[];
  parsedAt: Date;
  isLocationParsed?: boolean; // Indicates if customer/job info was successfully parsed
  orderItemsValidation?: {
    isValid: boolean;
    itemsTotal: number;
    orderGrandTotal: number;
    difference: number;
    message?: string;
  }; // Validation result for order items total
}

// In-memory store for contracts
class ContractStore {
  private contracts: Map<string, StoredContract> = new Map();

  /**
   * Add a contract to the store
   */
  addContract(contract: StoredContract): void {
    this.contracts.set(contract.id, contract);
  }

  /**
   * Get a contract by ID
   */
  getContract(id: string): StoredContract | undefined {
    return this.contracts.get(id);
  }

  /**
   * Get all contracts
   */
  getAllContracts(): StoredContract[] {
    return Array.from(this.contracts.values());
  }

  /**
   * Get contracts for a specific customer (by DBX Customer ID or client name)
   */
  getCustomerContracts(customerId?: string, clientName?: string): StoredContract[] {
    return Array.from(this.contracts.values()).filter(contract => {
      if (customerId && contract.customer.dbxCustomerId === customerId) {
        return true;
      }
      if (clientName && contract.customer.clientName === clientName) {
        return true;
      }
      return false;
    });
  }

  /**
   * Get contract by order number
   */
  getContractByOrderNo(orderNo: string): StoredContract | undefined {
    return Array.from(this.contracts.values()).find(
      contract => contract.order.orderNo === orderNo
    );
  }

  /**
   * Get all unique customers
   */
  getAllCustomers(): Array<{
    id: string;
    dbxCustomerId?: string;
    clientName: string;
    email?: string;
    phone?: string;
    streetAddress: string;
    city: string;
    state: string;
    zip: string;
    contractCount: number;
  }> {
    const customerMap = new Map<string, {
      id: string;
      dbxCustomerId?: string;
      clientName: string;
      email?: string;
      phone?: string;
      streetAddress: string;
      city: string;
      state: string;
      zip: string;
      contractCount: number;
    }>();

    this.contracts.forEach(contract => {
      const key = contract.customer.dbxCustomerId || contract.customer.clientName;
      if (!customerMap.has(key)) {
        customerMap.set(key, {
          id: contract.customer.dbxCustomerId || contract.id,
          dbxCustomerId: contract.customer.dbxCustomerId,
          clientName: contract.customer.clientName,
          email: contract.customer.email,
          phone: contract.customer.phone,
          streetAddress: contract.customer.streetAddress,
          city: contract.customer.city,
          state: contract.customer.state,
          zip: contract.customer.zip,
          contractCount: 0,
        });
      }
      const customer = customerMap.get(key)!;
      customer.contractCount++;
    });

    return Array.from(customerMap.values());
  }

  /**
   * Delete a contract
   */
  deleteContract(id: string): boolean {
    return this.contracts.delete(id);
  }

  /**
   * Clear all contracts
   */
  clear(): void {
    this.contracts.clear();
  }
}

// Singleton instance
export const contractStore = new ContractStore();

