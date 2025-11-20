import type { StoredContract } from './contractStore';

const STORAGE_KEY = 'calimingo_contracts';

/**
 * Temporary localStorage-based contract store
 * This is a fallback when server-side storage fails
 */
export class LocalStorageStore {
  /**
   * Get all contracts from localStorage
   */
  static getAllContracts(): StoredContract[] {
    if (typeof window === 'undefined') {
      return [];
    }
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return [];
      }
      const contracts = JSON.parse(stored);
      // Convert parsedAt strings back to Date objects
      return contracts.map((contract: any) => ({
        ...contract,
        parsedAt: new Date(contract.parsedAt),
      }));
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return [];
    }
  }

  /**
   * Add a contract to localStorage
   */
  static addContract(contract: StoredContract): void {
    if (typeof window === 'undefined') {
      return;
    }
    
    try {
      const contracts = this.getAllContracts();
      // Remove existing contract with same ID if it exists
      const filtered = contracts.filter(c => c.id !== contract.id);
      filtered.push(contract);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error writing to localStorage:', error);
      throw error;
    }
  }

  /**
   * Get a contract by ID
   */
  static getContract(id: string): StoredContract | undefined {
    const contracts = this.getAllContracts();
    return contracts.find(c => c.id === id);
  }

  /**
   * Update a contract in localStorage
   */
  static updateContract(contract: StoredContract): void {
    if (typeof window === 'undefined') {
      return;
    }
    
    try {
      const contracts = this.getAllContracts();
      const index = contracts.findIndex(c => c.id === contract.id);
      if (index !== -1) {
        contracts[index] = contract;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(contracts));
      } else {
        // If not found, add it
        this.addContract(contract);
      }
    } catch (error) {
      console.error('Error updating contract in localStorage:', error);
      throw error;
    }
  }

  /**
   * Get all unique customers
   */
  static getAllCustomers(): Array<{
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
    const contracts = this.getAllContracts();
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

    contracts.forEach(contract => {
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
}

