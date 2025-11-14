/**
 * Test script for addendum parser with real URL
 * Run with: npx ts-node test-addendum-real.ts
 */

import { 
  extractAddendumNumber, 
  validateAddendumUrl,
  fetchAndParseAddendum 
} from './lib/addendumParser.js';

const testUrl = 'https://l1.prodbx.com/go/view/?35587.426.20251112100816';

async function testRealAddendum() {
  console.log('=== Testing Real Addendum Parser ===\n');
  
  // Test 1: URL Validation
  console.log('Test 1: URL Validation');
  const isValid = validateAddendumUrl(testUrl);
  console.log(`✓ URL is valid: ${isValid}\n`);
  
  if (!isValid) {
    console.error('❌ URL validation failed!');
    return;
  }
  
  // Test 2: Extract Addendum Number
  console.log('Test 2: Extract Addendum Number');
  try {
    const addendumNumber = extractAddendumNumber(testUrl);
    console.log(`✓ Addendum number extracted: ${addendumNumber}`);
    console.log(`  Expected: 35587, Got: ${addendumNumber}`);
    if (addendumNumber === '35587') {
      console.log('  ✓ PASSED\n');
    } else {
      console.log('  ✗ FAILED\n');
    }
  } catch (error) {
    console.error(`✗ Error extracting addendum number: ${error instanceof Error ? error.message : error}\n`);
    return;
  }
  
  // Test 3: Fetch and Parse
  console.log('Test 3: Fetch and Parse Addendum');
  console.log(`Fetching from: ${testUrl}`);
  console.log('This may take a few seconds...\n');
  
  try {
    const result = await fetchAndParseAddendum(testUrl);
    
    console.log(`✓ Successfully fetched and parsed addendum!`);
    console.log(`  Addendum Number: ${result.addendumNumber}`);
    console.log(`  Total Items: ${result.items.length}`);
    console.log(`  URL: ${result.url}\n`);
    
    // Breakdown by type
    const subcategories = result.items.filter(i => i.type === 'subcategory');
    const lineItems = result.items.filter(i => i.type === 'item');
    const mainCategories = result.items.filter(i => i.type === 'maincategory');
    
    console.log('Item Breakdown:');
    console.log(`  Main Categories: ${mainCategories.length}`);
    console.log(`  Subcategories: ${subcategories.length}`);
    console.log(`  Line Items: ${lineItems.length}\n`);
    
    // Display subcategories
    if (subcategories.length > 0) {
      console.log('Subcategories found:');
      subcategories.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.productService}`);
      });
      console.log('');
    }
    
    // Display first 5 line items
    if (lineItems.length > 0) {
      console.log('Line Items (first 5):');
      lineItems.slice(0, 5).forEach((item, index) => {
        const desc = item.productService.toString().substring(0, 60);
        console.log(`  ${index + 1}. ${desc}${item.productService.toString().length > 60 ? '...' : ''}`);
        console.log(`     Qty: ${item.qty}, Extended: ${item.amount}, Rate: ${item.rate || '(empty)'}`);
      });
      if (lineItems.length > 5) {
        console.log(`  ... and ${lineItems.length - 5} more items`);
      }
      console.log('');
    }
    
    // Display last few line items
    if (lineItems.length > 5) {
      console.log('Line Items (last 3):');
      lineItems.slice(-3).forEach((item, index) => {
        const desc = item.productService.toString().substring(0, 60);
        console.log(`  ${lineItems.length - 2 + index}. ${desc}${item.productService.toString().length > 60 ? '...' : ''}`);
        console.log(`     Qty: ${item.qty}, Extended: ${item.amount}, Rate: ${item.rate || '(empty)'}`);
      });
      console.log('');
    }
    
    // Verify expected structure based on the actual content
    // From the web page, we expect:
    // - Subcategories: ADDON, FLOORING, CUSTOM
    // - Multiple line items
    
    console.log('\n=== Verification ===');
    const hasAddonSubcategory = subcategories.some(s => 
      s.productService.toString().toUpperCase().includes('ADDON') ||
      s.productService.toString().toUpperCase().includes('ADD ON')
    );
    const hasFlooringSubcategory = subcategories.some(s => 
      s.productService.toString().toUpperCase().includes('FLOORING')
    );
    const hasCustomSubcategory = subcategories.some(s => 
      s.productService.toString().toUpperCase().includes('CUSTOM')
    );
    
    console.log(`Has ADDON subcategory: ${hasAddonSubcategory ? '✓' : '✗'}`);
    console.log(`Has FLOORING subcategory: ${hasFlooringSubcategory ? '✓' : '✗'}`);
    console.log(`Has CUSTOM subcategory: ${hasCustomSubcategory ? '✓' : '✗'}`);
    console.log(`Has line items: ${lineItems.length > 0 ? '✓' : '✗'} (${lineItems.length} items)`);
    
    // Check for specific items
    const hasStepItem = lineItems.some(item => 
      item.productService.toString().toLowerCase().includes('step') ||
      item.productService.toString().toLowerCase().includes('riser')
    );
    const hasTileItem = lineItems.some(item => 
      item.productService.toString().toLowerCase().includes('tile')
    );
    
    console.log(`Has step/riser item: ${hasStepItem ? '✓' : '✗'}`);
    console.log(`Has tile item: ${hasTileItem ? '✓' : '✗'}`);
    
    if (subcategories.length >= 3 && lineItems.length > 0) {
      console.log('\n✓✓✓ TEST PASSED: Addendum parser working correctly! ✓✓✓');
    } else {
      console.log('\n⚠ WARNING: Unexpected number of items. May need adjustments.');
    }
    
  } catch (error) {
    console.error(`\n✗✗✗ ERROR: Failed to fetch or parse addendum ✗✗✗`);
    console.error(`Error: ${error instanceof Error ? error.message : error}`);
    if (error instanceof Error && error.stack) {
      console.error(`Stack trace: ${error.stack}`);
    }
  }
}

// Run the test
testRealAddendum().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

