'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Check, ChevronDown } from 'lucide-react';

interface Vendor {
  id: string;
  name: string;
  status: 'active' | 'inactive';
}

interface VendorNameInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  vendors?: Vendor[]; // Optional: if provided, use these instead of loading
}

export default function VendorNameInput({
  value,
  onChange,
  placeholder = 'Vendor name',
  disabled = false,
  className = '',
  vendors: providedVendors,
}: VendorNameInputProps) {
  const [vendors, setVendors] = useState<Vendor[]>(providedVendors || []);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value || '');
  const [useFallback, setUseFallback] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load vendors from API only if not provided as prop
  useEffect(() => {
    // If vendors are provided as prop, use them and skip API call
    if (providedVendors && providedVendors.length > 0) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/6b8d521d-ec00-4db7-90b9-4fcc586b69d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VendorNameInput.tsx:35',message:'Using provided vendors - skipping API call',data:{vendorCount:providedVendors.length},timestamp:Date.now(),sessionId:'debug-session',runId:'vendor-api-debug',hypothesisId:'FIX'})}).catch(()=>{});
      // #endregion
      setVendors(providedVendors);
      setUseFallback(false);
      return;
    }

    // Only load from API if vendors not provided
    let mounted = true;

    const loadVendors = async () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/6b8d521d-ec00-4db7-90b9-4fcc586b69d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VendorNameInput.tsx:45',message:'VendorNameInput mount - starting API call (vendors not provided)',data:{componentId:Math.random().toString(36).substr(2,9)},timestamp:Date.now(),sessionId:'debug-session',runId:'vendor-api-debug',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      try {
        setLoading(true);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/6b8d521d-ec00-4db7-90b9-4fcc586b69d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VendorNameInput.tsx:49',message:'Fetching vendors API',data:{url:'/api/vendors?status=active&pageSize=1000'},timestamp:Date.now(),sessionId:'debug-session',runId:'vendor-api-debug',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        const response = await fetch('/api/vendors?status=active&pageSize=1000');
        
        if (!response.ok) {
          throw new Error('Failed to load vendors');
        }

        const data = await response.json();
        
        if (mounted && data.success) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/6b8d521d-ec00-4db7-90b9-4fcc586b69d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VendorNameInput.tsx:57',message:'Vendors loaded successfully',data:{vendorCount:data.data?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'vendor-api-debug',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          setVendors(data.data || []);
          setUseFallback(false);
        } else {
          throw new Error('Invalid response');
        }
      } catch (error) {
        console.error('[VendorNameInput] Error loading vendors:', error);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/6b8d521d-ec00-4db7-90b9-4fcc586b69d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VendorNameInput.tsx:63',message:'Vendor API call failed',data:{error:error instanceof Error?error.message:'Unknown'},timestamp:Date.now(),sessionId:'debug-session',runId:'vendor-api-debug',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        // Fallback to text input if API fails
        if (mounted) {
          setUseFallback(true);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadVendors();

    return () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/6b8d521d-ec00-4db7-90b9-4fcc586b69d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VendorNameInput.tsx:78',message:'VendorNameInput unmount',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'vendor-api-debug',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      mounted = false;
    };
  }, [providedVendors]);

  // Update search term when value changes externally
  useEffect(() => {
    setSearchTerm(value || '');
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter vendors based on search term
  const filteredVendors = vendors.filter(vendor =>
    vendor.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    onChange(newValue);
    setShowDropdown(true);
  };

  const handleInputFocus = () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/6b8d521d-ec00-4db7-90b9-4fcc586b69d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VendorNameInput.tsx:113',message:'Input focus handler',data:{useFallback,vendorCount:vendors.length,showDropdown},timestamp:Date.now(),sessionId:'debug-session',runId:'vendor-api-debug',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    if (!useFallback && vendors.length > 0) {
      setShowDropdown(true);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/6b8d521d-ec00-4db7-90b9-4fcc586b69d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VendorNameInput.tsx:116',message:'Setting showDropdown to true',data:{filteredCount:filteredVendors.length},timestamp:Date.now(),sessionId:'debug-session',runId:'vendor-api-debug',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
    }
  };

  const handleSelectVendor = (vendorName: string) => {
    setSearchTerm(vendorName);
    onChange(vendorName);
    setShowDropdown(false);
    inputRef.current?.blur();
  };

  // If API failed or no vendors loaded, use simple text input (fallback)
  if (useFallback || vendors.length === 0) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/6b8d521d-ec00-4db7-90b9-4fcc586b69d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VendorNameInput.tsx:127',message:'Rendering fallback text input',data:{useFallback,vendorCount:vendors.length,loading},timestamp:Date.now(),sessionId:'debug-session',runId:'vendor-api-debug',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    return (
      <Input
        ref={inputRef}
        value={searchTerm}
        onChange={handleInputChange}
        className={className}
        placeholder={placeholder}
        disabled={disabled}
      />
    );
  }

  return (
    <div className="relative w-full" style={{ position: 'relative', zIndex: showDropdown ? 1000 : 'auto' }}>
      <div className="relative">
        <Input
          ref={inputRef}
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          className={className}
          placeholder={placeholder}
          disabled={disabled}
        />
        {!disabled && (
          <button
            type="button"
            onClick={() => {
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/6b8d521d-ec00-4db7-90b9-4fcc586b69d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VendorNameInput.tsx:155',message:'Chevron button clicked',data:{currentShowDropdown:showDropdown,filteredCount:filteredVendors.length},timestamp:Date.now(),sessionId:'debug-session',runId:'vendor-api-debug',hypothesisId:'B'})}).catch(()=>{});
              // #endregion
              setShowDropdown(!showDropdown);
            }}
            className="absolute right-0 top-0 h-full px-2 flex items-center text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && filteredVendors.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-[1000] w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto"
          style={{ position: 'absolute', top: '100%', left: 0, zIndex: 1000 }}
          // #region agent log
          data-debug-dropdown="visible"
          // #endregion
        >
          {filteredVendors.map((vendor) => (
            <button
              key={vendor.id}
              type="button"
              onClick={() => handleSelectVendor(vendor.name)}
              className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground flex items-center justify-between"
            >
              <span>{vendor.name}</span>
              {searchTerm === vendor.name && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </button>
          ))}
          {/* Option to use custom value */}
          {searchTerm && !filteredVendors.some(v => v.name.toLowerCase() === searchTerm.toLowerCase()) && (
            <button
              type="button"
              onClick={() => {
                onChange(searchTerm);
                setShowDropdown(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground border-t text-muted-foreground"
            >
              Use "{searchTerm}" (custom)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

