/**
 * Test script for multiple addendum links
 * Verifies that links are processed in the order they were provided
 * Run with: npx tsx test-addendum-multiple.ts
 */

import { 
  extractAddendumNumber, 
  validateAddendumUrl,
  fetchAndParseAddendums 
} from './lib/addendumParser.js';

const testUrls = [
  'https://login.prodbx.com/go/view/?35587.426.20251112100816.',
  'https://login.prodbx.com/go/view/?35279.426.20251020095021.',
  'https://login.prodbx.com/go/view/?35237.426.20251016121413.',
  'https://login.prodbx.com/go/view/?35098.426.20251008144807.',
  'https://login.prodbx.com/go/view/?34533.426.20250915095400.',
];

async function testMultipleAddendums() {
  console.log('=== Testing Multiple Addendum Links ===\n');
  console.log(`Testing ${testUrls.length} addendum links...\n`);
  
  // Test 1: URL Validation
  console.log('Test 1: URL Validation');
  let allValid = true;
  testUrls.forEach((url, index) => {
    const isValid = validateAddendumUrl(url);
    const addendumNum = extractAddendumNumber(url);
    console.log(`  ${index + 1}. ${isValid ? '✓' : '✗'} Addendum #${addendumNum} - ${isValid ? 'Valid' : 'Invalid'}`);
    if (!isValid) allValid = false;
  });
  
  if (!allValid) {
    console.log('\n✗ Some URLs failed validation!');
    return;
  }
  console.log('  ✓ All URLs are valid\n');
  
  // Clean up URLs (remove trailing dots and normalize)
  const cleanedUrls = testUrls.map(url => {
    // Remove trailing dot if present
    let cleaned = url.trim();
    if (cleaned.endsWith('.')) {
      cleaned = cleaned.slice(0, -1);
    }
    return cleaned;
  });
  
  console.log('Test 2: Extract Addendum Numbers (Order Verification)');
  const expectedOrder: string[] = [];
  cleanedUrls.forEach((url, index) => {
    try {
      const addendumNum = extractAddendumNumber(url);
      expectedOrder.push(addendumNum);
      console.log(`  ${index + 1}. Addendum #${addendumNum}`);
    } catch (error) {
      console.error(`  ✗ Error extracting addendum number from URL ${index + 1}: ${error instanceof Error ? error.message : error}`);
    }
  });
  console.log(`  Expected processing order: ${expectedOrder.join(', ')}\n`);
  
  // Test 3: Fetch and Parse Multiple Addendums
  console.log('Test 3: Fetch and Parse Multiple Addendums');
  console.log('This may take a while (processing sequentially)...\n');
  
  try {
    const startTime = Date.now();
    const results = await fetchAndParseAddendums(cleanedUrls);
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`✓ Successfully processed ${results.length} addendum(s) in ${duration} seconds\n`);
    
    // Verify order - only compare successful addendums
    console.log('Processing Order Verification:');
    console.log(`  Total URLs: ${cleanedUrls.length}`);
    console.log(`  Successful: ${results.length}`);
    console.log(`  Failed: ${cleanedUrls.length - results.length}`);
    
    // Check that successful addendums maintain relative order from input
    let orderCorrect = true;
    let lastIndex = -1;
    
    results.forEach((result) => {
      const actual = result.addendumNumber;
      const inputIndex = expectedOrder.indexOf(actual);
      
      if (inputIndex === -1) {
        orderCorrect = false;
        console.log(`  ✗ Addendum #${actual} not found in expected order list`);
      } else if (inputIndex <= lastIndex) {
        orderCorrect = false;
        console.log(`  ✗ Addendum #${actual} appears out of order (input position ${inputIndex}, previous was ${lastIndex})`);
      } else {
        console.log(`  ✓ Addendum #${actual} at input position ${inputIndex + 1} - order correct`);
        lastIndex = inputIndex;
      }
      
      const subcategories = result.items.filter(i => i.type === 'subcategory').length;
      const lineItems = result.items.filter(i => i.type === 'item').length;
      console.log(`     Items: ${result.items.length} (${subcategories} subcategories, ${lineItems} line items)`);
    });
    
    if (orderCorrect) {
      console.log('\n  ✓✓✓ ORDER CORRECT: Successful addendums processed in input order! ✓✓✓');
    } else {
      console.log('\n  ✗✗✗ ORDER MISMATCH: Some addendums were not in correct order! ✗✗✗');
    }
    
    // Summary
    console.log('\n=== Summary ===');
    const totalItems = results.reduce((sum, r) => sum + r.items.length, 0);
    const totalSubcategories = results.reduce((sum, r) => sum + r.items.filter(i => i.type === 'subcategory').length, 0);
    const totalLineItems = results.reduce((sum, r) => sum + r.items.filter(i => i.type === 'item').length, 0);
    
    console.log(`Total Addendums: ${results.length}`);
    console.log(`Total Items: ${totalItems}`);
    console.log(`  - Subcategories: ${totalSubcategories}`);
    console.log(`  - Line Items: ${totalLineItems}`);
    console.log(`Processing Time: ${duration} seconds`);
    console.log(`Average Time per Addendum: ${(parseFloat(duration) / results.length).toFixed(2)} seconds`);
    
    // Display breakdown per addendum
    console.log('\n=== Per-Addendum Breakdown ===');
    results.forEach((result, index) => {
      const subcategories = result.items.filter(i => i.type === 'subcategory');
      const lineItems = result.items.filter(i => i.type === 'item');
      
      console.log(`\nAddendum #${result.addendumNumber} (${index + 1}/${results.length}):`);
      console.log(`  Total Items: ${result.items.length}`);
      console.log(`  Subcategories: ${subcategories.length}`);
      console.log(`  Line Items: ${lineItems.length}`);
      
      // Show first subcategory
      if (subcategories.length > 0) {
        console.log(`  First Subcategory: ${subcategories[0].productService}`);
      }
      
      // Show first line item
      if (lineItems.length > 0) {
        const firstItem = lineItems[0];
        const desc = firstItem.productService.toString().substring(0, 50);
        console.log(`  First Line Item: ${desc}${firstItem.productService.toString().length > 50 ? '...' : ''}`);
        console.log(`    Qty: ${firstItem.qty}, Extended: ${firstItem.amount}`);
      }
    });
    
    console.log('\n✓✓✓ ALL TESTS COMPLETED ✓✓✓');
    
  } catch (error) {
    console.error(`\n✗✗✗ ERROR: Failed to process addendums ✗✗✗`);
    console.error(`Error: ${error instanceof Error ? error.message : error}`);
    if (error instanceof Error && error.stack) {
      console.error(`Stack trace: ${error.stack}`);
    }
  }
}

// Run the test
testMultipleAddendums().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

