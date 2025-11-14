/**
 * Test script for addendum parser
 * Run with: npx ts-node test-addendum.ts
 */

import { 
  extractAddendumNumber, 
  validateAddendumUrl,
  parseAddendum 
} from './lib/addendumParser';

// Test 1: URL validation
console.log('=== Test 1: URL Validation ===');
const testUrls = [
  'https://l1.prodbx.com/go/view/?35587.426.20251112100816',
  'https://l1.prodbx.com/go/view/?35279.426.20251020095021',
  'http://l1.prodbx.com/go/view/?12345.426.20251020095021',
  'https://example.com/go/view/?12345.426.20251020095021',
  'invalid-url',
];

testUrls.forEach(url => {
  const isValid = validateAddendumUrl(url);
  console.log(`${isValid ? '✓' : '✗'} ${url} -> ${isValid}`);
});

// Test 2: Addendum number extraction
console.log('\n=== Test 2: Addendum Number Extraction ===');
const extractUrls = [
  'https://l1.prodbx.com/go/view/?35587.426.20251112100816',
  'https://l1.prodbx.com/go/view/?35279.426.20251020095021',
  'https://l1.prodbx.com/go/view/?12345.789.20251020095021',
];

extractUrls.forEach(url => {
  try {
    const number = extractAddendumNumber(url);
    console.log(`✓ ${url} -> ${number}`);
  } catch (error) {
    console.log(`✗ ${url} -> Error: ${error instanceof Error ? error.message : error}`);
  }
});

// Test 3: HTML parsing with mock HTML
console.log('\n=== Test 3: HTML Parsing (Mock Data) ===');

const mockAddendumHTML = `
<html>
<body>
  <table class="pos">
    <tr>
      <th>Description</th>
      <th>Qty</th>
      <th>Extended</th>
    </tr>
    <tr class="ssg_title">
      <td>CONCRETE</td>
      <td></td>
      <td></td>
    </tr>
    <tr>
      <td>0100 Calimingo - Concrete</td>
      <td>1</td>
      <td>13,692.20</td>
    </tr>
    <tr>
      <td>Concrete Mix - Standard</td>
      <td>162 SF</td>
      <td>2,400.00</td>
    </tr>
    <tr class="ssg_title">
      <td>EXCAVATION</td>
      <td></td>
      <td></td>
    </tr>
    <tr>
      <td>Excavation Work</td>
      <td>50 LF</td>
      <td>1,500.00</td>
    </tr>
  </table>
</body>
</html>
`;

try {
  const result = parseAddendum(mockAddendumHTML, '35587', 'https://l1.prodbx.com/go/view/?35587.426.20251112100816');
  console.log(`✓ Parsed ${result.items.length} items`);
  console.log('\nItems:');
  result.items.forEach((item, index) => {
    console.log(`  ${index + 1}. [${item.type}] ${item.productService}`);
    if (item.type === 'item') {
      console.log(`      Qty: ${item.qty}, Amount: ${item.amount}, Rate: ${item.rate || '(empty)'}`);
    }
  });
  
  // Verify expected structure
  const subcategories = result.items.filter(i => i.type === 'subcategory');
  const lineItems = result.items.filter(i => i.type === 'item');
  
  console.log(`\n✓ Found ${subcategories.length} subcategories`);
  console.log(`✓ Found ${lineItems.length} line items`);
  
  if (subcategories.length === 2 && lineItems.length === 3) {
    console.log('✓ Test PASSED: Expected structure found');
  } else {
    console.log('✗ Test FAILED: Unexpected structure');
    console.log(`  Expected: 2 subcategories, 3 line items`);
    console.log(`  Got: ${subcategories.length} subcategories, ${lineItems.length} line items`);
  }
} catch (error) {
  console.log(`✗ Parsing failed: ${error instanceof Error ? error.message : error}`);
}

// Test 4: Test with more complex HTML (with main categories)
console.log('\n=== Test 4: HTML Parsing (With Main Categories) ===');

const mockAddendumHTML2 = `
<html>
<body>
  <table class="pos">
    <tr>
      <th>Description</th>
      <th>Qty</th>
      <th>Extended</th>
    </tr>
    <tr>
      <td><strong>0020 Calimingo - Pools and Spas</strong><br><em>Standard Pool</em></td>
      <td>1</td>
      <td>50,000.00</td>
    </tr>
    <tr class="ssg_title">
      <td>CONCRETE</td>
      <td></td>
      <td></td>
    </tr>
    <tr>
      <td>Concrete Work</td>
      <td>100 SF</td>
      <td>3,500.00</td>
    </tr>
  </table>
</body>
</html>
`;

try {
  const result2 = parseAddendum(mockAddendumHTML2, '35279', 'https://l1.prodbx.com/go/view/?35279.426.20251020095021');
  console.log(`✓ Parsed ${result2.items.length} items`);
  console.log('\nItems:');
  result2.items.forEach((item, index) => {
    console.log(`  ${index + 1}. [${item.type}] ${item.productService.substring(0, 50)}${item.productService.length > 50 ? '...' : ''}`);
    if (item.type === 'item') {
      console.log(`      Qty: ${item.qty}, Amount: ${item.amount}`);
    }
  });
  
  // Main categories should be skipped but tracked
  const mainCategories = result2.items.filter(i => i.type === 'maincategory');
  const subcategories2 = result2.items.filter(i => i.type === 'subcategory');
  const lineItems2 = result2.items.filter(i => i.type === 'item');
  
  console.log(`\n✓ Main categories (should be 0, skipped): ${mainCategories.length}`);
  console.log(`✓ Subcategories: ${subcategories2.length}`);
  console.log(`✓ Line items: ${lineItems2.length}`);
  
  if (mainCategories.length === 0 && subcategories2.length === 1 && lineItems2.length === 1) {
    console.log('✓ Test PASSED: Main categories skipped correctly');
  } else {
    console.log('✗ Test FAILED: Unexpected structure');
  }
} catch (error) {
  console.log(`✗ Parsing failed: ${error instanceof Error ? error.message : error}`);
}

console.log('\n=== All Tests Complete ===');

